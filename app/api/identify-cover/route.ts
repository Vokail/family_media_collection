import { NextResponse } from 'next/server'
import { createWorker } from 'tesseract.js'

const MIN_CONFIDENCE = 50

function extractTitleCreator(text: string): { title: string; creator: string; confident: boolean } {
  // Split into non-empty lines, trim whitespace
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1)

  if (lines.length === 0) return { title: '', creator: '', confident: false }

  // Heuristic: longest line is most likely the title (prominent text on covers)
  const sorted = [...lines].sort((a, b) => b.length - a.length)
  const title = sorted[0] ?? ''

  // Creator: first line that isn't the title and looks like a name (2+ words or known patterns)
  const creatorLine = lines.find(l => l !== title && l.length > 2) ?? ''

  return {
    title,
    creator: creatorLine,
    confident: title.length > 2,
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const image = form.get('image') as File | null
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const buffer = Buffer.from(await image.arrayBuffer())

    const worker = await createWorker('eng')
    const { data } = await worker.recognize(buffer)
    await worker.terminate()

    const avgConf = data.confidence ?? 0
    const { title, creator, confident } = extractTitleCreator(data.text)

    if (!confident || avgConf < MIN_CONFIDENCE) {
      return NextResponse.json({ title: '', creator: '', confident: false })
    }

    return NextResponse.json({ title, creator, confident: true })
  } catch {
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
