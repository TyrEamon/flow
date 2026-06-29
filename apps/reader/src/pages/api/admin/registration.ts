import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  ensureSchema,
  isRegistrationOpen,
  REGISTRATION_OPEN_KEY,
  setSetting,
} from '@flow/reader/server/db'

// Access is gated by middleware (admin-only); we re-check here as defense in
// depth. This route reads/writes the global registration flag.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await ensureSchema()

  const session = await getSessionFromReq(req)
  if (session?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' })
  }

  if (req.method === 'GET') {
    return res.json({ open: await isRegistrationOpen() })
  }

  if (req.method === 'PUT') {
    const { open } = req.body ?? {}
    if (typeof open !== 'boolean') {
      return res.status(400).json({ error: 'invalid_input' })
    }
    await setSetting(REGISTRATION_OPEN_KEY, open ? 'true' : 'false')
    return res.json({ open })
  }

  res.status(405).end()
}
