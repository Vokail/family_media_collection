import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServerClient()
  await db.from('members').select('id').limit(1)
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
