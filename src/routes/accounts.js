const express = require('express');
const router = express.Router();
const QwenOAuthService = require('../services/QwenOAuthService');
const AccountManager = require('../db/models/AccountManager');

// ==================== 账号管理 API ====================

// 获取所有账号
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await AccountManager.getAllAccounts();
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('获取账号列表失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取活跃账号
router.get('/accounts/active', async (req, res) => {
  try {
    const accounts = await AccountManager.getActiveAccounts();
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('获取活跃账号失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取账号统计信息
router.get('/accounts/stats', async (req, res) => {
  try {
    const stats = await AccountManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 发起设备授权流程（添加新账号）
router.post('/accounts/auth', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '请提供账号名称'
      });
    }

    const result = await QwenOAuthService.completeDeviceFlow(name);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          accountId: result.accountId,
          userCode: result.userCode,
          verificationUri: result.verificationUri,
          verificationUriComplete: result.verificationUriComplete,
          expiresIn: result.expiresIn,
          message: '请在浏览器中打开链接并完成授权'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('发起设备授权失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 检查账号授权状态并获取 token
router.post('/accounts/:id/check-token', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await QwenOAuthService.checkAndStoreToken(id);
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('检查 token 失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 手动刷新账号 token
router.post('/accounts/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await AccountManager.getAccountById(id);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: '账号不存在'
      });
    }

    if (!account.refresh_token) {
      return res.status(400).json({
        success: false,
        message: '账号没有 refresh_token，需要重新授权'
      });
    }

    const QwenOAuthService = require('../../services/QwenOAuthService');
    const result = await QwenOAuthService.refreshToken(account.refresh_token);
    
    if (result.success) {
      const newExpiresAt = new Date(Date.now() + result.expires_in * 1000);
      
      await AccountManager.updateAccountTokens(id, {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type,
        expires_at: newExpiresAt,
        scope: result.scope
      });

      res.json({
        success: true,
        data: {
          message: 'Token 刷新成功',
          expiresAt: newExpiresAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
        needReauth: result.needReauth
      });
    }
  } catch (error) {
    console.error('刷新 token 失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 删除账号
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await AccountManager.deleteAccount(id);
    
    res.json({
      success: true,
      message: '账号已删除'
    });
  } catch (error) {
    console.error('删除账号失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 切换账号激活状态
router.patch('/accounts/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const newStatus = await AccountManager.toggleAccountActive(id);

    res.json({
      success: true,
      data: {
        isActive: newStatus,
        message: newStatus ? '账号已激活' : '账号已停用'
      }
    });
  } catch (error) {
    console.error('切换账号状态失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 重置账号 token 使用统计
router.post('/accounts/:id/reset-tokens', async (req, res) => {
  try {
    const { id } = req.params;
    await AccountManager.resetTokenUsage(id);

    res.json({
      success: true,
      message: 'Token 使用数据已清除，总调用数已保留'
    });
  } catch (error) {
    console.error('重置 token 使用统计失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 自动刷新所有即将过期的 token
router.post('/accounts/refresh-all', async (req, res) => {
  try {
    const QwenOAuthService = require('../../services/QwenOAuthService');
    const results = await QwenOAuthService.autoRefreshToken();
    
    res.json({
      success: true,
      data: {
        total: results.length,
        successCount: results.filter(r => r.success).length,
        failCount: results.filter(r => !r.success).length,
        details: results
      }
    });
  } catch (error) {
    console.error('批量刷新 token 失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
