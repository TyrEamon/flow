import { BookRecord, db } from '../db'

interface SerializedBooks {
  version: number
  dbVersion: number
  books: BookRecord[]
}

const VERSION = 1
export const DATA_FILENAME = 'data.json'

export function serializeData(books?: BookRecord[]) {
  return JSON.stringify({
    version: VERSION,
    dbVersion: db?.verno,
    books,
  })
}

export function deserializeData(text: string) {
  const { version, dbVersion, books } = JSON.parse(text) as SerializedBooks

  if (version < VERSION) {
    // migrate `data.json`
  }
  if (db && dbVersion < db.verno) {
    // migrate `BookRecord`
  }

  return books
}

/** Per-book personal state (kept separate from the shared catalog). */
export type BookProgress = Pick<
  BookRecord,
  | 'cfi'
  | 'percentage'
  | 'definitions'
  | 'annotations'
  | 'configuration'
  | 'updatedAt'
>

/** Map of bookId -> this user's personal progress, for the shared model. */
export function extractProgress(books: BookRecord[]) {
  const map: Record<string, BookProgress> = {}
  for (const b of books) {
    map[b.id] = {
      cfi: b.cfi,
      percentage: b.percentage,
      definitions: b.definitions ?? [],
      annotations: b.annotations ?? [],
      configuration: b.configuration,
      updatedAt: b.updatedAt,
    }
  }
  return map
}

/** Merge a shared catalog with this user's progress into full BookRecords. */
export function mergeProgress(
  catalog: BookRecord[],
  progress: Record<string, BookProgress>,
): BookRecord[] {
  return catalog.map((b) => {
    const p = progress[b.id]
    return {
      ...b,
      cfi: p?.cfi,
      percentage: p?.percentage,
      definitions: p?.definitions ?? [],
      annotations: p?.annotations ?? [],
      configuration: p?.configuration,
      updatedAt: p?.updatedAt,
    }
  })
}
