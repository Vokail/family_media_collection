/**
 * @jest-environment jsdom
 *
 * Regression cover for #149 — reaching the end of a detail sheet's scroll area
 * chained the scroll to the collection behind it.
 *
 * jsdom does not lay out or scroll, so this asserts the class contract rather
 * than the behaviour: every scrollable sheet body must carry overscroll
 * containment. The rendered result was verified in a browser, where the
 * computed overscroll-behavior-y reads "contain".
 */
import '@testing-library/jest-dom'
import fs from 'fs'
import path from 'path'

const SHEETS = [
  'components/ItemDetailSheet.tsx',
  'components/VinylDetailModal.tsx',
  'components/LegoDetailModal.tsx',
]

describe('detail sheets contain their overscroll (#149)', () => {
  it.each(SHEETS)('%s pairs every overflow-y-auto with overscroll-y-contain', file => {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8')

    // Every className that makes an element scrollable must also contain the
    // scroll, or hitting the end drags the page underneath the sheet.
    const scrollers = src.match(/className="[^"]*overflow-y-auto[^"]*"/g) ?? []
    expect(scrollers.length).toBeGreaterThan(0)
    for (const cls of scrollers) {
      expect(cls).toMatch(/overscroll-y-contain/)
    }
  })
})
