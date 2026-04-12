export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'
import * as OAuth from '@/lib/oauth'

export async function POST(request, context) {
  try {
    const params = await context.params
    const id = params.id
    if (!id) return NextResponse.json({ success: false, message: '缺少账号 ID' }, { status: 400 })
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
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message || '刷新失败' }, { status: 500 })
  }
}
