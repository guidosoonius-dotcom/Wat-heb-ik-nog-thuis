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

export function addMonths(date: string, months: number) {
  const d = new Date(date + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function todayIso() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function isLow(p: Product) {
  return p.qty < p.min_qty
}

const BASKET_HOURS = 12

// Afgevinkt in de afgelopen uren: staat nog "in het mandje".
export function inBasket(p: Product) {
  return p.list_checked && !!p.list_checked_at && Date.now() - new Date(p.list_checked_at).getTime() < BASKET_HOURS * 3600000
}

// Afgevinkt, maar al lang geleden: het mandje mag worden opgeruimd.
export function staleBasket(p: Product) {
  return p.list_checked && !inBasket(p)
}

export const PREDICT_DAYS = 7

// Geschat aantal dagen tot op, op basis van het geleerde verbruik.
export function daysLeft(p: Product): number | null {
  if (!p.use_rate || p.use_rate <= 0) return null
  return Math.floor(p.qty / p.use_rate)
}

// Nog boven het minimum, maar volgens het verbruik binnenkort op.
export function predictedLow(p: Product) {
  const d = daysLeft(p)
  return !isLow(p) && p.qty > 0 && d !== null && d <= PREDICT_DAYS
}

// Minimum dat ongeveer 10 dagen verbruik dekt.
export function suggestedMin(p: Product): number | null {
  if (!p.use_rate) return null
  return Math.max(1, Math.ceil(p.use_rate * 10))
}

// Nog te kopen.
export function toBuy(p: Product) {
  return !p.list_checked && (p.on_list || isLow(p) || predictedLow(p))
}

// Zichtbaar op het lijstje: nog te kopen of net gekocht.
export function onShoppingList(p: Product) {
  return toBuy(p) || inBasket(p)
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
