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
  /** Whether the backend has enough configuration/credentials to be used. */
  isConfigured(): boolean
  /** List the book files currently stored remotely. */
  list(): Promise<RemoteFile[]>
  /** Download a single book file by name. */
  download(name: string): Promise<Blob>
  /** Upload (overwrite) a single book file. */
  upload(name: string, blob: Blob): Promise<void>
  /** Delete book files by name. */
  delete(names: string[]): Promise<void>
  /** Read the synced book metadata. */
  readData(): Promise<BookRecord[]>
  /** Write (overwrite) the synced book metadata. */
  writeData(books: BookRecord[]): Promise<void>
}
