export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'

export async function PATCH(request, { params }) {
  const { id } = await params
  const newStatus = await Account.toggleAccountActive(id)
  return NextResponse.json({ success: true, data: { isActive: newStatus, message: newStatus ? '账号已激活' : '账号已停用' } })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  await Account.deleteAccount(id)
  return NextResponse.json({ success: true, message: '账号已删除' })
}

export async function POST(request, { params }) {
  const { id } = await params
  await Account.resetTokenUsage(id)
  return NextResponse.json({ success: true, message: 'Token 使用数据已清除，总调用数已保留' })
}
