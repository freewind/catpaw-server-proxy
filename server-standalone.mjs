#!/usr/bin/env node
/**
 * CatPaw 独立部署 API 服务器
 * 直接对接 CatPaw 后端，无需本地 Electron
 */

import http from 'http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const PORT = process.env.PORT || 33000;
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const AUTH_FILE = join(DATA_DIR, 'auth.json');

const BASE_URL = 'https://nocode.cn';
const STREAM_URL = 'https://ai.catpaw.meituan.com';

// 确保数据目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// 加载 Token
function loadToken() {
  try {
    if (existsSync(AUTH_FILE)) {
      return JSON.parse(readFileSync(AUTH_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

// 保存 Token
function saveToken(tokenData) {
  writeFileSync(AUTH_FILE, JSON.stringify(tokenData, null, 2));
}

// 验证 Token
async function validateToken(token) {
  try {
    const response = await fetch(`${BASE_URL}/api/gateway/passport/current-user`, {
      headers: { 'X-Auth-Token': token }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// 创建会话
async function createSession(token) {
  const response = await fetch(`${BASE_URL}/api/gateway/v1/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token
    },
    body: JSON.stringify({
      name: 'API Session',
      description: 'Created via standalone API'
    })
  });
  return response.json();
}

// 发送消息（流式）
async function* streamMessage(token, conversationId, message) {
  const response = await fetch(`${STREAM_URL}/api/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      conversationId,
      messages: [{ role: 'user', content: message }],
      model: 'claude-sonnet-4.6'
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
}

// HTML 登录页面
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CatPaw API - 设置 Token</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
            padding: 40px;
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 14px;
            min-height: 100px;
            resize: vertical;
        }
        textarea:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        .help {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            font-size: 13px;
            color: #666;
        }
        .help code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .status {
            margin-top: 15px;
            padding: 12px;
            border-radius: 8px;
            display: none;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            display: block;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 CatPaw API</h1>
        <p class="subtitle">设置访问 Token</p>
        
        <form id="tokenForm">
            <div class="form-group">
                <label>SSO Token</label>
                <textarea id="token" placeholder="粘贴从浏览器获取的 X-Auth-Token"></textarea>
            </div>
            <button type="submit">保存 Token</button>
        </form>
        
        <div id="status" class="status"></div>
        
        <div class="help">
            <strong>获取 Token 方法：</strong><br>
            1. 打开 <code>https://catpaw.meituan.com</code> 并登录<br>
            2. 按 F12 打开开发者工具<br>
            3. 找到任意 API 请求的请求头<br>
            4. 复制 <code>X-Auth-Token</code> 的值
        </div>
    </div>
    
    <script>
        document.getElementById('tokenForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('token').value.trim();
            const status = document.getElementById('status');
            
            if (!token) {
                status.className = 'status error';
                status.textContent = '请输入 Token';
                return;
            }
            
            try {
                const res = await fetch('/save-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                const data = await res.json();
                
                if (data.success) {
                    status.className = 'status success';
                    status.innerHTML = '✓ Token 保存成功！<br>用户: ' + (data.userName || data.userId);
                } else {
                    status.className = 'status error';
                    status.textContent = '保存失败: ' + data.error;
                }
            } catch (err) {
                status.className = 'status error';
                status.textContent = '请求失败: ' + err.message;
            }
        });
    </script>
</body>
</html>`;

// 处理请求
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 主页 - Token 设置
  if (url.pathname === '/' && req.method === 'GET') {
    const token = loadToken();
    if (token?.access_token) {
      // 已设置 Token，显示状态
      const user = await validateToken(token.access_token);
      if (user) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>CatPaw API</title>
<style>body{font-family:sans-serif;max-width:600px;margin:50px auto;padding:20px;text-align:center;}</style></head>
<body>
<h1>✅ CatPaw API 已就绪</h1>
<p>用户: ${user.userName || user.userId}</p>
<p>API 端点: <code>http://${req.headers.host}/v1/chat/completions</code></p>
<p><a href="/set-token">重新设置 Token</a></p>
</body></html>`);
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(LOGIN_HTML);
    return;
  }

  // Token 设置页面
  if (url.pathname === '/set-token' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(LOGIN_HTML);
    return;
  }

  // 保存 Token
  if (url.pathname === '/save-token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { token } = JSON.parse(body);
        if (!token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Token required' }));
          return;
        }
        
        const user = await validateToken(token);
        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid token' }));
          return;
        }
        
        saveToken({
          access_token: token,
          userId: user.userId,
          userName: user.userName,
          modified_at: Date.now()
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          userId: user.userId,
          userName: user.userName
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    const token = loadToken();
    const user = token?.access_token ? await validateToken(token.access_token) : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: user ? 'ok' : 'no_token',
      user: user ? { id: user.userId, name: user.userName } : null
    }));
    return;
  }

  // OpenAI 兼容 API
  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    const token = loadToken();
    if (!token?.access_token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token not set. Visit / to configure.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const messages = data.messages;
        const stream = data.stream !== false;
        
        // 创建会话
        const session = await createSession(token.access_token);
        const conversationId = session.data?.conversationId || session.conversationId;
        
        if (!conversationId) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to create session' }));
          return;
        }

        const message = messages[messages.length - 1]?.content || '';

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          const id = randomUUID();
          let content = '';

          try {
            for await (const chunk of streamMessage(token.access_token, conversationId, message)) {
              content += chunk;
              res.write(`data: ${JSON.stringify({
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: 'catpaw',
                choices: [{ index: 0, delta: { content: chunk } }]
              })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
          } catch (e) {
            res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
          }
          res.end();
        } else {
          // 非流式响应
          let fullContent = '';
          for await (const chunk of streamMessage(token.access_token, conversationId, message)) {
            fullContent += chunk;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: randomUUID(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'catpaw',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: fullContent },
              finish_reason: 'stop'
            }]
          }));
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     CatPaw 独立部署 API 服务器                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log('');
  console.log('端点:');
  console.log(`  - 设置 Token: http://localhost:${PORT}/`);
  console.log(`  - 健康检查:  http://localhost:${PORT}/health`);
  console.log(`  - API 接口:  http://localhost:${PORT}/v1/chat/completions`);
  console.log('');
});
