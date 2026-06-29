import bcrypt from 'bcryptjs'
import type { NextApiRequest, NextApiResponse } from 'next'
import { destroyCookie, setCookie } from 'nookies'

import {
  createUser,
  getSetting,
  getUserByEmail,
  REGISTRATION_OPEN_KEY,
  setSetting,
} from './db'
import { COOKIE_NAME, SessionPayload, signSession, verifySession } from './session'

const SALT_ROUNDS = 10

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

const MAX_AGE = 7 * 24 * 60 * 60

export async function setSessionCookie(
  res: NextApiResponse,
  payload: SessionPayload,
) {
  const token = await signSession(payload)
  setCookie({ res }, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export function clearSessionCookie(res: NextApiResponse) {
  destroyCookie({ res }, COOKIE_NAME, { path: '/' })
}

export async function getSessionFromReq(
  req: NextApiRequest,
): Promise<SessionPayload | null> {
  const token = req.cookies[COOKIE_NAME]
  if (!token) return null
  return verifySession(token)
}

/**
 * On first boot, create the admin user from env and default registration to
 * closed. Idempotent — safe to call on every schema setup.
 */
export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if ((await getSetting(REGISTRATION_OPEN_KEY)) === undefined) {
    await setSetting(REGISTRATION_OPEN_KEY, 'false')
  }

  if (!email || !password) return
  if (await getUserByEmail(email)) return

  await createUser(email, await hashPassword(password), 'admin')
}
