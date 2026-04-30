import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sharp from 'sharp'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Free vision model on OpenRouter — switch here if a better free model becomes available
const MODEL = 'qwen/qwen2.5-vl-72b-instruct:free'
// Max longest side before sending to vision model — keeps base64 payload small
const MAX_PX = 1024

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OCR not configured' }, { status: 503 })

  const form = await request.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  // Resize to max 1024px on the longest side — phone photos can be 3–8 MB which
  // exceeds free vision model context limits when base64-encoded
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
      model: MODEL,
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
    return NextResponse.json({ error: `OpenRouter ${res.status}: ${err.slice(0, 200)}` }, { status: 502 })
  }

  const json = await res.json()
  const raw_text = json.choices?.[0]?.message?.content ?? ''

  // Parse the JSON the model returns — strip any markdown code fences if present
  try {
    const cleaned = raw_text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned) as { title?: string; creator?: string }
    return NextResponse.json({
      title: parsed.title ?? '',
      creator: parsed.creator ?? '',
    })
  } catch {
    // Model returned something unparseable — return raw text as title so the
    // user at least gets something to work with
    return NextResponse.json({ title: raw_text.slice(0, 120), creator: '' })
  }
}
