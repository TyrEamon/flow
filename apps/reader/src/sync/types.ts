import { BookRecord } from '../db'

export interface RemoteFile {
  name: string
}

export type BackendId = 'dropbox' | 'webdav' | 'r2'

/**
 * A pluggable cloud storage backend. Each provider stores book files under a
 * `files/` namespace and reading metadata in a single `data.json`. The path
 * prefixes are an implementation detail of each provider, so callers only deal
 * with bare file names.
 */
export interface StorageProvider {
  id: BackendId
  /**
   * When true, the book catalog (which books exist) is maintained by the
   * backend itself on upload/delete (shared library model). Callers must NOT
   * rebuild/overwrite the catalog from a single client's local view.
   */
  managesCatalogServerSide?: boolean
  /** Whether the backend has enough configuration/credentials to be used. */
  isConfigured(): boolean
  /** List the book files currently stored remotely. */
  list(): Promise<RemoteFile[]>
  /** Download a single book file by name. */
  download(name: string): Promise<Blob>
  /**
   * Upload (overwrite) a single book file. `meta` carries the book record so
   * server-managed catalogs can register it (ignored by per-user backends).
   */
  upload(name: string, blob: Blob, meta?: BookRecord): Promise<void>
  /** Delete book files by name. */
  delete(names: string[]): Promise<void>
  /** Read the synced books (catalog merged with this user's progress). */
  readData(): Promise<BookRecord[]>
  /**
   * Persist the book catalog (metadata: which books exist). No-op for backends
   * that manage the catalog server-side.
   */
  writeCatalog(books: BookRecord[]): Promise<void>
  /** Persist this user's per-book reading progress / annotations. */
  writeProgress(books: BookRecord[]): Promise<void>
}
