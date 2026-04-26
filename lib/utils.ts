export function isNew(createdAt: string, daysThreshold = 14): boolean {
  return (Date.now() - new Date(createdAt).getTime()) < daysThreshold * 24 * 60 * 60 * 1000
}
