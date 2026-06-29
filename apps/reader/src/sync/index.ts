import { dropboxProvider } from './providers/dropbox'
import { r2Provider } from './providers/r2'
import { webdavProvider } from './providers/webdav'
import { BackendId, StorageProvider } from './types'

const BACKEND_KEY = 'storage-backend'

export function getBackendId(): BackendId {
  if (typeof localStorage === 'undefined') return 'dropbox'
  return (localStorage.getItem(BACKEND_KEY) as BackendId) || 'dropbox'
}

export function setBackendId(id: BackendId) {
  localStorage.setItem(BACKEND_KEY, id)
}

export function getProvider(): StorageProvider {
  switch (getBackendId()) {
    case 'webdav':
      return webdavProvider
    case 'r2':
      return r2Provider
    case 'dropbox':
    default:
      return dropboxProvider
  }
}

export type { BackendId, RemoteFile, StorageProvider } from './types'
export { pack, unpack } from './backup'
export {
  DATA_FILENAME,
  serializeData,
  deserializeData,
} from './serialize'
// Back-compat re-exports for Dropbox OAuth call sites.
export { dbx, mapToToken, OAUTH_SUCCESS_MESSAGE } from './providers/dropbox'
export {
  getWebDAVConfig,
  setWebDAVConfig,
  emptyWebDAVConfig,
} from './webdavConfig'
export type { WebDAVConfig } from './webdavConfig'
