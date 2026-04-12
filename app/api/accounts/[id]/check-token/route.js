export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import * as Account from '@/lib/account'
import * as OAuth from '@/lib/oauth'

export async function POST(request, { params }) {
  const { id } = await params
  const result = await OAuth.checkAndStoreToken(id)
  if (result.success) return NextResponse.json({ success: true, data: result })
  return NextResponse.json({ success: false, message: result.error }, { status: 400 })
}
