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
    await sql`
      CREATE TABLE IF NOT EXISTS invite_codes (
        code text PRIMARY KEY,
        max_uses int NOT NULL DEFAULT 1,
        used int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
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
  const { rows } =
    await sql<UserRow>`SELECT * FROM users WHERE id = ${id} LIMIT 1`
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

// --- Users (admin management) ---

export async function listUsers() {
  const { rows } = await sql<
    Pick<UserRow, 'id' | 'email' | 'role' | 'created_at'>
  >`
    SELECT id, email, role, created_at FROM users ORDER BY created_at ASC
  `
  return rows
}

export async function deleteUser(id: string) {
  await sql`DELETE FROM users WHERE id = ${id}`
}

// --- Invite codes ---

export interface InviteRow {
  code: string
  max_uses: number
  used: number
  created_at: string
}

export async function listInvites() {
  const { rows } = await sql<InviteRow>`
    SELECT * FROM invite_codes ORDER BY created_at DESC
  `
  return rows
}

export async function createInvite(code: string, maxUses = 1) {
  const { rows } = await sql<InviteRow>`
    INSERT INTO invite_codes (code, max_uses) VALUES (${code}, ${maxUses})
    RETURNING *
  `
  return rows[0]!
}

export async function deleteInvite(code: string) {
  await sql`DELETE FROM invite_codes WHERE code = ${code}`
}

/** Atomically consume one use of a code. Returns true if it was valid. */
export async function consumeInvite(code: string) {
  const { rows } = await sql`
    UPDATE invite_codes SET used = used + 1
    WHERE code = ${code} AND used < max_uses
    RETURNING code
  `
  return rows.length > 0
}
