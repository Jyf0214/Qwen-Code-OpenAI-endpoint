export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const account = await prisma.account.findFirst({
      where: { isActive: true, status: 'active', expiresAt: { gt: new Date() } },
      orderBy: [{ requestCount: 'asc' }]
    })

    if (!account) {
      return NextResponse.json(
        { error: { message: '没有可用的账号', type: 'no_available_account', code: 503 } },
        { status: 503 }
      )
    }

    const response = await fetch(`${process.env.QWEN_API_URL || 'https://portal.qwen.ai'}/v1/models`, {
      headers: { 'Authorization': `Bearer ${account.accessToken}` }
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: { message: error.message, type: 'api_error', code: 500 } },
      { status: 500 }
    )
  }
}
