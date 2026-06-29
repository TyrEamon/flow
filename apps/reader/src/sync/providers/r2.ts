import { BookRecord } from '../../db'
import { deserializeData, serializeData } from '../serialize'
import { StorageProvider } from '../types'

/**
 * Client-side R2 backend. All requests go to the app's own API routes
 * (cookie-authenticated); the R2 credentials live only on the server.
 */
export const r2Provider: StorageProvider = {
  id: 'r2',
  isConfigured() {
    // Gated by the session; the settings UI handles the login prompt.
    return true
  },
  async list() {
    const res = await fetch('/api/storage/list')
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`)
    return res.json()
  },
  async download(name) {
    const res = await fetch(
      `/api/storage/download?name=${encodeURIComponent(name)}`,
    )
    if (!res.ok) throw new Error(`R2 download ${name} failed: ${res.status}`)
    return res.blob()
  },
  async upload(name, blob) {
    const res = await fetch(
      `/api/storage/upload?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'application/epub+zip' },
        body: blob,
      },
    )
    if (!res.ok) throw new Error(`R2 upload ${name} failed: ${res.status}`)
  },
  async delete(names) {
    const res = await fetch('/api/storage/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    })
    if (!res.ok) throw new Error(`R2 delete failed: ${res.status}`)
  },
  async readData() {
    const res = await fetch('/api/storage/data')
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`R2 readData failed: ${res.status}`)
    return deserializeData(await res.text())
  },
  async writeData(books: BookRecord[]) {
    const res = await fetch('/api/storage/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: serializeData(books),
    })
    if (!res.ok) throw new Error(`R2 writeData failed: ${res.status}`)
  },
}
