/**
 * Direct unit tests for lib/text-utils.ts — cleanDescription.
 *
 * The exhaustive OL wiki-link, markdown, and divider suites already live in
 * __tests__/lib/apis/openlibrary.test.ts (imported via the re-export). This file
 * tests the function from its canonical import path and adds a few targeted
 * cases not covered there.
 */
import { cleanDescription } from '@/lib/text-utils'

describe('cleanDescription', () => {
  it('strips OL wiki links with label: [[/path|label]] → label', () => {
    expect(cleanDescription('Winner of [[/subjects/Prizes|the Booker Prize]].')).toBe('Winner of the Booker Prize.')
  })

  it('strips bare wiki links: [[path]] → empty string', () => {
    const result = cleanDescription('See [[/works/OL1W]] above.')
    expect(result).not.toContain('[[')
    expect(result).toContain('above.')
  })

  it('strips markdown inline links: [text](url) → text', () => {
    expect(cleanDescription('[Buy it](https://example.com) now.')).toBe('Buy it now.')
  })

  it('decodes common HTML entities', () => {
    expect(cleanDescription('A &amp; B &lt;tag&gt; &quot;quoted&quot; it&#39;s&nbsp;fine')).toBe(
      'A & B <tag> "quoted" it\'s fine',
    )
  })

  it('cuts everything after a divider line', () => {
    const input = 'Main body.\n\n---\n\nContains:\n- Part 1'
    expect(cleanDescription(input)).toBe('Main body.')
  })

  it('collapses 3 or more blank lines to a single blank line', () => {
    const input = 'Para one.\n\n\n\n\nPara two.'
    expect(cleanDescription(input)).toBe('Para one.\n\nPara two.')
  })

  it('strips HTML tags, replacing them with a space', () => {
    const result = cleanDescription('<p>Hello <em>world</em>.</p>')
    expect(result).not.toContain('<p>')
    expect(result).toContain('Hello')
    expect(result).toContain('world')
  })

  it('returns an empty string when input is only whitespace after cleaning', () => {
    expect(cleanDescription('   \n\n   ')).toBe('')
  })
})
