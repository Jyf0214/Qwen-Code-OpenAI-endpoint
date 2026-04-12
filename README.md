# Qwen OpenAI 兼容端点

基于 Qwen Code 官方仓库的 OAuth 登录逻辑和 Token 刷新机制，构建的可 Docker 快速部署的 OpenAI 兼容 API 端点服务。

## 功能特性

- ✅ **OpenAI 兼容 API**：完全兼容 `/v1/chat/completions` 和 `/v1/models` 端点
- ✅ **多账号管理**：支持添加多个 Qwen 账号，自动轮询使用
- ✅ **OAuth 自动刷新**：定时自动刷新即将过期的 Token
- ✅ **Web 管理面板**：通过网页端添加/管理账号，查看请求日志
- ✅ **Prisma ORM**：使用 Prisma 进行数据库管理，类型安全
- ✅ **MySQL 存储**：支持本地和外部 MySQL 数据库
- ✅ **Docker 部署**：一键启动，开箱即用
- ✅ **流式响应**：支持 SSE 流式输出
- ✅ **请求日志**：完整的请求记录和统计信息

## 架构说明

### 认证流程（基于官方 Qwen Code 实现）

```
用户添加账号 → 生成 PKCE 验证码对 → 请求设备授权码 → 
用户在浏览器中授权 → 轮询获取 Access Token → 
存储到 MySQL → 定时自动刷新 Token
```

### 请求流程

```
客户端请求 → 选择可用账号（轮询/最少使用） → 
注入 Access Token → 转发到 Qwen API → 
返回响应 → 更新使用统计
```

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd qwen-openai-endpoint

# 2. 配置环境变量（必填）
cp .env.docker .env
# 编辑 .env 文件，填写所有必要的环境变量

# 3. 启动服务
docker-compose up -d

# 4. 访问管理面板
# 浏览器打开: http://localhost:${APP_PORT}
```

### 方式二：本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（必填）
cp .env.example .env
# 编辑 .env 文件，填写所有必要的环境变量

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 初始化数据库
npx prisma db push

# 5. 启动服务
npm start

# 或使用开发模式（自动重启）
npm run dev
```

## 环境变量配置

**所有环境变量均为必填，不得留空**

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | Prisma 数据库连接 URL | `mysql://user:password@localhost:3306/dbname` |
| `QWEN_OAUTH_BASE_URL` | Qwen OAuth 基础 URL | `https://chat.qwen.ai` |
| `QWEN_API_URL` | Qwen API 端点 URL | `https://portal.qwen.ai` |
| `QWEN_OAUTH_CLIENT_ID` | Qwen OAuth 客户端 ID | `f0304373b74a44d2b584a3fb70ca9e56` |
| `QWEN_OAUTH_SCOPE` | OAuth 授权范围 | `openid profile email model.completion` |
| `DEFAULT_MODEL` | 默认模型 | `qwen3-coder-plus` |
| `MAX_RETRIES` | 最大重试次数 | `3` |
| `REQUEST_TIMEOUT` | 请求超时（毫秒） | `60000` |
| `POLLING_STRATEGY` | 轮询策略 | `round-robin` |
| `TOKEN_REFRESH_BUFFER` | Token 刷新缓冲（秒） | `1800` |
| `API_SECRET` | API 密钥（请设置为随机字符串） | `your-random-secret` |

## API 文档

### OpenAI 兼容端点

#### 聊天完成

```bash
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "qwen3-coder-plus",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "stream": false
}
```

**指定账号**（可选）：
```bash
Header: x-account-id: 1
# 或
{
  "account_id": 1,
  ...
}
```

#### 流式聊天

```bash
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "qwen3-coder-plus",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "stream": true
}
```

#### 获取模型列表

```bash
GET /v1/models
```

### 账号管理 API

#### 获取所有账号

```bash
GET /api/accounts
```

#### 添加新账号

```bash
POST /api/accounts/auth
Content-Type: application/json

{
  "name": "我的账号"
}

# 返回授权链接，用户需在浏览器中打开完成授权
```

#### 检查授权状态

```bash
POST /api/accounts/:id/check-token
```

#### 刷新 Token

```bash
POST /api/accounts/:id/refresh
```

#### 删除账号

```bash
DELETE /api/accounts/:id
```

#### 切换账号状态

```bash
PATCH /api/accounts/:id/toggle
```

### 系统管理 API

#### 获取统计信息

```bash
GET /api/accounts/stats
```

#### 获取请求日志

```bash
GET /api/system/logs?limit=100&offset=0
```

#### 健康检查

```bash
GET /api/system/health
```

## Web 管理面板

访问 `http://localhost:${PORT}` 打开管理面板：

1. **统计信息**：查看总账号数、活跃账号、过期账号、总请求数
2. **添加账号**：发起 OAuth 设备授权，在浏览器中完成登录
3. **账号列表**：查看、刷新、启用/停用、删除账号
4. **请求日志**：查看最近的 API 请求记录

## Prisma 数据库模型

### Account 模型

存储 Qwen 账号信息和 Token

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| name | String | 账号名称 |
| accessToken | String? | 访问令牌 |
| refreshToken | String? | 刷新令牌 |
| expiresAt | DateTime? | 过期时间 |
| status | String | 状态（pending/active/expired/error）|
| isActive | Boolean | 是否启用 |
| requestCount | Int | 请求次数 |

### RequestLog 模型

记录 API 请求日志

### Setting 模型

存储系统设置

## 使用外部 MySQL

修改 `.env` 文件中的 `DATABASE_URL`：

```env
DATABASE_URL=mysql://your_user:your_password@your-external-mysql-host:3306/your_database
```

## 轮询策略

支持两种账号轮询策略：

- **round-robin**（默认）：按顺序轮询使用账号
- **least-used**：优先使用请求次数最少的账号

在管理面板中切换策略，或修改数据库中的 `settings` 表。

## 自动 Token 刷新

服务每 10 分钟自动检查即将过期的 Token（默认提前 30 分钟），并使用 `refresh_token` 进行刷新。

刷新失败的账号会被标记为 `expired` 状态，需要用户在管理面板中手动刷新或重新授权。

## Prisma 常用命令

```bash
# 生成 Prisma 客户端
npx prisma generate

# 推送数据库结构（无需迁移）
npx prisma db push

# 创建并运行迁移
npx prisma migrate dev --name init

# 打开 Prisma Studio（数据库 GUI）
npx prisma studio
```

## 安全建议

1. **修改 API_SECRET**：在生产环境中设置随机密钥
2. **使用 HTTPS**：反向代理（如 Nginx）配置 SSL
3. **限制访问**：使用防火墙或认证保护管理面板
4. **定期备份**：定期备份 MySQL 数据库

## 技术栈

- **后端**：Node.js + Express
- **数据库**：MySQL 8.0 + Prisma ORM
- **HTTP 客户端**：Axios
- **认证**：Qwen OAuth2 Device Flow（RFC 8628）+ PKCE
- **部署**：Docker + Docker Compose

## 基于官方实现

本项目的 OAuth 流程和 Token 管理逻辑基于 [Qwen Code 官方仓库](https://github.com/QwenLM/qwen-code) 实现：

- OAuth2 设备授权流程（RFC 8628）
- PKCE S256 验证方法
- Token 刷新机制
- 跨进程 Token 同步

## 许可证

Apache-2.0

## 贡献

欢迎提交 Issue 和 Pull Request！
