/**
 * Application-wide constants (#126).
 * Single source of truth — import from here instead of re-declaring locally.
 */
import type { CollectionType } from './types'

/** All supported collection types. Used to validate route params + API inputs. */
export const VALID_COLLECTIONS: readonly CollectionType[] = ['vinyl', 'book', 'comic', 'lego']

/** Accepted MIME types for cover / profile image uploads. */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

/** Maximum upload size for cover / profile images (10 MB). */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024
