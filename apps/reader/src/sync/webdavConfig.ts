export interface WebDAVConfig {
  url: string
  username: string
  password: string
}

const KEY = 'webdav-config'

export const emptyWebDAVConfig: WebDAVConfig = {
  url: '',
  username: '',
  password: '',
}

export function getWebDAVConfig(): WebDAVConfig {
  if (typeof localStorage === 'undefined') return emptyWebDAVConfig
  const raw = localStorage.getItem(KEY)
  if (!raw) return emptyWebDAVConfig
  try {
    return { ...emptyWebDAVConfig, ...JSON.parse(raw) }
  } catch {
    return emptyWebDAVConfig
  }
}

export function setWebDAVConfig(config: WebDAVConfig) {
  localStorage.setItem(KEY, JSON.stringify(config))
}
