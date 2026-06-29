import type { NextApiRequest, NextApiResponse } from 'next'

import {
  getSessionFromReq,
  hashPassword,
  setSessionCookie,
} from '@flow/reader/server/auth'
import {
  consumeInvite,
  createUser,
  ensureSchema,
  getUserByEmail,
} from '@flow/reader/server/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') return res.status(405).end()
  await ensureSchema()

  const { email, password, code } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid_input' })
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return res.status(400).json({ error: 'invalid_input' })
  }

  // Registration requires a valid invite code, unless an admin creates the
  // account directly. The code is consumed atomically on success.
  const session = await getSessionFromReq(req)
  const isAdmin = session?.role === 'admin'
  if (!isAdmin) {
    if (typeof code !== 'string' || !code) {
      return res.status(403).json({ error: 'invalid_invite' })
    }
    // Reject duplicate email before consuming the code.
    if (await getUserByEmail(email)) {
      return res.status(409).json({ error: 'email_taken' })
    }
    if (!(await consumeInvite(code))) {
      return res.status(403).json({ error: 'invalid_invite' })
    }
  }

  if (await getUserByEmail(email)) {
    return res.status(409).json({ error: 'email_taken' })
  }

  const user = await createUser(email, await hashPassword(password))

  // Sign the new (non-admin-created) user in directly.
  if (!isAdmin) {
    await setSessionCookie(res, {
      sub: user.id,
      email: user.email,
      role: user.role,
    })
  }

  res.json({ user: { email: user.email, role: user.role } })
}
