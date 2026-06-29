import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  getR2Bucket,
  getR2Client,
  userProgressKey,
} from '@flow/reader/server/r2'

// Per-user private reading progress / annotations.
export const config = { api: { bodyParser: false } }

function readBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  const Bucket = getR2Bucket()
  const Key = userProgressKey(session.sub)
  const client = getR2Client()

  if (req.method === 'GET') {
    try {
      const out = await client.send(new GetObjectCommand({ Bucket, Key }))
      const text = await out.Body?.transformToString()
      res.setHeader('Content-Type', 'application/json')
      res.send(text ?? '{}')
    } catch (e: any) {
      if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) {
        return res.json({})
      }
      throw e
    }
    return
  }

  if (req.method === 'PUT') {
    const body = await readBody(req)
    await client.send(
      new PutObjectCommand({
        Bucket,
        Key,
        Body: body || '{}',
        ContentType: 'application/json',
      }),
    )
    return res.json({ ok: true })
  }

  res.status(405).end()
}
