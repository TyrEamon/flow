import { useEventListener } from '@literal-ui/hooks'
import Dexie from 'dexie'
import { useRouter } from 'next/router'
import { parseCookies, destroyCookie } from 'nookies'
import { useEffect, useState } from 'react'

import {
  ColorScheme,
  useAuth,
  useColorScheme,
  useForceRender,
  useTranslation,
} from '@flow/reader/hooks'
import { useSettings } from '@flow/reader/state'
import {
  BackendId,
  dbx,
  getBackendId,
  getWebDAVConfig,
  mapToToken,
  OAUTH_SUCCESS_MESSAGE,
  setBackendId,
  setWebDAVConfig,
} from '@flow/reader/sync'

import { localeNames } from '../../../locales'
import { Button } from '../Button'
import { Checkbox, Select, TextField } from '../Form'
import { Page } from '../Page'

export const Settings: React.FC = () => {
  const { scheme, setScheme } = useColorScheme()
  const { asPath, push, locale, locales } = useRouter()
  const [settings, setSettings] = useSettings()
  const t = useTranslation('settings')

  return (
    <Page headline={t('title')}>
      <div className="space-y-6">
        <Item title={t('language')}>
          <Select
            value={locale}
            onChange={(e) => {
              push(asPath, undefined, { locale: e.target.value })
            }}
          >
            {locales?.map((loc) => (
              <option key={loc} value={loc}>
                {localeNames[loc] || loc}
              </option>
            ))}
          </Select>
        </Item>
        <Item title={t('color_scheme')}>
          <Select
            value={scheme}
            onChange={(e) => {
              setScheme(e.target.value as ColorScheme)
            }}
          >
            <option value="system">{t('color_scheme.system')}</option>
            <option value="light">{t('color_scheme.light')}</option>
            <option value="dark">{t('color_scheme.dark')}</option>
          </Select>
        </Item>
        <Item title={t('text_selection_menu')}>
          <Checkbox
            name={t('text_selection_menu.enable')}
            checked={settings.enableTextSelectionMenu}
            onChange={(e) => {
              setSettings({
                ...settings,
                enableTextSelectionMenu: e.target.checked,
              })
            }}
          />
        </Item>
        <Account />
        <Synchronization />
        <Admin />
        <Item title={t('cache')}>
          <Button
            variant="secondary"
            onClick={() => {
              window.localStorage.clear()
              Dexie.getDatabaseNames().then((names) => {
                names.forEach((n) => Dexie.delete(n))
              })
            }}
          >
            {t('cache.clear')}
          </Button>
        </Item>
      </div>
    </Page>
  )
}

const Synchronization: React.FC = () => {
  const render = useForceRender()
  const t = useTranslation('settings.synchronization')
  const { user } = useAuth()
  const backend = getBackendId()

  useEventListener('message', (e) => {
    if (e.data === OAUTH_SUCCESS_MESSAGE) {
      // init app (generate access token, fetch remote data, etc.)
      window.location.reload()
    }
  })

  return (
    <Item title={t('title')}>
      <Select
        value={backend}
        onChange={(e) => {
          setBackendId(e.target.value as BackendId)
          render()
        }}
      >
        <option value="dropbox">{t('backend.dropbox')}</option>
        <option value="webdav">{t('backend.webdav')}</option>
        <option value="r2">{t('backend.r2')}</option>
      </Select>
      <div className="mt-2">
        {backend === 'dropbox' && <DropboxConfig />}
        {backend === 'webdav' && <WebDAVConfigForm />}
        {backend === 'r2' &&
          (user ? (
            <p className="typescale-body-small text-on-surface-variant">
              {t('r2.connected_as')} {user.email}
            </p>
          ) : (
            <p className="typescale-body-small text-error">
              {t('r2.login_required')}
            </p>
          ))}
      </div>
    </Item>
  )
}

const DropboxConfig: React.FC = () => {
  const cookies = parseCookies()
  const refreshToken = cookies[mapToToken['dropbox']]
  const render = useForceRender()
  const t = useTranslation('settings.synchronization')

  return refreshToken ? (
    <Button
      variant="secondary"
      onClick={() => {
        destroyCookie(null, mapToToken['dropbox'])
        render()
      }}
    >
      {t('unauthorize')}
    </Button>
  ) : (
    <Button
      onClick={() => {
        const redirectUri = window.location.origin + '/api/callback/dropbox'

        dbx.auth
          .getAuthenticationUrl(
            redirectUri,
            JSON.stringify({ redirectUri }),
            'code',
            'offline',
          )
          .then((url) => {
            window.open(url as string, '_blank')
          })
      }}
    >
      {t('authorize')}
    </Button>
  )
}

const WebDAVConfigForm: React.FC = () => {
  const t = useTranslation('settings.synchronization')
  const [config, setConfig] = useState(getWebDAVConfig())

  const update = (partial: Partial<typeof config>) => {
    const next = { ...config, ...partial }
    setConfig(next)
    setWebDAVConfig(next)
  }

  return (
    <div className="space-y-2">
      <TextField
        name={t('webdav.url')}
        placeholder="https://dav.example.com/"
        value={config.url}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          update({ url: e.target.value })
        }
      />
      <TextField
        name={t('webdav.username')}
        value={config.username}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          update({ username: e.target.value })
        }
      />
      <TextField
        name={t('webdav.password')}
        type="password"
        value={config.password}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          update({ password: e.target.value })
        }
      />
    </div>
  )
}

const Account: React.FC = () => {
  const t = useTranslation('settings.account')
  const { user, login, register, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()

  const run = async (fn: () => Promise<unknown>) => {
    setError(undefined)
    try {
      await fn()
      setEmail('')
      setPassword('')
      setCode('')
    } catch (e: any) {
      setError(t(`error.${e.message}`) || e.message)
    }
  }

  return (
    <Item title={t('title')}>
      {user ? (
        <div className="space-y-2">
          <p className="typescale-body-small text-on-surface-variant">
            {user.email}
            {user.role === 'admin' ? ' (admin)' : ''}
          </p>
          <Button variant="secondary" onClick={() => logout()}>
            {t('logout')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <TextField
            name={t('email')}
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
          />
          <TextField
            name={t('password')}
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
          />
          <TextField
            name={t('invite_code')}
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCode(e.target.value)
            }
          />
          {error && <p className="typescale-body-small text-error">{error}</p>}
          <div className="space-x-2">
            <Button onClick={() => run(() => login(email, password))}>
              {t('login')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => run(() => register(email, password, code))}
            >
              {t('register')}
            </Button>
          </div>
        </div>
      )}
    </Item>
  )
}

interface Invite {
  code: string
  max_uses: number
  used: number
}
interface ManagedUser {
  id: string
  email: string
  role: 'admin' | 'user'
}

const Admin: React.FC = () => {
  const t = useTranslation('settings.admin')
  const { isAdmin, user } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [customCode, setCustomCode] = useState('')
  const [maxUses, setMaxUses] = useState('1')

  const loadInvites = () =>
    fetch('/api/admin/invites')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInvites(d.invites))
  const loadUsers = () =>
    fetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsers(d.users))

  useEffect(() => {
    if (!isAdmin) return
    loadInvites()
    loadUsers()
  }, [isAdmin])

  if (!isAdmin) return null

  const generate = async () => {
    await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: customCode.trim() || undefined,
        maxUses: Number(maxUses) || 1,
      }),
    })
    setCustomCode('')
    loadInvites()
  }
  const removeInvite = async (c: string) => {
    await fetch(`/api/admin/invites?code=${encodeURIComponent(c)}`, {
      method: 'DELETE',
    })
    loadInvites()
  }
  const removeUser = async (id: string) => {
    await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    loadUsers()
  }

  return (
    <>
      <Item title={t('invites.title')}>
        <div className="space-y-2">
          <ul className="space-y-1">
            {invites.map((inv) => (
              <li
                key={inv.code}
                className="typescale-body-small text-on-surface-variant flex items-center justify-between"
              >
                <span>
                  <code>{inv.code}</code> ({inv.max_uses - inv.used}/
                  {inv.max_uses})
                </span>
                <button
                  className="text-error ml-2"
                  onClick={() => removeInvite(inv.code)}
                >
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2">
            <TextField
              name={t('invites.custom_code')}
              value={customCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCustomCode(e.target.value)
              }
            />
            <TextField
              name={t('invites.max_uses')}
              type="number"
              className="w-20"
              value={maxUses}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMaxUses(e.target.value)
              }
            />
            <Button onClick={generate}>{t('invites.generate')}</Button>
          </div>
        </div>
      </Item>
      <Item title={t('users.title')}>
        <ul className="space-y-1">
          {users.map((u) => (
            <li
              key={u.id}
              className="typescale-body-small text-on-surface-variant flex items-center justify-between"
            >
              <span>
                {u.email}
                {u.role === 'admin' ? ' (admin)' : ''}
              </span>
              {u.id !== user?.id && (
                <button
                  className="text-error ml-2"
                  onClick={() => removeUser(u.id)}
                >
                  {t('delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Item>
    </>
  )
}

interface PartProps {
  title: string
}
const Item: React.FC<PartProps> = ({ title, children }) => {
  return (
    <div>
      <h3 className="typescale-title-small text-on-surface-variant">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

Settings.displayName = 'settings'
