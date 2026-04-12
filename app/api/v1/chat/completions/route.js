export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import axios from 'axios'
import * as Account from '../../../../../lib/account'

const API_CONFIG = {
  baseUrl: 'https://portal.qwen.ai',
  timeout: 60000
}

export async function POST(request) {
  try {
    const body = await request.json()
    const account = await Account.getLeastUsedAccount()

    if (!account) {
      return NextResponse.json(
        { error: { message: '没有可用的账号', type: 'no_available_account', code: 503 } },
        { status: 503 }
      )
    }

    if (!account.accessToken || !account.expiresAt || new Date(account.expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: { message: `账号 ${account.name} 的 token 已过期`, type: 'token_expired', code: 401 } },
        { status: 401 }
      )
    }

    const endpoint = `${API_CONFIG.baseUrl}/v1/chat/completions`
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${account.accessToken}` }
    const requestBody = { ...body, model: 'coder-model' }

    const response = await axios.post(endpoint, requestBody, { headers, timeout: API_CONFIG.timeout })

    const usage = response.data?.usage || response.data?.usage_metadata
    if (usage) {
      const inputTokens = usage.prompt_tokens || usage.input_token_count || 0
      const outputTokens = usage.completion_tokens || usage.output_token_count || 0
      const totalTokens = usage.total_tokens || usage.total_token_count || (inputTokens + outputTokens)
      await Account.addTokenUsage(account.id, inputTokens, outputTokens, totalTokens)
    }

    await Account.incrementRequestCount(account.id)

    return NextResponse.json({
      ...response.data,
      usage: usage || response.data?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    })
  } catch (error) {
    console.error('聊天完成请求失败:', error.message)
    return NextResponse.json(
      { error: { message: error.message, type: 'api_error', code: 500 } },
      { status: 500 }
    )
  }
}
