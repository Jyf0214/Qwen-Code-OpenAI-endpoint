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
const { checkWebUIEnabled } = require('./middleware/checkWebUIEnabled')

const app = express()
const port = process.env.PORT || 3000
const dev = process.env.NODE_ENV !== 'production'

// 初始化 Next.js
const frontendDir = join(__dirname, '../frontend')
console.log('📂 Next.js frontend dir:', frontendDir)
console.log('📂 frontend/.next exists:', require('fs').existsSync(join(frontendDir, '.next')))
const nextApp = next({ dev, dir: frontendDir })
const handle = nextApp.getRequestHandler()

// ==================== 验证必要环境变量 ====================

function validateEnv() {
  const requiredEnvVars = [
    'DATABASE_URL',
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

// 管理面板 API（受 WEB_UI_ENABLED 环境变量控制）
app.use('/api/accounts', checkWebUIEnabled, accountRoutes)
app.use('/api/system', checkWebUIEnabled, systemRoutes)

// Next.js 处理
app.all('*', async (req, res) => {
  await handle(req, res)
})

// ==================== 启动服务 ====================

async function initializeDatabase() {
  const { execSync } = require('child_process')

  // 执行 prisma db push 自动建表
  console.log('🔄 同步数据库结构...')
  try {
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    console.log('✅ 数据库结构同步完成')
  } catch (error) {
    console.error('❌ 数据库结构同步失败:', error.message)
    throw error
  }

  // 初始化默认设置
  const defaultSettings = [
    { keyName: 'polling_strategy', keyValue: 'round-robin', description: '账号轮询策略' },
    { keyName: 'default_model', keyValue: 'coder-model', description: '默认模型' },
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

// 禁用控制台缓冲，确保日志立即输出
process.stdout._handle.setBlocking(true)
process.stderr._handle.setBlocking(true)

async function start() {
  console.log('🔄 服务启动中...')
  try {
    console.log('🔄 验证环境变量...')
    validateEnv()
    console.log('✅ 环境变量验证通过')

    console.log('🔄 正在连接数据库...')
    await connectAndVerify()

    console.log('🔄 正在初始化数据库...')
    await initializeDatabase()

    // Next.js 已预构建，直接使用请求处理器
    console.log('✅ Next.js 就绪')

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
