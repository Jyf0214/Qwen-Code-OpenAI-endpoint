export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const count = await prisma.user.count()
    return NextResponse.json({ success: true, hasUsers: count > 0, userCount: count })
  } catch (error) {
    return NextResponse.json({ success: false, message: '检查失败' }, { status: 500 })
  }
}
