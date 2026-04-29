export function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase())
}

export function isNew(createdAt: string, daysThreshold = 14): boolean {
  return (Date.now() - new Date(createdAt).getTime()) < daysThreshold * 24 * 60 * 60 * 1000
}

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return '1 month ago'
  return `${Math.floor(days / 30)} months ago`
}
