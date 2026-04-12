require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { connectAndVerify, prisma } = require('./db/prismaClient');

// 导入路由
const openaiRoutes = require('./routes/openai');
const accountRoutes = require('./routes/accounts');
const systemRoutes = require('./routes/system');

const app = express();
const PORT = process.env.PORT;

// ==================== 验证必要环境变量 ====================

function validateEnv() {
  const requiredEnvVars = [
    'PORT',
    'DATABASE_URL',
    'QWEN_OAUTH_BASE_URL',
    'QWEN_API_URL',
    'QWEN_OAUTH_CLIENT_ID',
    'QWEN_OAUTH_SCOPE',
    'DEFAULT_MODEL',
    'MAX_RETRIES',
    'REQUEST_TIMEOUT',
    'API_SECRET'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`缺少必要的环境变量: ${missing.join(', ')}`);
  }
}

// ==================== 中间件 ====================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

// ==================== 路由注册 ====================

app.use('/v1', openaiRoutes);
app.use('/api', accountRoutes);
app.use('/api/system', systemRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================== 错误处理 ====================

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: '接口不存在',
      type: 'not_found',
      code: 404
    }
  });
});

app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || '服务器内部错误',
      type: 'internal_error',
      code: err.status || 500
    }
  });
});

// ==================== 启动服务 ====================

async function initializeDatabase() {
  // 初始化默认设置
  const defaultSettings = [
    { keyName: 'polling_strategy', keyValue: 'round-robin', description: 'Account polling strategy: round-robin or least-used' },
    { keyName: 'default_model', keyValue: process.env.DEFAULT_MODEL, description: 'Default model for API requests' },
    { keyName: 'auto_refresh_token', keyValue: 'true', description: 'Automatically refresh tokens when expired' }
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { keyName: setting.keyName },
      update: {},
      create: setting
    });
  }

  console.log('✅ 数据库初始化完成');
}

async function start() {
  try {
    // 验证环境变量
    console.log('🔄 验证环境变量...');
    validateEnv();
    console.log('✅ 环境变量验证通过');

    // 初始化数据库连接
    console.log('🔄 正在连接数据库...');
    await connectAndVerify();

    // 初始化数据库表结构
    console.log('🔄 正在初始化数据库...');
    await initializeDatabase();

    // 启动定时任务：自动刷新 token
    startTokenRefreshScheduler();

    // 启动服务
    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('========================================');
      console.log('🚀 Qwen OpenAI 端点服务已启动');
      console.log('========================================');
      console.log(`📡 服务地址: http://localhost:${PORT}`);
      console.log(`🌐 管理面板: http://localhost:${PORT}`);
      console.log(`🔌 API 端点: http://localhost:${PORT}/v1`);
      console.log(`📖 OpenAI 兼容: http://localhost:${PORT}/v1/chat/completions`);
      console.log('========================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ 服务启动失败:', error.message);
    process.exit(1);
  }
}

/**
 * 定时任务：每 10 分钟自动刷新即将过期的 token
 */
function startTokenRefreshScheduler() {
  const QwenOAuthService = require('./services/QwenOAuthService');
  
  const interval = 10 * 60 * 1000;
  
  setInterval(async () => {
    try {
      console.log('🔄 执行定时 token 刷新...');
      const results = await QwenOAuthService.autoRefreshToken();
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (results.length > 0) {
        console.log(`✅ 定时刷新完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
      }
    } catch (error) {
      console.error('❌ 定时 token 刷新失败:', error.message);
    }
  }, interval);
}

// 启动应用
start();

module.exports = app;
