import { randomBytes } from 'crypto'

import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  createInvite,
  deleteInvite,
  ensureSchema,
  listInvites,
} from '@flow/reader/server/db'

function randomCode() {
  // Readable 8-char code (no ambiguous chars).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let s = ''
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i]! % alphabet.length]
  return s
}

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
    return res.json({ invites: await listInvites() })
  }

  if (req.method === 'POST') {
    const { code, maxUses } = req.body ?? {}
    const finalCode =
      typeof code === 'string' && code.trim() ? code.trim() : randomCode()
    const uses =
      typeof maxUses === 'number' && maxUses > 0 ? Math.floor(maxUses) : 1
    try {
      const invite = await createInvite(finalCode, uses)
      return res.json({ invite })
    } catch {
      return res.status(409).json({ error: 'code_exists' })
    }
  }

  if (req.method === 'DELETE') {
    const code = req.query.code
    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'invalid_input' })
    }
    await deleteInvite(code)
    return res.json({ ok: true })
  }

  res.status(405).end()
}
