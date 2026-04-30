import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sharp from 'sharp'
import { getCachedModel, setCachedModel, clearModelCache } from '@/lib/ocr-model-cache'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODELS_URL = 'https://openrouter.ai/api/v1/models'
const MAX_PX = 1024

// Preferred models in priority order — known to work well for cover OCR.
// Auto-discovery falls back to these if none is available.
const PREFERRED_MODELS = [
  'qwen/qwen2.5-vl-72b-instruct:free',
  'qwen/qwen2.5-vl-7b-instruct:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'meta-llama/llama-3.2-90b-vision-instruct:free',
]

// Models known to claim vision support but return empty/garbage for OCR tasks
const BLOCKLIST = ['nemotron', 'omni', 'phi-3']

async function findFreeVisionModel(apiKey: string): Promise<string | null> {
  const cached = getCachedModel()
  if (cached) return cached

  const res = await fetch(MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) return null

  const { data } = await res.json() as {
    data: { id: string; pricing?: { prompt?: string }; architecture?: { modality?: string } }[]
  }

  const freeVisionIds = new Set(
    data
      .filter(m =>
        m.pricing?.prompt === '0' &&
        (m.architecture?.modality?.includes('image') || m.id.includes('vision') || m.id.includes('-vl-')) &&
        !BLOCKLIST.some(b => m.id.toLowerCase().includes(b))
      )
      .map(m => m.id)
  )

  // Pick preferred model if available, otherwise first from discovered list
  const model =
    PREFERRED_MODELS.find(id => freeVisionIds.has(id)) ??
    Array.from(freeVisionIds)[0] ??
    null

  if (model) {
    setCachedModel(model)
    console.log('OCR: selected free vision model:', model)
  }

  return model
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OCR not configured' }, { status: 503 })

  const form = await request.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const model = await findFreeVisionModel(apiKey)
  if (!model) return NextResponse.json({ error: 'No free vision model available on OpenRouter' }, { status: 503 })

  // Resize to max 1024px — phone photos exceed free model context limits when base64-encoded
  const raw = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(raw)
    .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const base64 = resized.toString('base64')

  const prompt =
    'This is a cover image of a book, vinyl record, or comic. ' +
    'Extract the title and the creator (author, artist, or publisher). ' +
    'Return ONLY valid JSON with two fields, nothing else: {"title": "...", "creator": "..."}'

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Vokail/family_media_collection',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('OpenRouter OCR error:', res.status, err)
    clearModelCache() // bust cache so we re-discover on next attempt
    return NextResponse.json({ error: `OpenRouter ${res.status} (model: ${model}): ${err.slice(0, 200)}` }, { status: 502 })
  }

  const json = await res.json()
  const raw_text = json.choices?.[0]?.message?.content ?? ''

  try {
    const cleaned = raw_text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned) as { title?: string; creator?: string }
    return NextResponse.json({ title: parsed.title ?? '', creator: parsed.creator ?? '' })
  } catch {
    return NextResponse.json({ title: raw_text.slice(0, 120), creator: '' })
  }
}
