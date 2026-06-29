import useSWR from 'swr/immutable'

import { DATA_FILENAME, getProvider } from '@flow/reader/sync'

export function useRemoteFiles() {
  return useSWR('/files', () => getProvider().list(), {
    shouldRetryOnError: false,
  })
}

export function useRemoteBooks() {
  return useSWR(`/${DATA_FILENAME}`, () => getProvider().readData(), {
    shouldRetryOnError: false,
  })
}
