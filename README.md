# Qwen OpenAI 兼容端点

基于 Qwen Code 官方仓库的 OAuth 登录逻辑和 Token 刷新机制，构建的可 Docker 快速部署的 OpenAI 兼容 API 端点服务。

## 功能特性

- ✅ **OpenAI 兼容 API**：完全兼容 `/v1/chat/completions` 和 `/v1/models` 端点
- ✅ **多账号管理**：支持添加多个 Qwen 账号，自动轮询使用
- ✅ **OAuth 自动刷新**：定时自动刷新即将过期的 Token
- ✅ **Next.js + Ant Design**：现代化管理面板，支持登录认证
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
注入 Access Token → 强制重写模型为 coder-model → 
转发到 Qwen API → 返回响应 → 更新使用统计
```

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd qwen-openai-endpoint

# 2. 配置环境变量
cp .env.docker .env
# 编辑 .env 文件，填写 DATABASE_URL、API_SECRET、JWT_SECRET

# 3. 启动服务
docker-compose up -d

# 4. 访问管理面板
# 浏览器打开: http://localhost:3000/login
# 默认账号: admin
# 默认密码: API_SECRET 环境变量的值
```

### 方式二：本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写 DATABASE_URL、API_SECRET、JWT_SECRET

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 初始化数据库
npx prisma db push

# 5. 启动服务
npm start

# 或使用开发模式
npm run dev
```

## 环境变量配置

仅需三个必填项，其余参数均使用合理的默认值：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | Prisma 数据库连接 URL | `mysql://user:password@localhost:3306/dbname` |
| `API_SECRET` | API 密钥（用于 OpenAI 端点和默认管理员密码） | `your-random-secret` |
| `JWT_SECRET` | JWT 密钥（用于管理面板认证） | `your-jwt-secret` |

以下参数均有默认值，无需配置：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `MAX_RETRIES` | `3` | 最大重试次数 |
| `REQUEST_TIMEOUT` | `60000` | 请求超时（毫秒） |

> **注意**：模型名称已硬编码为 `coder-model`（与官方 Qwen Code 一致），用户传入的 model 参数会被强制重写，无需配置。

## API 文档

### OpenAI 兼容端点

**认证方式**：`Authorization: Bearer <API_SECRET>`

#### 聊天完成

```bash
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer your_api_secret

{
  "model": "任意值（会被重写为 coder-model）",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "stream": false
}
```

#### 流式聊天

```bash
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer your_api_secret

{
  "model": "任意值（会被重写为 coder-model）",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "stream": true
}
```

#### 获取模型列表

```bash
GET /v1/models
Authorization: Bearer your_api_secret
```

## 管理面板

访问 `http://localhost:3000/login` 打开管理面板：

- **默认账号**：`admin`
- **默认密码**：`API_SECRET` 环境变量的值
- 登录后可以在设置中修改密码

### 功能

1. **统计信息**：查看总账号数、活跃账号、过期账号、总请求数
2. **添加账号**：发起 OAuth 设备授权，在浏览器中完成登录
3. **账号列表**：查看、刷新、启用/停用、删除账号
4. **请求日志**：查看最近的 API 请求记录

## Prisma 数据库模型

### User 模型

存储管理员用户

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| username | String | 用户名 |
| password | String | 密码（bcrypt 加密）|
| isActive | Boolean | 是否启用 |

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

## 技术栈

- **后端**：Node.js + Express
- **前端**：Next.js 16 + Ant Design 6
- **数据库**：MySQL 8.0 + Prisma ORM
- **HTTP 客户端**：Axios
- **认证**：JWT + bcrypt
- **OAuth**：Qwen OAuth2 Device Flow（RFC 8628）+ PKCE
- **部署**：Docker + Docker Compose

## 基于官方实现

本项目的 OAuth 流程和 Token 管理逻辑基于 [Qwen Code 官方仓库](https://github.com/QwenLM/qwen-code) 实现。

## 许可证

Apache-2.0
