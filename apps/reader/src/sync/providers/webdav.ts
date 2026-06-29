import { BookRecord } from '../../db'
import { DATA_FILENAME, deserializeData, serializeData } from '../serialize'
import { StorageProvider } from '../types'
import { getWebDAVConfig } from '../webdavConfig'

const BASE_DIR = 'flow'
const FILES_DIR = `${BASE_DIR}/files`

function trimSlashes(s: string) {
  return s.replace(/^\/+|\/+$/g, '')
}

function authHeader(username: string, password: string) {
  // `btoa` only handles latin1; encode utf-8 credentials safely.
  const token =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(`${username}:${password}`)))
      : Buffer.from(`${username}:${password}`).toString('base64')
  return `Basic ${token}`
}

function getClient() {
  const { url, username, password } = getWebDAVConfig()
  const base = url.replace(/\/+$/, '')

  const request = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (username || password) {
      headers.set('Authorization', authHeader(username, password))
    }
    return fetch(`${base}/${trimSlashes(path)}`, { ...init, headers })
  }

  return { base, request }
}

/** Create the `/flow` and `/flow/files` collections, ignoring "already exists". */
async function ensureDirs(request: ReturnType<typeof getClient>['request']) {
  for (const dir of [BASE_DIR, FILES_DIR]) {
    const res = await request(dir, { method: 'MKCOL' })
    // 201 created, 405 already exists, 301/302 some servers on trailing slash
    if (![201, 405, 301, 302].includes(res.status) && res.status >= 400) {
      // 409 can mean a parent is missing; the loop creates parents first so
      // this is unexpected — surface it.
      if (res.status !== 409) {
        throw new Error(`WebDAV MKCOL ${dir} failed: ${res.status}`)
      }
    }
  }
}

function basename(href: string) {
  const decoded = decodeURIComponent(href)
  return trimSlashes(decoded).split('/').pop() ?? ''
}

export const webdavProvider: StorageProvider = {
  id: 'webdav',
  isConfigured() {
    const { url } = getWebDAVConfig()
    return !!url
  },
  async list() {
    const { request } = getClient()
    const res = await request(FILES_DIR, {
      method: 'PROPFIND',
      headers: { Depth: '1' },
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`WebDAV PROPFIND failed: ${res.status}`)

    const text = await res.text()
    const doc = new DOMParser().parseFromString(text, 'application/xml')

    const names: string[] = []
    const responses = Array.from(doc.getElementsByTagName('*')).filter(
      (el) => el.localName === 'response',
    )
    for (const resp of responses) {
      const hrefEl = Array.from(resp.getElementsByTagName('*')).find(
        (el) => el.localName === 'href',
      )
      const isCollection = Array.from(resp.getElementsByTagName('*')).some(
        (el) => el.localName === 'collection',
      )
      if (!hrefEl || isCollection) continue
      const name = basename(hrefEl.textContent ?? '')
      if (name) names.push(name)
    }
    return names.map((name) => ({ name }))
  },
  async download(name) {
    const { request } = getClient()
    const res = await request(`${FILES_DIR}/${encodeURIComponent(name)}`)
    if (!res.ok) throw new Error(`WebDAV GET ${name} failed: ${res.status}`)
    return res.blob()
  },
  async upload(name, blob) {
    const { request } = getClient()
    await ensureDirs(request)
    const res = await request(`${FILES_DIR}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: blob,
    })
    if (!res.ok) throw new Error(`WebDAV PUT ${name} failed: ${res.status}`)
  },
  async delete(names) {
    const { request } = getClient()
    await Promise.all(
      names.map(async (name) => {
        const res = await request(
          `${FILES_DIR}/${encodeURIComponent(name)}`,
          { method: 'DELETE' },
        )
        if (!res.ok && res.status !== 404) {
          throw new Error(`WebDAV DELETE ${name} failed: ${res.status}`)
        }
      }),
    )
  },
  async readData() {
    const { request } = getClient()
    const res = await request(`${BASE_DIR}/${DATA_FILENAME}`)
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`WebDAV GET data failed: ${res.status}`)
    return deserializeData(await res.text())
  },
  async writeData(books: BookRecord[]) {
    const { request } = getClient()
    await ensureDirs(request)
    const res = await request(`${BASE_DIR}/${DATA_FILENAME}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: serializeData(books),
    })
    if (!res.ok) throw new Error(`WebDAV PUT data failed: ${res.status}`)
  },
}
