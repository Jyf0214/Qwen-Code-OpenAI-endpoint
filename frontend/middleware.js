import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export function middleware(request) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  // 登录页不需要验证
  if (pathname === '/login') {
    return NextResponse.next()
  }

  // API 路由不需要 JWT（使用 API_SECRET）
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // 没有 token 重定向到登录页
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // 验证 token
    jwt.verify(token, process.env.JWT_SECRET || 'change-this-to-random-secret')
    return NextResponse.next()
  } catch (error) {
    // token 无效，重定向到登录页
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
