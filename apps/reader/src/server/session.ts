import { jwtVerify, SignJWT } from 'jose'

export const COOKIE_NAME = 'flow_session'

export interface SessionPayload {
  sub: string // user id
  email: string
  role: 'admin' | 'user'
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export function signSession(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub) return null
    return {
      sub: payload.sub,
      email: payload.email as string,
      role: (payload.role as 'admin' | 'user') ?? 'user',
    }
  } catch {
    return null
  }
}
