import { NextResponse } from 'next/server'
import { listMembers } from '@/lib/db/members'

export const dynamic = 'force-dynamic'

export async function GET() {
  const members = await listMembers()
  return NextResponse.json(members)
}
