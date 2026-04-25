import { SessionOptions, getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from './types'

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'fmc_session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7 },
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
