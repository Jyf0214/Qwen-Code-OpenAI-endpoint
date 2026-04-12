const express = require('express');
const router = express.Router();
const { prisma } = require('../db/prismaClient');
const AccountManager = require('../db/models/AccountManager');

// ==================== 系统管理 API ====================

// 获取系统设置
router.get('/settings', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({
      orderBy: { id: 'asc' }
    });
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('获取设置失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 更新系统设置
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await prisma.setting.update({
      where: { keyName: key },
      data: { keyValue: value }
    });
    
    res.json({
      success: true,
      message: '设置已更新'
    });
  } catch (error) {
    console.error('更新设置失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取请求日志
router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const logs = await prisma.requestLog.findMany({
      include: {
        account: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    // 格式化数据
    const formattedLogs = logs.map(log => ({
      ...log,
      account_name: log.account ? log.account.name : null
    }));
    
    res.json({
      success: true,
      data: formattedLogs
    });
  } catch (error) {
    console.error('获取日志失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取系统健康状态
router.get('/health', async (req, res) => {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    
    // 获取账号状态
    const stats = await AccountManager.getStats();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        accounts: stats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
