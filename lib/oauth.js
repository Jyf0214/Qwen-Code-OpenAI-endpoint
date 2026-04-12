import { createHash, randomBytes } from 'crypto'
import axios from 'axios'
import * as Account from './account.js'

const OAUTH_CONFIG = {
  baseUrl: 'https://chat.qwen.ai',
  clientId: 'f0304373b74a44d2b584a3fb70ca9e56',
  scope: 'openid profile email model.completion'
}

export function generatePKCEPair() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function requestDeviceCode(pkceChallenge) {
  const response = await axios.post(
    `${OAUTH_CONFIG.baseUrl}/api/v1/oauth2/device/code`,
    {
      client_id: OAUTH_CONFIG.clientId,
      scope: OAUTH_CONFIG.scope,
      code_challenge: pkceChallenge,
      code_challenge_method: 'S256'
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
  )
  const d = response.data
  return {
    device_code: d.device_code,
    user_code: d.user_code,
    verification_uri: d.verification_uri,
    verification_uri_complete: d.verification_uri_complete,
    expires_in: d.expires_in,
    interval: d.interval || 2
  }
}

export async function pollDeviceToken(deviceCode, pkceVerifier, maxWaitTime, interval = 2) {
  const start = Date.now()
  while (Date.now() - start < maxWaitTime * 1000) {
    try {
      const res = await axios.post(
        `${OAUTH_CONFIG.baseUrl}/api/v1/oauth2/token`,
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: OAUTH_CONFIG.clientId,
          code_verifier: pkceVerifier
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      )
      return {
        success: true,
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
        tokenType: res.data.token_type || 'Bearer',
        expiresIn: res.data.expires_in,
        scope: res.data.scope
      }
    } catch (err) {
      if (err.response?.data?.error) {
        const e = err.response.data.error
        if (e === 'authorization_pending') { await sleep(interval * 1000); continue }
        if (e === 'slow_down') { interval = Math.min(interval + 1, 10); await sleep(interval * 1000); continue }
        if (e === 'expired_token') return { success: false, error: '设备授权码已过期' }
        if (e === 'access_denied') return { success: false, error: '用户拒绝授权' }
        return { success: false, error: err.response.data.error_description || e }
      }
      return { success: false, error: `请求失败: ${err.message}` }
    }
  }
  return { success: false, error: '等待授权超时' }
}

export async function refreshToken(refreshToken) {
  try {
    const res = await axios.post(
      `${OAUTH_CONFIG.baseUrl}/api/v1/oauth2/token`,
      { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: OAUTH_CONFIG.clientId },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    )
    return {
      success: true,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      tokenType: res.data.token_type || 'Bearer',
      expiresIn: res.data.expires_in,
      scope: res.data.scope
    }
  } catch (err) {
    if (err.response?.status === 400) return { success: false, error: 'refresh_token 已失效，需要重新授权', needReauth: true }
    return { success: false, error: `刷新 token 失败: ${err.message}` }
  }
}

export async function completeDeviceFlow(accountName) {
  try {
    const { verifier, challenge } = generatePKCEPair()
    const deviceData = await requestDeviceCode(challenge)
    const id = await Account.createAccount({
      name: accountName,
      deviceCode: deviceData.device_code,
      userCode: deviceData.user_code,
      verificationUri: deviceData.verification_uri,
      verificationUriComplete: deviceData.verification_uri_complete,
      pkceVerifier: verifier,
      pkceChallenge: challenge
    })
    return { success: true, accountId: id, ...deviceData }
  } catch (err) {
    return { success: false, error: `设备授权流程失败: ${err.message}` }
  }
}

export async function checkAndStoreToken(accountId) {
  try {
    const account = await Account.getAccountById(accountId)
    if (!account) return { success: false, error: '账号不存在' }
    if (account.status === 'active') return { success: true, alreadyActive: true, accessToken: account.accessToken }
    const result = await pollDeviceToken(account.deviceCode, account.pkceVerifier, account.expiresIn || 900, 2)
    if (result.success) {
      const expiresAt = new Date(Date.now() + result.expiresIn * 1000)
      await Account.updateAccountTokens(accountId, {
        accessToken: result.accessToken, refreshToken: result.refreshToken,
        tokenType: result.tokenType, expiresAt, scope: result.scope
      })
      return { success: true, accessToken: result.accessToken, refreshToken: result.refreshToken, expiresAt }
    }
    return result
  } catch (err) {
    return { success: false, error: `检查 token 失败: ${err.message}` }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
