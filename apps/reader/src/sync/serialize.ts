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
