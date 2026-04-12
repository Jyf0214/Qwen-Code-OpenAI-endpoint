export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'
import * as OAuth from '@/lib/oauth'

// GET /api/accounts
export async function GET() {
  try {
    const accounts = await Account.getAllAccounts()
    return NextResponse.json({ success: true, data: accounts })
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

// POST /api/accounts/auth
export async function POST(request) {
  try {
    const { name } = await request.json()
    if (!name) return NextResponse.json({ success: false, message: '请提供账号名称' }, { status: 400 })
    const result = await OAuth.completeDeviceFlow(name)
    if (result.success) return NextResponse.json({ success: true, data: result })
    return NextResponse.json({ success: false, message: result.error }, { status: 500 })
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
