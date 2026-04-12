const express = require('express');
const router = express.Router();
const QwenOAuthService = require('../services/QwenOAuthService');
const QwenProxyService = require('../services/QwenProxyService');
const AccountManager = require('../db/models/AccountManager');

// ==================== OpenAI 兼容端点 ====================

// 聊天完成 - 对应 OpenAI /v1/chat/completions
router.post('/chat/completions', async (req, res) => {
  try {
    const requestBody = req.body;
    
    // 获取请求的账号 ID（可选）
    const accountId = req.headers['x-account-id'] || req.body.account_id;

    // 如果是流式请求
    if (requestBody.stream) {
      await QwenProxyService.createChatCompletionStream(requestBody, res, accountId);
      return;
    }

    // 非流式请求
    const result = await QwenProxyService.createChatCompletion(requestBody, accountId);
    res.json(result);
  } catch (error) {
    console.error('聊天完成请求失败:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'api_error',
        code: 500
      }
    });
  }
});

// 获取模型列表 - 对应 OpenAI /v1/models
router.get('/models', async (req, res) => {
  try {
    const accountId = req.headers['x-account-id'] || req.query.account_id;
    const result = await QwenProxyService.listModels(accountId);
    res.json(result);
  } catch (error) {
    console.error('获取模型列表失败:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'api_error',
        code: 500
      }
    });
  }
});

// 获取单个模型信息 - 对应 OpenAI /v1/models/{model}
router.get('/models/:model', async (req, res) => {
  try {
    const { model } = req.params;
    const accountId = req.headers['x-account-id'] || req.query.account_id;
    
    // 向 Qwen API 发起真实请求获取模型信息
    const { baseUrl } = QwenProxyService.API_CONFIG;
    let account = null;
    if (accountId) {
      account = await AccountManager.getAccountById(accountId);
    } else {
      const strategy = await QwenProxyService.getPollingStrategy();
      account = await QwenProxyService.getNextAccount(strategy);
    }

    if (!account) {
      return res.status(404).json({
        error: {
          message: '没有可用的账号',
          type: 'no_available_account',
          code: 404
        }
      });
    }

    const axios = require('axios');
    const response = await axios.get(`${baseUrl}/v1/models/${model}`, {
      headers: {
        'Authorization': `Bearer ${account.access_token}`
      },
      timeout: 30000,
      validateStatus: (status) => status < 500
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('获取模型信息失败:', error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'api_error',
        code: 500
      }
    });
  }
});

module.exports = router;
