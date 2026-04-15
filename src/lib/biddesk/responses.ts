import { NextResponse } from 'next/server'
import type { ApiErrorCode } from './contracts'

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status },
  )
}
