import sharp from 'sharp'
import { createServerClient } from './supabase-server'
import { randomUUID } from 'crypto'

export async function downloadCover(url: string, memberId: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const resized = await sharp(buffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const path = `${memberId}/${randomUUID()}.jpg`
    const db = createServerClient()
    const { error } = await db.storage.from('covers').upload(path, resized, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (error) return null
    return `covers/${path}`
  } catch {
    return null
  }
}
