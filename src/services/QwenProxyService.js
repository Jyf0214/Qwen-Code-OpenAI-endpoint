const axios = require('axios');
const AccountManager = require('../db/models/AccountManager');
const { prisma } = require('../db/prismaClient');

class QwenProxyService {
  // Qwen API 固定端点配置（基于官方 Qwen Code 实现）
  static get API_CONFIG() {
    return {
      baseUrl: 'https://portal.qwen.ai',
      defaultModel: 'coder-model',
      timeout: 60000,
      maxRetries: 3
    };
  }

  /**
   * 获取下一个可用账号（根据轮询策略）
   */
  static async getNextAccount(strategy = 'round-robin') {
    let account;
    
    if (strategy === 'least-used') {
      account = await AccountManager.getLeastUsedAccount();
    } else {
      // 默认使用 round-robin
      account = await AccountManager.getNextAccountForPollen(this._lastAccountId);
    }

    if (account) {
      this._lastAccountId = account.id;
    }

    return account;
  }

  /**
   * 发送聊天完成请求
   * 对应官方 QwenContentGenerator.executeWithCredentialManagement()
   */
  static async createChatCompletion(requestBody, accountId = null) {
    const { baseUrl, maxRetries, defaultModel, timeout } = this.API_CONFIG;
    
    // 验证必要配置
    if (!baseUrl) {
      throw new Error('QWEN_API_URL 环境变量未配置');
    }
    
    // 获取账号
    let account = null;
    if (accountId) {
      account = await AccountManager.getAccountById(parseInt(accountId));
    } else {
      const strategy = await this.getPollingStrategy();
      account = await this.getNextAccount(strategy);
    }

    if (!account) {
      throw new Error('没有可用的账号');
    }

    // 检查 token 是否过期
    if (!account.accessToken || !account.expiresAt || new Date(account.expiresAt) <= new Date()) {
      throw new Error(`账号 ${account.name} 的 token 已过期`);
    }

    // 构建请求
    const endpoint = `${baseUrl}/v1/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${account.accessToken}`
    };

    // 强制重写模型为硬编码默认模型（忽略用户传入的值）
    requestBody.model = defaultModel;

    let lastError = null;
    let response = null;
    let startTime = null;

    // 重试机制（对应官方 executeWithCredentialManagement 的 auth error retry）
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        startTime = Date.now();
        
        response = await axios.post(endpoint, requestBody, {
          headers,
          timeout: timeout
        });

        const responseTime = Date.now() - startTime;

        // 记录请求日志
        await this.logRequest({
          accountId: account.id,
          model: requestBody.model,
          endpoint,
          method: 'POST',
          statusCode: response.status,
          responseTime,
          errorMessage: null
        });

        // 更新账号使用统计
        await AccountManager.incrementRequestCount(account.id);

        // 捕获并保存 token 使用量
        const usage = response.data?.usage || response.data?.usage_metadata;
        let tokenUsage = null;

        if (usage) {
          const inputTokens = usage.prompt_tokens || usage.input_token_count || usage.promptTokenCount || 0;
          const outputTokens = usage.completion_tokens || usage.output_token_count || usage.candidatesTokenCount || 0;
          const totalTokens = usage.total_tokens || usage.total_token_count || usage.totalTokenCount || (inputTokens + outputTokens);

          await AccountManager.addTokenUsage(account.id, inputTokens, outputTokens, totalTokens);

          // 确保响应中包含标准 OpenAI usage 格式
          tokenUsage = {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: totalTokens
          };
        }

        // 构建最终响应（确保包含 usage）
        const result = {
          ...response.data,
          usage: tokenUsage || response.data?.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            note: '上游 API 未返回 token 使用量'
          }
        };

        return result;
      } catch (error) {
        lastError = error;

        // 检查是否为认证错误（401/403）
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.error(`⚠️  账号 ${account.name} 认证失败，尝试刷新 token...`);
          
          // 尝试刷新 token
          const QwenOAuthService = require('./QwenOAuthService');
          const refreshResult = await QwenOAuthService.refreshToken(account.refreshToken);
          
          if (refreshResult.success) {
            // 更新数据库中的 token
            const newExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000);
            await AccountManager.updateAccountTokens(account.id, {
              accessToken: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken,
              tokenType: refreshResult.tokenType,
              expiresAt: newExpiresAt,
              scope: refreshResult.scope
            });

            // 更新 headers 中的 token
            headers.Authorization = `Bearer ${refreshResult.accessToken}`;
            
            console.log(`✅ 账号 ${account.name} 的 token 已刷新，重试请求...`);
            continue; // 重试
          } else {
            // 刷新失败，标记账号为过期状态
            await AccountManager.updateAccountStatus(account.id, 'expired');
            throw new Error(`账号 ${account.name} 的 token 刷新失败: ${refreshResult.error}`);
          }
        }

        // 非认证错误，记录日志并抛出
        const responseTime = startTime ? Date.now() - startTime : 0;
        await this.logRequest({
          accountId: account.id,
          model: requestBody.model,
          endpoint,
          method: 'POST',
          statusCode: error.response ? error.response.status : 500,
          responseTime,
          errorMessage: error.message
        });

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * 流式聊天完成
   */
  static async createChatCompletionStream(requestBody, res, accountId = null) {
    const { baseUrl, maxRetries, defaultModel, timeout } = this.API_CONFIG;
    
    let account = null;
    if (accountId) {
      account = await AccountManager.getAccountById(parseInt(accountId));
    } else {
      const strategy = await this.getPollingStrategy();
      account = await this.getNextAccount(strategy);
    }

    if (!account) {
      throw new Error('没有可用的账号');
    }

    // 确保 stream 为 true
    requestBody.stream = true;
    // 强制重写模型为硬编码默认模型（忽略用户传入的值）
    requestBody.model = defaultModel;

    const endpoint = `${baseUrl}/v1/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${account.accessToken}`
    };

    // 设置响应头为 SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const response = await axios.post(endpoint, requestBody, {
        headers,
        timeout: timeout,
        responseType: 'stream'
      });

      let lastDataChunk = null;
      let streamEnded = false;

      // 将远程响应流式传输到客户端
      response.data.on('data', (chunk) => {
        res.write(chunk);

        // 捕获最后一条数据块用于提取 usage
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.usage || parsed.usage_metadata) {
                lastDataChunk = parsed;
              }
            } catch {}
          }
        }
      });

      response.data.on('end', () => {
        res.end();
        streamEnded = true;

        // 更新使用统计
        AccountManager.incrementRequestCount(account.id).catch(console.error);

        // 保存 token 使用量
        if (lastDataChunk) {
          const usage = lastDataChunk.usage || lastDataChunk.usage_metadata;
          if (usage) {
            const inputTokens = usage.prompt_tokens || usage.input_token_count || usage.promptTokenCount || 0;
            const outputTokens = usage.completion_tokens || usage.output_token_count || usage.candidatesTokenCount || 0;
            const totalTokens = usage.total_tokens || usage.total_token_count || usage.totalTokenCount || (inputTokens + outputTokens);

            AccountManager.addTokenUsage(account.id, inputTokens, outputTokens, totalTokens).catch(console.error);
          }
        }
      });

      response.data.on('error', (error) => {
        console.error('流式传输错误:', error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      });
    } catch (error) {
      console.error('流式请求失败:', error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * 获取模型列表
   */
  static async listModels(accountId = null) {
    const { baseUrl } = this.API_CONFIG;
    
    if (!baseUrl) {
      throw new Error('QWEN_API_URL 环境变量未配置');
    }
    
    let account = null;
    if (accountId) {
      account = await AccountManager.getAccountById(parseInt(accountId));
    } else {
      const strategy = await this.getPollingStrategy();
      account = await this.getNextAccount(strategy);
    }

    if (!account) {
      throw new Error('没有可用的账号');
    }

    const response = await axios.get(`${baseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${account.accessToken}`
      },
      timeout: 30000
    });

    return response.data;
  }

  /**
   * 获取轮询策略
   */
  static async getPollingStrategy() {
    const setting = await prisma.setting.findUnique({
      where: { keyName: 'polling_strategy' }
    });
    return setting ? setting.keyValue : 'round-robin';
  }

  /**
   * 记录请求日志
   */
  static async logRequest({ accountId, model, endpoint, method, statusCode, responseTime, errorMessage }) {
    try {
      await prisma.requestLog.create({
        data: {
          accountId,
          model,
          endpoint,
          method,
          statusCode,
          responseTime,
          errorMessage
        }
      });
    } catch (error) {
      console.error('记录请求日志失败:', error.message);
    }
  }
}

QwenProxyService._lastAccountId = null;

module.exports = QwenProxyService;
