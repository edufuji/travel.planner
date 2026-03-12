export function formatDate(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split('-')
  return `${d}/${m}/${y}`
}
