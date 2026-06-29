import type { NextApiRequest, NextApiResponse } from 'next'

import { setSessionCookie, verifyPassword } from '@flow/reader/server/auth'
import { ensureSchema, getUserByEmail } from '@flow/reader/server/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') return res.status(405).end()
  await ensureSchema()

  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid_input' })
  }

  const user = await getUserByEmail(email)
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid_credentials' })
  }

  await setSessionCookie(res, {
    sub: user.id,
    email: user.email,
    role: user.role,
  })
  res.json({ user: { email: user.email, role: user.role } })
}
