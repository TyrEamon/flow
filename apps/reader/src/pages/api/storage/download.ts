import { GetObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import { getR2Bucket, getR2Client, SHARED_FILES } from '@flow/reader/server/r2'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  const name = req.query.name
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'invalid_input' })
  }

  try {
    const out = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: SHARED_FILES + name,
      }),
    )
    const bytes = await out.Body?.transformToByteArray()
    if (!bytes) return res.status(404).end()

    res.setHeader('Content-Type', out.ContentType || 'application/epub+zip')
    res.send(Buffer.from(bytes))
  } catch (e: any) {
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
      return res.status(404).end()
    }
    throw e
  }
}
