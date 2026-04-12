const axios = require('axios');
const crypto = require('crypto');
const AccountManager = require('../db/models/AccountManager');

class QwenOAuthService {
  // Qwen OAuth 固定端点配置（基于官方 Qwen Code 实现）
  static get OAUTH_CONFIG() {
    return {
      baseUrl: 'https://chat.qwen.ai',
      apiUrl: 'https://portal.qwen.ai',
      clientId: 'f0304373b74a44d2b584a3fb70ca9e56',
      scope: 'openid profile email model.completion'
    };
  }

  /**
   * 生成 PKCE 验证码对
   * 使用 S256 方法，与官方 Qwen Code 实现一致
   */
  static generatePKCEPair() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    
    return { verifier, challenge };
  }

  /**
   * 请求设备授权码
   * 对应官方 QwenOAuth2Client.requestDeviceAuthorization()
   */
  static async requestDeviceCode(pkceChallenge) {
    const { baseUrl, clientId, scope } = this.OAUTH_CONFIG;
    
    const response = await axios.post(
      `${baseUrl}/api/v1/oauth2/device/code`,
      {
        client_id: clientId,
        scope: scope,
        code_challenge: pkceChallenge,
        code_challenge_method: 'S256'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const data = response.data;
    
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_uri_complete: data.verification_uri_complete,
      expires_in: data.expires_in,
      interval: data.interval || 2
    };
  }

  /**
   * 轮询获取访问令牌
   * 对应官方 QwenOAuth2Client.pollDeviceToken()
   * 实现 OAuth RFC 8628 设备授权流程
   */
  static async pollDeviceToken(deviceCode, pkceVerifier, maxWaitTime, interval = 2) {
    const { baseUrl, clientId, scope } = this.OAUTH_CONFIG;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime * 1000) {
      try {
        const response = await axios.post(
          `${baseUrl}/api/v1/oauth2/token`,
          {
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: deviceCode,
            client_id: clientId,
            code_verifier: pkceVerifier
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        return {
          success: true,
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          tokenType: response.data.token_type || 'Bearer',
          expiresIn: response.data.expires_in,
          scope: response.data.scope,
          error: null
        };
      } catch (error) {
        if (error.response && error.response.data && error.response.data.error) {
          const errorData = error.response.data;
          
          switch (errorData.error) {
            case 'authorization_pending':
              await this.sleep(interval * 1000);
              continue;
              
            case 'slow_down':
              interval = Math.min(interval + 1, 10);
              await this.sleep(interval * 1000);
              continue;
              
            case 'expired_token':
              return {
                success: false,
                error: '设备授权码已过期'
              };
              
            case 'access_denied':
              return {
                success: false,
                error: '用户拒绝授权'
              };
              
            default:
              return {
                success: false,
                error: errorData.error_description || errorData.error
              };
          }
        }
        
        return {
          success: false,
          error: `请求失败: ${error.message}`
        };
      }
    }

    return {
      success: false,
      error: '等待授权超时'
    };
  }

  /**
   * 刷新访问令牌
   * 对应官方 QwenOAuth2Client.refreshAccessToken()
   */
  static async refreshToken(refreshToken) {
    const { baseUrl, clientId } = this.OAUTH_CONFIG;
    
    try {
      const response = await axios.post(
        `${baseUrl}/api/v1/oauth2/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return {
        success: true,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type || 'Bearer',
        expiresIn: response.data.expires_in,
        scope: response.data.scope
      };
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return {
          success: false,
          error: 'refresh_token 已失效，需要重新授权',
          needReauth: true
        };
      }
      
      return {
        success: false,
        error: `刷新 token 失败: ${error.message}`
      };
    }
  }

  /**
   * 完整的设备授权流程
   * 对应官方 authWithQwenDeviceFlow()
   */
  static async completeDeviceFlow(accountName) {
    try {
      const { verifier: pkceVerifier, challenge: pkceChallenge } = this.generatePKCEPair();
      
      const deviceCodeData = await this.requestDeviceCode(pkceChallenge);
      
      const accountId = await AccountManager.createAccount({
        name: accountName,
        deviceCode: deviceCodeData.device_code,
        userCode: deviceCodeData.user_code,
        verificationUri: deviceCodeData.verification_uri,
        verificationUriComplete: deviceCodeData.verification_uri_complete,
        pkceVerifier: pkceVerifier,
        pkceChallenge: pkceChallenge
      });

      return {
        success: true,
        accountId,
        userCode: deviceCodeData.user_code,
        verificationUri: deviceCodeData.verification_uri,
        verificationUriComplete: deviceCodeData.verification_uri_complete,
        expiresIn: deviceCodeData.expires_in,
        interval: deviceCodeData.interval
      };
    } catch (error) {
      return {
        success: false,
        error: `设备授权流程失败: ${error.message}`
      };
    }
  }

  /**
   * 检查并获取 token（在设备授权后调用）
   */
  static async checkAndStoreToken(accountId) {
    try {
      const account = await AccountManager.getAccountById(accountId);
      
      if (!account) {
        return { success: false, error: '账号不存在' };
      }

      if (account.status === 'active') {
        return { 
          success: true, 
          alreadyActive: true,
          accessToken: account.accessToken 
        };
      }

      const tokenResult = await this.pollDeviceToken(
        account.deviceCode,
        account.pkceVerifier,
        account.expiresIn || 900,
        2
      );

      if (tokenResult.success) {
        const expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000);
        
        await AccountManager.updateAccountTokens(accountId, {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          tokenType: tokenResult.tokenType,
          expiresAt: expiresAt,
          scope: tokenResult.scope
        });

        return {
          success: true,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          expiresAt
        };
      }

      return tokenResult;
    } catch (error) {
      return {
        success: false,
        error: `检查 token 失败: ${error.message}`
      };
    }
  }

  /**
   * 自动刷新即将过期的 token
   */
  static async autoRefreshToken() {
    const { prisma } = require('../db/prismaClient');
    const bufferSeconds = parseInt(process.env.TOKEN_REFRESH_BUFFER) || 1800;
    const now = new Date();
    const thresholdTime = new Date(now.getTime() + bufferSeconds * 1000);

    const expiringAccounts = await prisma.account.findMany({
      where: {
        isActive: true,
        status: 'active',
        refreshToken: { not: null },
        expiresAt: {
          lte: thresholdTime,
          gt: now
        }
      }
    });

    const results = [];
    
    for (const account of expiringAccounts) {
      console.log(`🔄 自动刷新账号 ${account.name} (ID: ${account.id}) 的 token...`);
      
      const refreshResult = await this.refreshToken(account.refreshToken);
      
      if (refreshResult.success) {
        const newExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000);
        
        await AccountManager.updateAccountTokens(account.id, {
          accessToken: refreshResult.accessToken,
          refreshToken: refreshResult.refreshToken,
          tokenType: refreshResult.tokenType,
          expiresAt: newExpiresAt,
          scope: refreshResult.scope
        });

        results.push({
          accountId: account.id,
          accountName: account.name,
          success: true,
          newExpiresAt
        });

        console.log(`✅ 账号 ${account.name} 的 token 已刷新`);
      } else {
        results.push({
          accountId: account.id,
          accountName: account.name,
          success: false,
          error: refreshResult.error
        });

        console.error(`❌ 账号 ${account.name} 的 token 刷新失败: ${refreshResult.error}`);
        
        if (refreshResult.needReauth) {
          await AccountManager.updateAccountStatus(account.id, 'expired');
        }
      }
    }

    return results;
  }

  /**
   * 辅助函数：休眠
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = QwenOAuthService;
