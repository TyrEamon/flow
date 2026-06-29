import type { NextApiRequest, NextApiResponse } from 'next'

import {
  getSessionFromReq,
  hashPassword,
  setSessionCookie,
} from '@flow/reader/server/auth'
import {
  createUser,
  ensureSchema,
  getUserByEmail,
  isRegistrationOpen,
} from '@flow/reader/server/db'

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
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return res.status(400).json({ error: 'invalid_input' })
  }

  // Only allow registration when it's open, or when an admin creates the account.
  const session = await getSessionFromReq(req)
  const isAdmin = session?.role === 'admin'
  if (!isAdmin && !(await isRegistrationOpen())) {
    return res.status(403).json({ error: 'registration_closed' })
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
