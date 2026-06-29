import { useCallback } from 'react'
import useSWR from 'swr'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
}

async function meFetcher(url: string): Promise<AuthUser | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.user ?? null
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'request_failed')
  return data
}

export function useAuth() {
  const {
    data: user,
    mutate,
    isValidating,
  } = useSWR('/api/auth/me', meFetcher, { shouldRetryOnError: false })

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await post('/api/auth/login', { email, password })
      await mutate(data.user, { revalidate: false })
      return data.user as AuthUser
    },
    [mutate],
  )

  const register = useCallback(
    async (email: string, password: string, code: string) => {
      const data = await post('/api/auth/register', { email, password, code })
      await mutate(data.user, { revalidate: false })
      return data.user as AuthUser
    },
    [mutate],
  )

  const logout = useCallback(async () => {
    await post('/api/auth/logout', {})
    await mutate(null, { revalidate: false })
  }, [mutate])

  return {
    user: user ?? null,
    role: user?.role,
    isAdmin: user?.role === 'admin',
    loading: isValidating && user === undefined,
    login,
    register,
    logout,
    mutate,
  }
}
