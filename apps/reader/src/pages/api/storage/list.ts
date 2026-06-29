import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import { getR2Bucket, getR2Client, SHARED_FILES } from '@flow/reader/server/r2'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  const prefix = SHARED_FILES
  const out = await getR2Client().send(
    new ListObjectsV2Command({ Bucket: getR2Bucket(), Prefix: prefix }),
  )

  const files = (out.Contents ?? [])
    .map((o) => o.Key?.slice(prefix.length))
    .filter((name): name is string => !!name)
    .map((name) => ({ name }))

  res.json(files)
}
