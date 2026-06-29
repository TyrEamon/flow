import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import { readCatalog } from '@flow/reader/server/r2'

// The shared book catalog (read-only here; maintained by upload/delete).
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  res.json(await readCatalog())
}
