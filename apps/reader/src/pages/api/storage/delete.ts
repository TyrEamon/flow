import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  FILES_PREFIX,
  getR2Bucket,
  getR2Client,
  userKey,
} from '@flow/reader/server/r2'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  const names: unknown = req.body?.names
  if (!Array.isArray(names) || names.some((n) => typeof n !== 'string')) {
    return res.status(400).json({ error: 'invalid_input' })
  }
  if (names.length === 0) return res.json({ ok: true })

  await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: getR2Bucket(),
      Delete: {
        Objects: names.map((name: string) => ({
          Key: userKey(session.sub, FILES_PREFIX + name),
        })),
      },
    }),
  )

  res.json({ ok: true })
}
