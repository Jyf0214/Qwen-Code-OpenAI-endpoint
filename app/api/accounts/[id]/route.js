export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import * as Account from '../../../lib/account.js'
import * as OAuth from '../../../lib/oauth.js'

// POST /api/accounts/[id]/check-token
export async function POST(request, { params }) {
  const { id } = params
  const result = await OAuth.checkAndStoreToken(id)
  if (result.success) return NextResponse.json({ success: true, data: result })
  return NextResponse.json({ success: false, message: result.error }, { status: 400 })
}

// POST /api/accounts/[id]/refresh
export async function POST(request, { params }) {
  const { id } = params
  const account = await Account.getAccountById(id)
  if (!account) return NextResponse.json({ success: false, message: '账号不存在' }, { status: 404 })
  if (!account.refreshToken) return NextResponse.json({ success: false, message: '需要重新授权' }, { status: 400 })
  const result = await OAuth.refreshToken(account.refreshToken)
  if (result.success) {
    const expiresAt = new Date(Date.now() + result.expiresIn * 1000)
    await Account.updateAccountTokens(id, { accessToken: result.accessToken, refreshToken: result.refreshToken, tokenType: result.tokenType, expiresAt, scope: result.scope })
    return NextResponse.json({ success: true, data: { message: 'Token 刷新成功', expiresAt } })
  }
  return NextResponse.json({ success: false, message: result.error, needReauth: result.needReauth }, { status: 400 })
}

// PATCH /api/accounts/[id]/toggle
export async function PATCH(request, { params }) {
  const { id } = params
  const newStatus = await Account.toggleAccountActive(id)
  return NextResponse.json({ success: true, data: { isActive: newStatus, message: newStatus ? '账号已激活' : '账号已停用' } })
}

// DELETE /api/accounts/[id]
export async function DELETE(request, { params }) {
  const { id } = params
  await Account.deleteAccount(id)
  return NextResponse.json({ success: true, message: '账号已删除' })
}

// POST /api/accounts/[id]/reset-tokens
export async function POST(request, { params }) {
  const { id } = params
  await Account.resetTokenUsage(id)
  return NextResponse.json({ success: true, message: 'Token 使用数据已清除，总调用数已保留' })
}
