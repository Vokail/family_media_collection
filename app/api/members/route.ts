import { NextResponse } from 'next/server'
import { listMembers } from '@/lib/db/members'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session.role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const members = await listMembers()
  return NextResponse.json(members)
}
