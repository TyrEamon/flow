import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  FILES_PREFIX,
  getR2Bucket,
  getR2Client,
  userKey,
} from '@flow/reader/server/r2'

// Stream the raw epub binary instead of letting Next parse it as JSON.
export const config = { api: { bodyParser: false } }

function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') return res.status(405).end()
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  const name = req.query.name
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'invalid_input' })
  }

  const body = await readBody(req)
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: userKey(session.sub, FILES_PREFIX + name),
      Body: body,
      ContentType:
        (req.headers['content-type'] as string) || 'application/epub+zip',
    }),
  )

  res.json({ ok: true })
}
