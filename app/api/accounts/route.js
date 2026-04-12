export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'
import * as OAuth from '@/lib/oauth'

// GET /api/accounts
export async function GET() {
  try {
    console.log('[GET /api/accounts] 开始查询')
    const accounts = await Account.getAllAccounts()
    console.log('[GET /api/accounts] 查询成功，账号数:', accounts.length)
    return NextResponse.json({ success: true, data: accounts })
  } catch (err) {
    console.error('[GET /api/accounts] 失败:', err.message, err.stack)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

// POST /api/accounts/auth
export async function POST(request) {
  console.log('[POST /api/accounts/auth] 开始处理')
  try {
    const body = await request.json()
    console.log('[POST /api/accounts/auth] 请求体:', JSON.stringify(body))
    const { name } = body
    if (!name) {
      console.log('[POST /api/accounts/auth] 缺少账号名称')
      return NextResponse.json({ success: false, message: '请提供账号名称' }, { status: 400 })
    }
    console.log('[POST /api/accounts/auth] 开始 OAuth 设备授权流程, 名称:', name)
    const result = await OAuth.completeDeviceFlow(name)
    console.log('[POST /api/accounts/auth] OAuth 结果:', JSON.stringify(result))
    if (result.success) {
      console.log('[POST /api/accounts/auth] 授权流程成功, accountId:', result.accountId)
      return NextResponse.json({ success: true, data: result })
    }
    console.error('[POST /api/accounts/auth] OAuth 失败:', result.error)
    return NextResponse.json({ success: false, message: result.error }, { status: 500 })
  } catch (err) {
    console.error('[POST /api/accounts/auth] 未捕获异常:', err.message)
    console.error('[POST /api/accounts/auth] 堆栈:', err.stack)
    return NextResponse.json({ success: false, message: `服务器内部错误: ${err.message}` }, { status: 500 })
  }
}
