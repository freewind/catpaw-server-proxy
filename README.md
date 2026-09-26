# CatPaw Server Proxy

CatPaw 服务器部署版 - 独立部署的 OpenAI 兼容 API 代理，无需本地 CatPaw Electron 应用。

## 功能特性

- ✅ 兼容 OpenAI 的 `/v1/chat/completions` 接口
- ✅ 支持流式输出 (SSE)
- ✅ 独立部署，无需本地 CatPaw 应用
- ✅ Web UI 配置 Token
- ✅ 健康检查端点

## 前置要求

- Node.js 18+
- 有效的 CatPaw X-Auth-Token

## 快速开始

### 1. 获取 X-Auth-Token

从 CatPaw 应用获取 X-Auth-Token：
- 打开 CatPaw 应用
- 按 F12 打开开发者工具
- 进入 Application → Cookies
- 复制 `X-Auth-Token` 的值

### 2. 安装并启动

```bash
# 克隆仓库
git clone https://github.com/yourusername/catpaw-server-proxy.git
cd catpaw-server-proxy

# 启动服务器
npm start

# 或自定义端口
PORT=8080 node server-standalone.mjs
```

### 3. 配置 Token

访问 `http://localhost:33000/` 并粘贴你的 X-Auth-Token。

### 4. 使用 API

```bash
curl http://localhost:33000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-api-key" \
  -d '{
    "model": "catpaw",
    "messages": [{"role": "user", "content": "你好！"}],
    "stream": true
  }'
```

## 部署方式

### 直接部署

```bash
# 默认端口 33000
npm start

# 自定义端口
PORT=8080 npm start
```

### Docker 部署

```bash
# 构建镜像
docker build -t catpaw-server-proxy .

# 运行容器
docker run -d -p 33000:33000 -v $(pwd)/data:/app/data catpaw-server-proxy
```

### Docker Compose 部署

```bash
docker-compose up -d
```

## API 端点

- `GET /` - Web UI 配置 Token
- `GET /health` - 健康检查
- `POST /v1/chat/completions` - 兼容 OpenAI 的聊天补全

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `33000` |
| `DATA_DIR` | Token 数据目录（存放 `auth.json`） | 项目内 `./data` |
| `API_KEY` | API 认证密钥 | 无 |

## 文件结构

```
.
├── server-standalone.mjs   # 主服务器（独立部署版）
├── public/
│   └── index.html          # 静态页（server 未引用）
├── package.json
├── .gitignore
└── README.md
```

Token 数据默认写入项目内的 `data/auth.json`，可用 `DATA_DIR` 覆盖。

## 许可证

[MIT](LICENSE)

## 免责声明

本项目仅供学习和研究使用。请遵守 CatPaw 的服务条款。
