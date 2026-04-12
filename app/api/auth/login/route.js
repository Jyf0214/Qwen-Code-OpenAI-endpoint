export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function POST(request) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) return NextResponse.json({ success: false, message: '用户名和密码不能为空' }, { status: 400 })
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) return NextResponse.json({ success: false, message: '用户名或密码错误' }, { status: 401 })
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) return NextResponse.json({ success: false, message: '用户名或密码错误' }, { status: 401 })
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' })
    const response = NextResponse.json({ success: true, message: '登录成功' })
    response.cookies.set('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 })
    return response
  } catch (error) {
    return NextResponse.json({ success: false, message: '登录失败' }, { status: 500 })
  }
}
