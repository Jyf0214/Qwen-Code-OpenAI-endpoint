import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function POST(request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: '用户名和密码不能为空' },
        { status: 400 }
      )
    }

    if (username.length < 2 || username.length > 50) {
      return NextResponse.json(
        { success: false, message: '用户名长度需在 2-50 个字符之间' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: '密码长度至少 6 个字符' },
        { status: 400 }
      )
    }

    // 检查是否已有用户（仅允许首次注册）
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { success: false, message: '已有管理员账户，请使用登录页面' },
        { status: 403 }
      )
    }

    // 检查用户名是否已被占用（并发安全）
    const existingUser = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: '用户名已被占用' },
        { status: 409 }
      )
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    })

    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const response = NextResponse.json({
      success: true,
      message: '注册成功'
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60
    })

    return response
  } catch (error) {
    console.error('注册失败:', error)
    return NextResponse.json(
      { success: false, message: '注册失败，请重试' },
      { status: 500 }
    )
  }
}
