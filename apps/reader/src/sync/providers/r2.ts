import { BookRecord } from '../../db'
import { BookProgress, extractProgress, mergeProgress } from '../serialize'
import { StorageProvider } from '../types'

/**
 * Client-side R2 backend (shared community library). All requests go to the
 * app's own API routes (cookie-authenticated); R2 credentials live only on the
 * server. Book files + catalog are SHARED across users; reading progress is
 * private per user. The server maintains the catalog on upload/delete.
 */
export const r2Provider: StorageProvider = {
  id: 'r2',
  managesCatalogServerSide: true,
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
  async upload(name, blob, meta) {
    const qs = new URLSearchParams({ name })
    if (meta) {
      qs.set(
        'meta',
        // utf-8 safe base64 of the book metadata
        btoa(unescape(encodeURIComponent(JSON.stringify(meta)))),
      )
    }
    const res = await fetch(`/api/storage/upload?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/epub+zip' },
      body: blob,
    })
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
    const [catalogRes, progressRes] = await Promise.all([
      fetch('/api/storage/catalog'),
      fetch('/api/storage/progress'),
    ])
    if (!catalogRes.ok && catalogRes.status !== 404) {
      throw new Error(`R2 catalog failed: ${catalogRes.status}`)
    }
    const catalog: BookRecord[] =
      catalogRes.status === 404 ? [] : await catalogRes.json()
    const progress: Record<string, BookProgress> = progressRes.ok
      ? await progressRes.json()
      : {}
    return mergeProgress(catalog, progress)
  },
  // Catalog is maintained server-side via upload/delete.
  async writeCatalog() {
    /* no-op */
  },
  async writeProgress(books: BookRecord[]) {
    const res = await fetch('/api/storage/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extractProgress(books)),
    })
    if (!res.ok) throw new Error(`R2 writeProgress failed: ${res.status}`)
  },
}
