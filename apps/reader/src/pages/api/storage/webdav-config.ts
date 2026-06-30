import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromReq } from '@flow/reader/server/auth'
import {
  ensureSchema,
  getUserSetting,
  setUserSetting,
} from '@flow/reader/server/db'

const KEY = 'webdav'

// Per-user WebDAV config (url/username/password/directory), synced across the
// user's devices. Gated by middleware (login required); re-checked here.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await ensureSchema()
  const session = await getSessionFromReq(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const raw = await getUserSetting(session.sub, KEY)
    let config = null
    if (raw) {
      try {
        config = JSON.parse(raw)
      } catch {
        config = null
      }
    }
    return res.json({ config })
  }

  if (req.method === 'PUT') {
    const { url, username, password, directory } = req.body ?? {}
    const config = {
      url: typeof url === 'string' ? url : '',
      username: typeof username === 'string' ? username : '',
      password: typeof password === 'string' ? password : '',
      directory: typeof directory === 'string' ? directory : '',
    }
    await setUserSetting(session.sub, KEY, JSON.stringify(config))
    return res.json({ ok: true })
  }

  res.status(405).end()
}
