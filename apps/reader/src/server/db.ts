import { sql } from '@vercel/postgres'

import { bootstrapAdmin } from './auth'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  role: 'admin' | 'user'
  created_at: string
}

export const REGISTRATION_OPEN_KEY = 'registration_open'

let _ready: Promise<void> | undefined

/**
 * Idempotently create the schema and seed the bootstrap admin. Memoized so the
 * DDL only runs once per warm serverless instance.
 */
export function ensureSchema(): Promise<void> {
  _ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'user',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value text
      )
    `
    await bootstrapAdmin()
  })().catch((e) => {
    // allow a retry on the next request if setup failed
    _ready = undefined
    throw e
  })
  return _ready
}

export async function getUserByEmail(email: string) {
  const { rows } = await sql<UserRow>`
    SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
  `
  return rows[0]
}

export async function getUserById(id: string) {
  const { rows } = await sql<UserRow>`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return rows[0]
}

export async function createUser(
  email: string,
  passwordHash: string,
  role: 'admin' | 'user' = 'user',
) {
  const { rows } = await sql<UserRow>`
    INSERT INTO users (email, password_hash, role)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${role})
    RETURNING *
  `
  return rows[0]!
}

export async function getSetting(key: string) {
  const { rows } = await sql<{ value: string }>`
    SELECT value FROM app_settings WHERE key = ${key} LIMIT 1
  `
  return rows[0]?.value
}

export async function setSetting(key: string, value: string) {
  await sql`
    INSERT INTO app_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `
}

export async function isRegistrationOpen() {
  return (await getSetting(REGISTRATION_OPEN_KEY)) === 'true'
}
