export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import * as Account from '../../../../lib/account.js'

export async function GET() {
  try {
    const account = await Account.getLeastUsedAccount()
    if (!account) {
      return NextResponse.json(
        { error: { message: '没有可用的账号', type: 'no_available_account', code: 503 } },
        { status: 503 }
      )
    }

    const response = await fetch('https://portal.qwen.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${account.accessToken}` }
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: { message: error.message, type: 'api_error', code: 500 } },
      { status: 500 }
    )
  }
}
