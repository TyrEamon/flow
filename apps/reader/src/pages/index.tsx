import { useBoolean } from '@literal-ui/hooks'
import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdCheckCircle,
  MdOutlineFileDownload,
  MdOutlineShare,
} from 'react-icons/md'
import { useSet } from 'react-use'
import { usePrevious } from 'react-use'

import { ReaderGridView, Button, TextField, DropZone } from '../components'
import { BookRecord, CoverRecord, db } from '../db'
import { addBook, extractPreview, fetchBook, handleFiles } from '../file'
import {
  useAuth,
  useDisablePinchZooming,
  useLibrary,
  useMobile,
  useRemoteBooks,
  useRemoteFiles,
  useTranslation,
} from '../hooks'
import { reader, useReaderSnapshot } from '../models'
import { lock } from '../styles'
import { getProvider, pack } from '../sync'
import { copy } from '../utils'

const placeholder = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="gray" fill-opacity="0" width="1" height="1"/></svg>`

const SOURCE = 'src'

export default function Index() {
  const { focusedTab } = useReaderSnapshot()
  const router = useRouter()
  const src = new URL(window.location.href).searchParams.get(SOURCE)
  const [loading, setLoading] = useState(!!src)

  useDisablePinchZooming()

  useEffect(() => {
    let src = router.query[SOURCE]
    if (!src) return
    if (!Array.isArray(src)) src = [src]

    Promise.all(
      src.map((s) =>
        fetchBook(s).then((b) => {
          reader.addTab(b)
        }),
      ),
    ).finally(() => setLoading(false))
  }, [router.query])

  useEffect(() => {
    if ('launchQueue' in window && 'LaunchParams' in window) {
      window.launchQueue.setConsumer((params) => {
        console.log('launchQueue', params)
        if (params.files.length) {
          Promise.all(params.files.map((f) => f.getFile()))
            .then((files) => handleFiles(files))
            .then((books) => books.forEach((b) => reader.addTab(b)))
        }
      })
    }
  }, [])

  useEffect(() => {
    router.beforePopState(({ url }) => {
      if (url === '/') {
        reader.clear()
      }
      return true
    })
  }, [router])

  return (
    <>
      <Head>
        {/* https://github.com/microsoft/vscode/blob/36fdf6b697cba431beb6e391b5a8c5f3606975a1/src/vs/code/browser/workbench/workbench.html#L16 */}
        {/* Disable pinch zooming */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no"
        />
        <title>{focusedTab?.title ?? 'Flow'}</title>
      </Head>
      <ReaderGridView />
      {loading || <Library />}
    </>
  )
}

const DISC_PREFIX = 'disc:webdav:'

/** A normalized item for the library grid: either a real local book record or
 * a "discovered" remote file that hasn't been imported yet (placeholder). */
interface DisplayBook {
  id: string
  name: string
  title: string
  isRemote: boolean
  book?: BookRecord
}

const Library: React.FC = () => {
  const books = useLibrary()
  const covers = useLiveQuery(() => db?.covers.toArray() ?? [])
  const t = useTranslation('home')

  const { data: remoteBooks, mutate: mutateRemoteBooks } = useRemoteBooks()
  const { data: remoteFiles, mutate: mutateRemoteFiles } = useRemoteFiles()
  const previousRemoteBooks = usePrevious(remoteBooks)
  const previousRemoteFiles = usePrevious(remoteFiles)

  const [select, toggleSelect] = useBoolean(false)
  const [selectedBookIds, { add, has, toggle, reset }] = useSet<string>()

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [discoveredTitles, setDiscoveredTitles] = useState<
    Record<string, string>
  >({})
  const [page, setPage] = useState(0)

  const mobile = useMobile()
  const pageSize = mobile ? 9 : 30

  const { groups } = useReaderSnapshot()
  const { user, isAdmin } = useAuth()

  const startLoading = (id: string) => setLoadingIds((s) => new Set(s).add(id))
  const stopLoading = (id: string) =>
    setLoadingIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })

  useEffect(() => {
    // Shared backends (R2) maintain the catalog server-side on upload/delete,
    // so a single client must not overwrite it from its local view.
    if (getProvider().managesCatalogServerSide) return
    if (previousRemoteFiles && remoteFiles) {
      // to remove effect dependency `books`
      db?.books.toArray().then((books) => {
        if (books.length === 0) return

        const newRemoteBooks = remoteFiles
          .map((f) => books.find((b) => b.name === f.name))
          .filter(Boolean) as BookRecord[]

        getProvider().writeCatalog(newRemoteBooks)
        mutateRemoteBooks(newRemoteBooks, { revalidate: false })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutateRemoteBooks, remoteFiles])

  useEffect(() => {
    if (!previousRemoteBooks && remoteBooks) {
      db?.books.bulkPut(remoteBooks)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteBooks])

  useEffect(() => {
    if (!select) reset()
  }, [reset, select])

  // Merged, stably-sorted list: local books + discovered remote files (files
  // present remotely but not yet in the local catalog — e.g. dropped straight
  // into a WebDAV folder). Discovered items stay out of `db.books` until opened.
  const items = useMemo<DisplayBook[]>(() => {
    const localBooks = books ?? []
    const localNames = new Set(localBooks.map((b) => b.name))
    const placeholders = (remoteFiles ?? [])
      .filter((f) => !localNames.has(f.name))
      .map<DisplayBook>((f) => ({
        id: DISC_PREFIX + f.name,
        name: f.name,
        title: discoveredTitles[f.name] ?? f.name,
        isRemote: true,
      }))
    const locals = localBooks.map<DisplayBook>((b) => ({
      id: b.id,
      name: b.name,
      title: b.name,
      isRemote: false,
      book: b,
    }))
    return [...locals, ...placeholders].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }, [books, remoteFiles, discoveredTitles])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = items.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  )

  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1)
  }, [page, totalPages])

  // Lazily fetch covers for the CURRENT page only. Books live remotely; to show
  // a cover we must download & parse the epub (the cover is inside the zip), so
  // we do it page-by-page, parse the cover, then discard the file blob. Opening
  // a book (below) is what actually stores it locally.
  const attempted = useRef<Set<string>>(new Set())
  useEffect(() => {
    const provider = getProvider()
    if (!provider.isConfigured?.()) return

    const pending = pageItems.filter((item) => {
      if (covers?.some((c) => c.id === item.id && c.cover)) return false
      if (attempted.current.has(item.id)) return false
      return true
    })
    if (!pending.length) return

    let cancelled = false
    const queue = [...pending]
    const work = async () => {
      while (queue.length && !cancelled) {
        const item = queue.shift()!
        attempted.current.add(item.id)
        startLoading(item.id)
        try {
          const blob = await provider.download(item.name)
          const { cover, metadata } = await extractPreview(
            new File([blob], item.name),
          )
          await db?.covers.put({ id: item.id, cover })
          if (item.isRemote && metadata?.title) {
            setDiscoveredTitles((m) => ({ ...m, [item.name]: metadata.title }))
          }
        } catch (e) {
          console.error('cover preview failed:', item.name, e)
        } finally {
          stopLoading(item.id)
        }
      }
    }
    // limit concurrency to avoid hammering the WebDAV/R2 endpoint
    Promise.all(Array.from({ length: 4 }, work))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage, pageSize, remoteFiles, covers])

  if (groups.length) return null
  if (!books) return null

  const selectedBooks = [...selectedBookIds].map(
    (id) => books.find((b) => b.id === id)!,
  )
  const allSelected = !!books.length && selectedBookIds.size === books.length

  const openBook = async (item: DisplayBook) => {
    if (item.book) {
      // local record; file (if missing) is fetched on render
      reader.addTab(item.book)
      return
    }
    // discovered placeholder: download now, import into the library, then open
    startLoading(item.id)
    try {
      const blob = await getProvider().download(item.name)
      const book = await addBook(new File([blob], item.name))
      mutateRemoteFiles()
      reader.addTab(book)
    } catch (e) {
      console.error('failed to open remote book:', item.name, e)
    } finally {
      stopLoading(item.id)
    }
  }

  return (
    <DropZone
      className="scroll-parent h-full p-4"
      onDrop={(e) => {
        const bookId = e.dataTransfer.getData('text/plain')
        const book = books.find((b) => b.id === bookId)
        if (book) reader.addTab(book)

        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="mb-4 space-y-2.5">
        <div>
          <TextField
            name={SOURCE}
            placeholder="https://link.to/remote.epub"
            type="url"
            hideLabel
            actions={[
              {
                title: t('share'),
                Icon: MdOutlineShare,
                onClick(el) {
                  if (el?.reportValidity()) {
                    copy(`${window.location.origin}/?${SOURCE}=${el.value}`)
                  }
                },
              },
              {
                title: t('download'),
                Icon: MdOutlineFileDownload,
                onClick(el) {
                  if (el?.reportValidity()) fetchBook(el.value)
                },
              },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-x-2">
            {books.length ? (
              <Button variant="secondary" onClick={toggleSelect}>
                {t(select ? 'cancel' : 'select')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={!books}
                onClick={() => {
                  fetchBook(
                    'https://epubtest.org/books/Fundamental-Accessibility-Tests-Basic-Functionality-v1.0.0.epub',
                  )
                }}
              >
                {t('download_sample_book')}
              </Button>
            )}
            {select &&
              (allSelected ? (
                <Button variant="secondary" onClick={reset}>
                  {t('deselect_all')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => books.forEach((b) => add(b.id))}
                >
                  {t('select_all')}
                </Button>
              ))}
          </div>

          <div className="space-x-2">
            {select ? (
              <>
                <Button
                  onClick={async () => {
                    toggleSelect()

                    for (const book of selectedBooks) {
                      const remoteFile = remoteFiles?.find(
                        (f) => f.name === book.name,
                      )
                      if (remoteFile) continue

                      const file = await db?.files.get(book.id)
                      if (!file) continue

                      startLoading(book.id)
                      await getProvider().upload(book.name, file.file, {
                        ...book,
                        uploadedBy: user?.id,
                      })
                      stopLoading(book.id)

                      mutateRemoteFiles()
                    }
                  }}
                >
                  {t('upload')}
                </Button>
                <Button
                  onClick={async () => {
                    toggleSelect()

                    // In a shared library you may only delete your own uploads
                    // (admins may delete anything). Per-user backends: all.
                    const shared = getProvider().managesCatalogServerSide
                    const deletableBooks = selectedBooks.filter(
                      (b) => !shared || isAdmin || b.uploadedBy === user?.id,
                    )
                    if (!deletableBooks.length) return

                    const bookIds = deletableBooks.map((b) => b.id)
                    db?.books.bulkDelete(bookIds)
                    db?.covers.bulkDelete(bookIds)
                    db?.files.bulkDelete(bookIds)

                    // folder data is not updated after `filesDeleteBatch`
                    mutateRemoteFiles(
                      async (data) => {
                        await getProvider().delete(
                          deletableBooks.map((b) => b.name),
                        )
                        return data?.filter(
                          (f) => !deletableBooks.find((b) => b.name === f.name),
                        )
                      },
                      { revalidate: false },
                    )
                  }}
                >
                  {t('delete')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    // re-scan the remote folder & re-attempt covers
                    attempted.current.clear()
                    mutateRemoteFiles()
                  }}
                >
                  {t('refresh')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!books.length}
                  onClick={pack}
                >
                  {t('export')}
                </Button>
                <Button className="relative">
                  <input
                    type="file"
                    accept="application/epub+zip,application/epub,application/zip"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => {
                      const files = e.target.files
                      if (files) handleFiles(files)
                    }}
                    multiple
                  />
                  {t('import')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="scroll h-full">
        <ul
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(calc(80px + 3vw), 1fr))`,
            columnGap: lock(16, 32),
            rowGap: lock(24, 40),
          }}
        >
          {pageItems.map((item) => (
            <Book
              key={item.id}
              item={item}
              covers={covers}
              remoteFiles={remoteFiles}
              select={select && !item.isRemote}
              selected={has(item.id)}
              loading={loadingIds.has(item.id)}
              onToggle={() => toggle(item.id)}
              onOpen={() => openBook(item)}
            />
          ))}
        </ul>
        {totalPages > 1 && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onChange={setPage}
          />
        )}
      </div>
    </DropZone>
  )
}

interface BookProps {
  item: DisplayBook
  covers?: CoverRecord[]
  remoteFiles?: { name: string }[]
  select?: boolean
  selected?: boolean
  loading?: boolean
  onToggle: () => void
  onOpen: () => void
}
const Book: React.FC<BookProps> = ({
  item,
  covers,
  remoteFiles,
  select,
  selected,
  loading,
  onToggle,
  onOpen,
}) => {
  const router = useRouter()
  const mobile = useMobile()

  const cover = covers?.find((c) => c.id === item.id)?.cover
  const percentage = item.book?.percentage
  const synced =
    item.isRemote || !!remoteFiles?.find((f) => f.name === item.name)

  const Icon = selected ? MdCheckBox : MdCheckBoxOutlineBlank

  return (
    <div className="relative flex flex-col">
      <div
        role="button"
        className="border-inverse-on-surface relative border"
        onClick={async () => {
          if (select) {
            onToggle()
          } else {
            if (mobile) await router.push('/_')
            onOpen()
          }
        }}
      >
        <div
          className={clsx(
            'absolute bottom-0 h-1 bg-blue-500',
            loading && 'progress-bit w-[5%]',
          )}
        />
        {percentage !== undefined && (
          <div className="typescale-body-large absolute right-0 bg-gray-500/60 px-2 text-gray-100">
            {(percentage * 100).toFixed()}%
          </div>
        )}
        <img
          src={cover ?? placeholder}
          alt="Cover"
          className="mx-auto aspect-[9/12] object-cover"
          draggable={false}
        />
        {select && (
          <div className="absolute bottom-1 right-1">
            <Icon
              size={24}
              className={clsx(
                '-m-1',
                selected ? 'text-tertiary' : 'text-outline',
              )}
            />
          </div>
        )}
      </div>

      <div
        className="line-clamp-2 text-on-surface-variant typescale-body-small lg:typescale-body-medium mt-2 w-full"
        title={item.title}
      >
        <MdCheckCircle
          className={clsx(
            'mr-1 mb-0.5 inline',
            synced ? 'text-tertiary' : 'text-surface-variant',
          )}
          size={16}
        />
        {item.title}
      </div>
    </div>
  )
}

/** Compact page navigation with first/last + a small window of page numbers. */
interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}
const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onChange,
}) => {
  // window of pages around the current one
  const window = 1
  const pages: number[] = []
  for (
    let i = Math.max(0, page - window);
    i <= Math.min(totalPages - 1, page + window);
    i++
  ) {
    pages.push(i)
  }
  const first = pages[0]!
  const last = pages[pages.length - 1]!

  const btn = (p: number, label?: string, key?: string) => (
    <button
      key={key ?? p}
      onClick={() => onChange(p)}
      className={clsx(
        'typescale-body-small min-w-[28px] rounded px-2 py-1',
        p === page
          ? 'bg-tertiary text-on-tertiary'
          : 'text-on-surface-variant hover:bg-surface-variant',
      )}
    >
      {label ?? p + 1}
    </button>
  )

  return (
    <div className="my-6 flex items-center justify-center gap-1">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="typescale-body-small text-on-surface-variant disabled:text-surface-variant px-2 py-1"
      >
        ‹
      </button>
      {first > 0 && (
        <>
          {btn(0)}
          {first > 1 && <span className="text-surface-variant px-1">…</span>}
        </>
      )}
      {pages.map((p) => btn(p))}
      {last < totalPages - 1 && (
        <>
          {last < totalPages - 2 && (
            <span className="text-surface-variant px-1">…</span>
          )}
          {btn(totalPages - 1)}
        </>
      )}
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        className="typescale-body-small text-on-surface-variant disabled:text-surface-variant px-2 py-1"
      >
        ›
      </button>
      <span className="typescale-body-small text-on-surface-variant ml-2">
        {page + 1} / {totalPages}
      </span>
    </div>
  )
}
