require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const { join } = require('path')
const { createServer } = require('http')
const next = require('next')
const { connectAndVerify, prisma } = require('./db/prismaClient')

// 导入 API 路由
const openaiRoutes = require('./routes/openai')
const accountRoutes = require('./routes/accounts')
const systemRoutes = require('./routes/system')
const { verifyOpenAIEndpoint } = require('./middleware/verifyOpenAIEndpoint')

const app = express()
const port = process.env.PORT || 3000
const dev = process.env.NODE_ENV !== 'production'

// 初始化 Next.js
const nextApp = next({ dev, dir: join(__dirname, '../frontend') })
const handle = nextApp.getRequestHandler()

// ==================== 验证必要环境变量 ====================

function validateEnv() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'DEFAULT_MODEL',
    'MAX_RETRIES',
    'REQUEST_TIMEOUT',
    'API_SECRET',
    'JWT_SECRET'
  ]

  const missing = requiredEnvVars.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`缺少必要的环境变量: ${missing.join(', ')}`)
  }
}

// ==================== 中间件 ====================

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

// ==================== API 路由 ====================

// OpenAI 兼容端点（使用标准 Authorization: Bearer 验证）
app.use('/v1', verifyOpenAIEndpoint, openaiRoutes)

// 管理面板 API（使用 JWT 验证）
app.use('/api/accounts', accountRoutes)
app.use('/api/system', systemRoutes)

// Next.js 处理
app.all('*', async (req, res) => {
  await handle(req, res)
})

// ==================== 启动服务 ====================

async function initializeDatabase() {
  const bcrypt = require('bcryptjs')
  const defaultPassword = process.env.API_SECRET
  
  // 创建默认管理员用户
  const hashedPassword = await bcrypt.hash(defaultPassword, 10)
  
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword
    }
  })

  // 初始化默认设置
  const defaultSettings = [
    { keyName: 'polling_strategy', keyValue: 'round-robin', description: '账号轮询策略' },
    { keyName: 'default_model', keyValue: process.env.DEFAULT_MODEL, description: '默认模型' },
    { keyName: 'auto_refresh_token', keyValue: 'true', description: '自动刷新 Token' }
  ]

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { keyName: setting.keyName },
      update: {},
      create: setting
    })
  }

  console.log('✅ 数据库初始化完成')
}

async function start() {
  try {
    console.log('🔄 验证环境变量...')
    validateEnv()
    console.log('✅ 环境变量验证通过')

    console.log('🔄 正在连接数据库...')
    await connectAndVerify()

    console.log('🔄 正在初始化数据库...')
    await initializeDatabase()

    // 准备 Next.js
    await nextApp.prepare()

    // 启动定时任务：自动刷新 token
    startTokenRefreshScheduler()

    // 创建 HTTP 服务器
    const server = createServer(app)

    server.listen(port, '0.0.0.0', () => {
      console.log('')
      console.log('========================================')
      console.log('🚀 Qwen OpenAI 端点服务已启动')
      console.log('========================================')
      console.log(`📡 服务地址: http://localhost:${port}`)
      console.log(`🌐 管理面板: http://localhost:${port}/login`)
      console.log(`🔌 API 端点: http://localhost:${port}/v1`)
      console.log('========================================')
      console.log('')
    })
  } catch (error) {
    console.error('❌ 服务启动失败:', error.message)
    process.exit(1)
  }
}

function startTokenRefreshScheduler() {
  const QwenOAuthService = require('./services/QwenOAuthService')
  const interval = 10 * 60 * 1000
  
  setInterval(async () => {
    try {
      console.log('🔄 执行定时 token 刷新...')
      const results = await QwenOAuthService.autoRefreshToken()
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      if (results.length > 0) {
        console.log(`✅ 定时刷新完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
      }
    } catch (error) {
      console.error('❌ 定时 token 刷新失败:', error.message)
    }
  }, interval)
}

start()

module.exports = app
