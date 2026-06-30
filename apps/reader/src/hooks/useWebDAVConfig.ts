import { useCallback, useEffect, useRef } from 'react'
import useSWR, { useSWRConfig } from 'swr'

import {
  getWebDAVConfig,
  setWebDAVConfig,
  WebDAVConfig,
} from '@flow/reader/sync'

import { useAuth } from './useAuth'

async function fetcher(url: string): Promise<WebDAVConfig | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.config ?? null
}

/**
 * Syncs the WebDAV config (url/username/password/directory) with the logged-in
 * account so it follows the user across devices. On login the server config is
 * pulled into localStorage (where the provider reads it) and the book list is
 * re-fetched; `save` writes locally AND uploads to the server.
 */
export function useWebDAVConfig() {
  const { user } = useAuth()
  const { mutate: globalMutate } = useSWRConfig()
  const { data: remoteConfig, mutate } = useSWR(
    user ? '/api/storage/webdav-config' : null,
    fetcher,
    { shouldRetryOnError: false },
  )

  // Apply the server config to local storage once after it arrives, then make
  // the library re-list with the now-configured backend.
  const applied = useRef(false)
  useEffect(() => {
    if (remoteConfig === undefined || applied.current) return
    applied.current = true
    if (!remoteConfig?.url) return

    const local = getWebDAVConfig()
    if (JSON.stringify(remoteConfig) !== JSON.stringify(local)) {
      setWebDAVConfig({ ...local, ...remoteConfig })
      // re-run `provider.list()` now that WebDAV is configured
      globalMutate('/files')
    }
  }, [remoteConfig, globalMutate])

  const save = useCallback(
    async (config: WebDAVConfig) => {
      setWebDAVConfig(config)
      if (!user) return
      await fetch('/api/storage/webdav-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      mutate(config, { revalidate: false })
    },
    [user, mutate],
  )

  return { remoteConfig, save }
}
