import { useLiveQuery } from 'dexie-react-hooks'

import { db } from '../db'
import { dedupeBookRecords } from '../sync/filename'

export function useLibrary() {
  return useLiveQuery(async () =>
    dedupeBookRecords((await db?.books.toArray()) ?? []),
  )
}
