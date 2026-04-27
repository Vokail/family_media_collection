import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { fetchVinylRelease } from '@/lib/apis/discogs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.role) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id } = await params
  const data = await fetchVinylRelease(id)
  return NextResponse.json(data)
}
