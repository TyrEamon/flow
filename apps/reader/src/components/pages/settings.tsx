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
import { localeNames } from '../../../locales'
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
  const [error, setError] = useState<string>()

  const submit = async (action: typeof login | typeof register) => {
    setError(undefined)
    try {
      await action(email, password)
      setEmail('')
      setPassword('')
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
          {error && (
            <p className="typescale-body-small text-error">{error}</p>
          )}
          <div className="space-x-2">
            <Button onClick={() => submit(login)}>{t('login')}</Button>
            <Button variant="secondary" onClick={() => submit(register)}>
              {t('register')}
            </Button>
          </div>
        </div>
      )}
    </Item>
  )
}

const Admin: React.FC = () => {
  const t = useTranslation('settings.admin')
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState<boolean>()

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/registration')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOpen(d.open))
  }, [isAdmin])

  if (!isAdmin) return null

  return (
    <Item title={t('title')}>
      <Checkbox
        name={t('registration_open')}
        checked={!!open}
        onChange={async (e) => {
          const next = e.target.checked
          setOpen(next)
          await fetch('/api/admin/registration', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ open: next }),
          })
        }}
      />
    </Item>
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
