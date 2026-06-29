import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  getR2Bucket,
  getR2Client,
  readCatalog,
  SHARED_FILES,
  writeCatalog,
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
  if (names.length === 0) return res.json({ deleted: [] })

  const isAdmin = session.role === 'admin'
  const catalog = await readCatalog()

  // Only delete books you uploaded (admins may delete anything; orphan files
  // with no catalog entry are admin-only).
  const allowed = (names as string[]).filter((name) => {
    if (isAdmin) return true
    const entry = catalog.find((b) => b.name === name)
    return !!entry && entry.uploadedBy === session.sub
  })
  if (allowed.length === 0) return res.json({ deleted: [] })

  await getR2Client().send(
    new DeleteObjectsCommand({
      Bucket: getR2Bucket(),
      Delete: {
        Objects: allowed.map((name) => ({ Key: SHARED_FILES + name })),
      },
    }),
  )

  const next = catalog.filter((b) => !allowed.includes(b.name))
  if (next.length !== catalog.length) await writeCatalog(next)

  res.json({ deleted: allowed })
}
