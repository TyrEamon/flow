import { PutObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  CatalogEntry,
  getR2Bucket,
  getR2Client,
  readCatalog,
  SHARED_FILES,
  writeCatalog,
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

function parseMeta(raw: unknown): CatalogEntry | undefined {
  if (typeof raw !== 'string') return undefined
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
    return json
  } catch {
    return undefined
  }
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
      Key: SHARED_FILES + name,
      Body: body,
      ContentType:
        (req.headers['content-type'] as string) || 'application/epub+zip',
    }),
  )

  // Register the book in the shared catalog (server stamps the uploader).
  const meta = parseMeta(req.query.meta)
  if (meta?.id) {
    const entry: CatalogEntry = {
      id: meta.id,
      name: meta.name ?? name,
      size: meta.size ?? body.length,
      metadata: meta.metadata,
      createdAt: meta.createdAt ?? Date.now(),
      uploadedBy: session.sub,
    }
    const catalog = await readCatalog()
    const i = catalog.findIndex((b) => b.id === entry.id)
    if (i >= 0) catalog[i] = { ...catalog[i], ...entry }
    else catalog.push(entry)
    await writeCatalog(catalog)
  }

  res.json({ ok: true })
}
