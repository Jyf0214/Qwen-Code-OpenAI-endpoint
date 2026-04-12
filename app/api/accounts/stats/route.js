export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'

export async function GET() {
  try {
    const stats = await Account.getStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
