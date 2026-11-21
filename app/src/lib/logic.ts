import type { Product, Status } from './types'

export const EXPIRY_SOON_DAYS = 30

export function statusOf(p: Product): Status {
  if (p.min_qty === 0 && p.qty === 0) return 'none'
  if (p.qty === 0) return 'out'
  if (p.qty < p.min_qty) return 'low'
  return 'ok'
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Genoeg',
  low: 'Bijna op',
  out: 'Op',
  none: 'Niet in huis',
}

export function isLow(p: Product) {
  return p.qty < p.min_qty
}

export function onShoppingList(p: Product) {
  return p.on_list || isLow(p)
}

export function needed(p: Product) {
  return p.list_qty ?? Math.max(p.min_qty - p.qty, 1)
}

export function daysUntil(date: string) {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export function expirySoon(p: Product) {
  return !!p.expiry_date && daysUntil(p.expiry_date) <= EXPIRY_SOON_DAYS
}

export function expiryLabel(date: string) {
  const days = daysUntil(date)
  if (days < 0) return 'Verlopen'
  if (days === 0) return 'Verloopt vandaag'
  if (days <= EXPIRY_SOON_DAYS) return `Nog ${days} ${days === 1 ? 'dag' : 'dagen'}`
  return new Date(date + 'T00:00:00').toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
}

export function byName(a: Product, b: Product) {
  return a.name.localeCompare(b.name, 'nl')
}

export function todayLabel() {
  const s = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
