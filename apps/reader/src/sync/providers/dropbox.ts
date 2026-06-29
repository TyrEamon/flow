import { Dropbox } from 'dropbox'
import { parseCookies } from 'nookies'

import { BookRecord } from '../../db'
import { readBlob } from '../../file'
import { DATA_FILENAME, deserializeData, serializeData } from '../serialize'
import { StorageProvider } from '../types'

export const mapToToken = {
  dropbox: 'dropbox-refresh-token',
}

export const OAUTH_SUCCESS_MESSAGE = 'oauth_success'

export const dbx = new Dropbox({
  clientId: process.env.NEXT_PUBLIC_DROPBOX_CLIENT_ID,
  refreshToken: '__fake_token__',
})
let _req: Promise<void> | undefined
dbx.auth.refreshAccessToken = () => {
  const cookies = parseCookies()
  const refreshToken = cookies[mapToToken['dropbox']]
  if (!refreshToken) {
    // `reject` to skip subsequent api requests
    return Promise.reject()
  }
  _req ??= fetch(`/api/refresh`)
    .then((res) => res.json())
    .then((data) => {
      dbx.auth.setAccessToken(data.accessToken)
      dbx.auth.setAccessTokenExpiresAt(data.accessTokenExpiresAt)
    })
    .finally(() => {
      // will fail if no refresh token
      _req = undefined
    })
  return _req
}

export const dropboxProvider: StorageProvider = {
  id: 'dropbox',
  isConfigured() {
    return !!parseCookies()[mapToToken['dropbox']]
  },
  list() {
    return dbx
      .filesListFolder({ path: '/files' })
      .then((d) => d.result.entries.map((e) => ({ name: e.name })))
  },
  download(name) {
    return dbx
      .filesDownload({ path: `/files/${name}` })
      .then((d) => (d.result as any).fileBlob as Blob)
  },
  async upload(name, blob, _meta) {
    await dbx.filesUpload({ path: `/files/${name}`, contents: blob })
  },
  async delete(names) {
    await dbx.filesDeleteBatch({
      entries: names.map((name) => ({ path: `/files/${name}` })),
    })
  },
  readData() {
    return dbx
      .filesDownload({ path: `/${DATA_FILENAME}` })
      .then((d) => {
        const blob: Blob = (d.result as any).fileBlob
        return readBlob((r) => r.readAsText(blob))
      })
      .then((d) => deserializeData(d))
  },
  // Per-user backend: catalog and progress live together in one data.json.
  writeCatalog(books: BookRecord[]) {
    return writeData(books)
  },
  writeProgress(books: BookRecord[]) {
    return writeData(books)
  },
}

async function writeData(books: BookRecord[]) {
  await dbx.filesUpload({
    path: `/${DATA_FILENAME}`,
    mode: { '.tag': 'overwrite' },
    contents: serializeData(books),
  })
}
