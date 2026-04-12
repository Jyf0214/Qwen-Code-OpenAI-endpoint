export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const API_CONFIG = {
  baseUrl: 'https://portal.qwen.ai',
  defaultModel: 'coder-model',
  timeout: 60000,
  maxRetries: 3
}

async function getActiveAccount() {
  const now = new Date()
  const account = await prisma.account.findFirst({
    where: {
      isActive: true,
      status: 'active',
      expiresAt: { gt: now }
    },
    orderBy: [{ requestCount: 'asc' }, { lastUsedAt: 'asc' }]
  })
  return account
}

async function incrementRequestCount(id) {
  await prisma.account.update({
    where: { id },
    data: {
      requestCount: { increment: 1 },
      lastUsedAt: new Date()
    }
  })
}

async function addTokenUsage(id, inputTokens, outputTokens, totalTokens) {
  await prisma.account.update({
    where: { id },
    data: {
      tokenUsedInput: { increment: inputTokens },
      tokenUsedOutput: { increment: outputTokens },
      tokenUsedTotal: { increment: totalTokens },
      tokenLifetimeTotal: { increment: BigInt(totalTokens) }
    }
  })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const account = await getActiveAccount()

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
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${account.accessToken}`
    }

    const requestBody = {
      ...body,
      model: 'coder-model'
    }

    const response = await axios.post(endpoint, requestBody, {
      headers,
      timeout: API_CONFIG.timeout
    })

    // 保存 token 使用量
    const usage = response.data?.usage || response.data?.usage_metadata
    if (usage) {
      const inputTokens = usage.prompt_tokens || usage.input_token_count || 0
      const outputTokens = usage.completion_tokens || usage.output_token_count || 0
      const totalTokens = usage.total_tokens || usage.total_token_count || (inputTokens + outputTokens)
      await addTokenUsage(account.id, inputTokens, outputTokens, totalTokens)
    }

    await incrementRequestCount(account.id)

    const result = {
      ...response.data,
      usage: usage || response.data?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('聊天完成请求失败:', error.message)
    return NextResponse.json(
      { error: { message: error.message, type: 'api_error', code: 500 } },
      { status: 500 }
    )
  }
}
