import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ user: null })
  res.json({ user: { email: session.email, role: session.role } })
}
