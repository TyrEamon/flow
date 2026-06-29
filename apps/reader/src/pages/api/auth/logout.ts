import type { NextApiRequest, NextApiResponse } from 'next'

import { clearSessionCookie } from '@flow/reader/server/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  clearSessionCookie(res)
  res.json({ ok: true })
}
