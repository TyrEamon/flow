import { v4 as uuidv4 } from 'uuid'

import ePub, { Book } from '@flow/epubjs'

import { BookRecord, db } from './db'
import { mapExtToMimes } from './mime'
import { unpack } from './sync'
import {
  cleanBookRecordName,
  cleanRemoteName,
  namesMatch,
} from './sync/filename'

export async function fileToEpub(file: File) {
  const data = await file.arrayBuffer()
  return ePub(data)
}

export async function handleFiles(files: Iterable<File>) {
  const books = await db?.books.toArray()
  const newBooks = []

  for (const file of files) {
    console.log(file)

    if (mapExtToMimes['.zip'].includes(file.type)) {
      unpack(file)
      continue
    }

    if (!mapExtToMimes['.epub'].includes(file.type)) {
      console.error(`Unsupported file type: ${file.type}`)
      continue
    }

    let book = books?.find((b) => namesMatch(b.name, file.name))
    if (book) {
      const cleanBook = cleanBookRecordName(book)
      if (cleanBook.name !== book.name) db?.books.update(book.id, cleanBook)
      book = cleanBook
    }

    if (!book) {
      book = await addBook(file)
    }

    newBooks.push(book)
  }

  return newBooks
}

export async function addBook(file: File) {
  const epub = await fileToEpub(file)
  const metadata = await epub.loaded.metadata

  const book: BookRecord = {
    id: uuidv4(),
    name: cleanRemoteName(file.name || `${metadata.title}.epub`),
    size: file.size,
    metadata,
    createdAt: Date.now(),
    definitions: [],
    annotations: [],
  }
  db?.books.add(book)
  addFile(book.id, file, epub)
  return book
}

export async function addFile(id: string, file: File, epub?: Book) {
  // `put` (not `add`) so re-adding a file/cover is idempotent — the library's
  // lazy cover preview may already have written a cover under this id.
  db?.files.put({ id, file })

  if (!epub) {
    epub = await fileToEpub(file)
  }

  const url = await epub.coverUrl()
  const cover = url && (await toDataUrl(url))
  db?.covers.put({ id, cover })
}

/**
 * Parse an epub and return its cover (data URL) and metadata, WITHOUT storing
 * the file or creating a book record. Used to lazily preview covers/titles for
 * books that live remotely (shared R2 catalog / discovered WebDAV files)
 * without filling local storage — the file blob is discarded afterwards.
 */
export async function extractPreview(file: File) {
  const epub = await fileToEpub(file)
  const [url, metadata] = await Promise.all([
    epub.coverUrl(),
    epub.loaded.metadata,
  ])
  const cover = url ? await toDataUrl(url) : null
  return { cover, metadata }
}

export function readBlob(fn: (reader: FileReader) => void) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(reader.result as string)
    })
    fn(reader)
  })
}

async function toDataUrl(url: string) {
  const res = await fetch(url)
  const buffer = await res.blob()
  return readBlob((r) => r.readAsDataURL(buffer))
}

export async function fetchBook(url: string) {
  const filename = cleanRemoteName(
    decodeURIComponent(/\/([^/]*\.epub)$/i.exec(url)?.[1] ?? ''),
  )
  const books = await db?.books.toArray()
  const book = books?.find((b) => namesMatch(b.name, filename))
  if (book) {
    const cleanBook = cleanBookRecordName(book)
    if (cleanBook.name !== book.name) db?.books.update(book.id, cleanBook)
    return cleanBook
  }

  return fetch(url)
    .then((res) => res.blob())
    .then((blob) => addBook(new File([blob], filename)))
}
