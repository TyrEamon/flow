import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { COOKIE_NAME, verifySession } from './server/session'

// NOTE: we deliberately do NOT use `config.matcher`. With i18n configured,
// Next 12 injects a mandatory locale segment into string matchers, so
// `/api/storage/*` (which carries no locale prefix) would never match. Instead
// we run on every request and filter by pathname here.
// Next 12 middleware also cannot return a response body, only a status, so we
// send body-less 401/403s. Clients act on the status code.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isStorage = pathname.startsWith('/api/storage')
  const isAdmin = pathname.startsWith('/api/admin')
  if (!isStorage && !isAdmin) return NextResponse.next()

  const raw = req.cookies.get(COOKIE_NAME)
  // Next 12 returns a string; later versions return { value }.
  const token = typeof raw === 'string' ? raw : (raw as any)?.value
  if (!token) return new NextResponse(null, { status: 401 })

  const session = await verifySession(token)
  if (!session) return new NextResponse(null, { status: 401 })

  if (isAdmin && session.role !== 'admin') {
    return new NextResponse(null, { status: 403 })
  }

  return NextResponse.next()
}
