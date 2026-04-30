/**
 * Generates apple-touch-startup-image PNGs for all common iPhone screen sizes.
 * Run once: node scripts/generate-splash.mjs
 * Output: public/splash/*.png
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'splash')
const iconSrc = join(root, 'public', 'icon-512.png')

mkdirSync(outDir, { recursive: true })

// background colour (light theme — iOS doesn't support prefers-color-scheme for startup images)
const BG = { r: 245, g: 237, b: 224, alpha: 1 } // #f5ede0

// Portrait actual pixel sizes for every common iPhone
const SIZES = [
  { name: 'splash-640x1136',   w: 640,  h: 1136 }, // SE 1st gen
  { name: 'splash-750x1334',   w: 750,  h: 1334 }, // 6/7/8/SE 2nd+3rd
  { name: 'splash-1242x2208',  w: 1242, h: 2208 }, // 6+/7+/8+
  { name: 'splash-1125x2436',  w: 1125, h: 2436 }, // X/XS/11 Pro
  { name: 'splash-828x1792',   w: 828,  h: 1792 }, // XR/11
  { name: 'splash-1242x2688',  w: 1242, h: 2688 }, // XS Max/11 Pro Max
  { name: 'splash-1080x2340',  w: 1080, h: 2340 }, // 12 mini/13 mini
  { name: 'splash-1170x2532',  w: 1170, h: 2532 }, // 12/13/14
  { name: 'splash-1284x2778',  w: 1284, h: 2778 }, // 12 Pro Max/13 Pro Max
  { name: 'splash-1179x2556',  w: 1179, h: 2556 }, // 14 Pro
  { name: 'splash-1290x2796',  w: 1290, h: 2796 }, // 14 Pro Max
  { name: 'splash-1320x2868',  w: 1320, h: 2868 }, // 16 Pro Max
  { name: 'splash-1206x2622',  w: 1206, h: 2622 }, // 16 Pro
  { name: 'splash-1179x2556b', w: 1179, h: 2556 }, // 15 Pro (same as 14 Pro — deduped below)
]

// Deduplicate by dimension
const seen = new Set()
const unique = SIZES.filter(s => {
  const key = `${s.w}x${s.h}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

for (const { name, w, h } of unique) {
  const iconSize = Math.round(Math.min(w, h) * 0.22) // ~22% of shorter side
  const iconRounded = Math.round(iconSize * 0.225)    // corner radius ~22.5%

  // Resize icon
  const iconBuf = await sharp(iconSrc)
    .resize(iconSize, iconSize, { fit: 'cover' })
    .toBuffer()

  const outPath = join(outDir, `${name}.png`)
  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{ input: iconBuf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  console.log(`✓ ${name}.png  (${w}×${h})`)
}

console.log(`\nDone — ${unique.length} files written to public/splash/`)
