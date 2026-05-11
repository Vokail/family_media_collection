/**
 * Cover image utilities.
 * - downloadCover: fetches a URL, resizes, uploads to Supabase Storage
 * - uploadImageBuffer: resizes a raw buffer and uploads it to a given storage path
 * - coverStorageKey: strips the leading 'covers/' prefix from a DB cover_path
 *   so callers can pass the result directly to storage.remove() / download()
 *   (#127 — consolidates 4+ inline strip patterns into one place)
 */
import sharp from 'sharp'
import { createServerClient } from './supabase-server'
import { randomUUID } from 'crypto'

/**
 * Returns the Supabase Storage object key for a cover_path stored in the DB.
 * DB values use the full form "covers/<member_id>/<uuid>.jpg"; the Storage API
 * operates on the bucket-relative key "<member_id>/<uuid>.jpg".
 */
export function coverStorageKey(cover_path: string): string {
  return cover_path.startsWith('covers/') ? cover_path.slice('covers/'.length) : cover_path
}

/**
 * Resize `buffer` to at most 600×600, encode as JPEG, upload to
 * `covers/<storagePath>` in Supabase Storage, and return the full
 * DB-style path `covers/<storagePath>`.
 *
 * `storagePath` must NOT include the leading `covers/` prefix — e.g.
 * `manual/<memberId>/<uuid>.jpg`.
 *
 * Returns `null` if the upload fails.
 */
export async function uploadImageBuffer(buffer: Buffer, storagePath: string): Promise<string | null> {
  try {
    const resized = await sharp(buffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const db = createServerClient()
    const { error } = await db.storage.from('covers').upload(storagePath, resized, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (error) return null
    return `covers/${storagePath}`
  } catch {
    return null
  }
}

export async function downloadCover(url: string, memberId: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const resized = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
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
