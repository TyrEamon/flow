import type { BookRecord } from '../db'

const UPLOAD_TIMESTAMP_PREFIX = /^\d{13}_(.+)$/

export function cleanRemoteName(name: string) {
  let clean = name
  let match = UPLOAD_TIMESTAMP_PREFIX.exec(clean)

  while (match?.[1]) {
    clean = match[1]
    match = UPLOAD_TIMESTAMP_PREFIX.exec(clean)
  }

  return clean
}

export function namesMatch(a: string, b: string) {
  return cleanRemoteName(a) === cleanRemoteName(b)
}

function hasUploadPrefix(name: string) {
  return cleanRemoteName(name) !== name
}

function bookTimestamp(book: BookRecord) {
  return book.updatedAt ?? book.createdAt ?? 0
}

function chooseBookRecord(current: BookRecord, candidate: BookRecord) {
  const currentClean = !hasUploadPrefix(current.name)
  const candidateClean = !hasUploadPrefix(candidate.name)

  if (currentClean !== candidateClean) {
    return candidateClean ? candidate : current
  }

  return bookTimestamp(candidate) >= bookTimestamp(current)
    ? candidate
    : current
}

export function cleanBookRecordName(book: BookRecord): BookRecord {
  const name = cleanRemoteName(book.name)
  return name === book.name ? book : { ...book, name }
}

export function dedupeBookRecords(books: BookRecord[]) {
  const byName = new Map<string, BookRecord>()

  for (const book of books) {
    const cleanName = cleanRemoteName(book.name)
    const current = byName.get(cleanName)
    byName.set(cleanName, current ? chooseBookRecord(current, book) : book)
  }

  return [...byName.values()].map(cleanBookRecordName)
}

function uploadTimestamp(name: string) {
  const match = /^(\d{13})_/.exec(name)
  return match?.[1] ? Number(match[1]) : 0
}

export function chooseRemoteName(
  current: string | undefined,
  candidate: string,
) {
  if (!current) return candidate

  const currentTimestamp = uploadTimestamp(current)
  const candidateTimestamp = uploadTimestamp(candidate)

  if (currentTimestamp !== candidateTimestamp) {
    return candidateTimestamp > currentTimestamp ? candidate : current
  }

  if (hasUploadPrefix(current) !== hasUploadPrefix(candidate)) {
    return hasUploadPrefix(candidate) ? candidate : current
  }

  return candidate
}
