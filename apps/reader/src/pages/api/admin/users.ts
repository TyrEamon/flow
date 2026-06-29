import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import { deleteUser, ensureSchema, listUsers } from '@flow/reader/server/db'
import {
  getR2Bucket,
  getR2Client,
  userProgressKey,
} from '@flow/reader/server/r2'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await ensureSchema()
  const session = await getSessionFromReq(req)
  if (session?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' })
  }

  if (req.method === 'GET') {
    return res.json({ users: await listUsers() })
  }

  if (req.method === 'DELETE') {
    const id = req.query.id
    if (typeof id !== 'string') {
      return res.status(400).json({ error: 'invalid_input' })
    }
    if (id === session.sub) {
      return res.status(400).json({ error: 'cannot_delete_self' })
    }
    await deleteUser(id)
    // Best-effort: remove the user's private progress object.
    try {
      await getR2Client().send(
        new DeleteObjectCommand({
          Bucket: getR2Bucket(),
          Key: userProgressKey(id),
        }),
      )
    } catch {
      /* ignore */
    }
    return res.json({ ok: true })
  }

  res.status(405).end()
}
