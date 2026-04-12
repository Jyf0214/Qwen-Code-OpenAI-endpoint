import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export function proxy(request) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  // 登录页和注册页不需要验证
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.next()
  }

  // 认证 API 不需要 JWT
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // 没有 token 重定向到登录页
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET)
    return NextResponse.next()
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
