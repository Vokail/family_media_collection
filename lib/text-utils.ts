/**
 * Text cleaning utilities.
 * Shared by openlibrary.ts and google-books.ts — extracted here to avoid
 * circular imports.
 */

/**
 * Clean a raw book description sourced from OpenLibrary or Google Books:
 * - normalises line endings
 * - cuts everything from the first divider line (---) to end of string
 * - strips OL wiki-style links: [[/path|label]] → label, etc.
 * - strips markdown inline links, bold/italic
 * - strips HTML tags and decodes common entities
 * - removes "Source: …" metadata lines
 * - collapses excessive whitespace / blank lines
 */
export function cleanDescription(raw: string): string {
  return raw
    // Normalise Windows line endings
    .replace(/\r\n/g, '\n')
    // Cut from first divider line to end of string (OL metadata/source/contains sections)
    .replace(/\n[-─═]{4,}[\s\S]*$/, '')
    // OL wiki links with label: [[/path|label]] or [[path|label]] → label
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1')
    // OL bare wiki links: [[/path]] or [[word]] → ''
    .replace(/\[\[[^\]]*\]\]/g, '')
    // Markdown inline links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Markdown reference links: [text][ref] → text
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Markdown reference definitions: [ref]: url (whole line) → ''
    .replace(/^\[[^\]]+\]:\s*\S+.*$/gm, '')
    // Hyperlinks with label: [url label text] → label text
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    // Bare URLs in brackets: [https://...] → ''
    .replace(/\[https?:\/\/[^\]]*\]/g, '')
    // Markdown bold: **text** → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Markdown italic: *text* → text
    .replace(/\*([^*]+)\*/g, '$1')
    // HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // "Source: …" lines (OL metadata)
    .replace(/^Source:.*$/gim, '')
    // Collapse 3+ blank lines → 2, then trim
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
