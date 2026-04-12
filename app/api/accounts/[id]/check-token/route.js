export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'
import * as OAuth from '@/lib/oauth'

export async function POST(request, context) {
  try {
    const params = await context.params
    const id = params.id
    if (!id) return NextResponse.json({ success: false, message: '缺少账号 ID' }, { status: 400 })
    const result = await OAuth.checkAndStoreToken(id)
    if (result.success) return NextResponse.json({ success: true, data: result })
    return NextResponse.json({ success: false, message: result.error }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message || '检查失败' }, { status: 500 })
  }
}
