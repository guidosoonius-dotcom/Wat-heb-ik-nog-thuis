// Acties vergelijkbaar maken: een geschat voordeelpercentage per actie, en een vaste volgorde.
import type { Deal, Product } from './types'

export const STORE_NAME: Record<Deal['store'], string> = {
  ah: 'Albert Heijn',
  jumbo: 'Jumbo',
  aldi: 'Aldi',
  dirk: 'Dirk',
  hoogvliet: 'Hoogvliet',
  lidl: 'Lidl',
  action: 'Action',
}

const num = (s: string) => Number(s.replace(',', '.'))

// Geschat voordeel in procent, of null als dat uit de actie niet op te maken is.
// "1+1 gratis" = 50%, "2+1 gratis" = 33%, "1+2 gratis" = 67%, "2e halve prijs" = 25%, "-30%" = 30%,
// en een actieprijs met normale prijs erbij = het werkelijke verschil.
export function estimateDiscount(d: Pick<Deal, 'deal_text' | 'price' | 'old_price'>): number | null {
  const t = d.deal_text.toLowerCase().replace(/\s+/g, ' ')
  let m = t.match(/(\d+) ?\+ ?(\d+) ?gratis/)
  if (m) return Math.round((num(m[2]) / (num(m[1]) + num(m[2]))) * 100)
  m = t.match(/(\d+)e gratis/)
  if (m) return Math.round(100 / num(m[1]))
  m = t.match(/(\d+)e halve prijs/)
  if (m) return Math.round(50 / num(m[1]))
  m = t.match(/(\d+(?:[.,]\d+)?) ?%/)
  if (m && !/volume/.test(t)) return Math.round(num(m[1]))
  m = t.match(/(\d+) voor €? ?(\d+[.,]\d{2})/)
  if (m && d.old_price) return Math.max(0, Math.round((1 - num(m[2]) / (num(m[1]) * d.old_price)) * 100))
  m = t.match(/^(?:nu |voor )€? ?(\d+[.,]\d{2})$/)
  if (m && d.old_price && d.price === null) return Math.max(0, Math.round((1 - num(m[1]) / d.old_price) * 100))
  if (d.price !== null && d.old_price !== null && d.old_price > d.price) return Math.round((1 - d.price / d.old_price) * 100)
  return null
}

// --- Prijs per kilo of liter -------------------------------------------------------------------

const UNIT: Record<string, { per: 'kg' | 'l'; factor: number }> = {
  mg: { per: 'kg', factor: 0.000001 },
  g: { per: 'kg', factor: 0.001 },
  gr: { per: 'kg', factor: 0.001 },
  gram: { per: 'kg', factor: 0.001 },
  kg: { per: 'kg', factor: 1 },
  kilo: { per: 'kg', factor: 1 },
  ml: { per: 'l', factor: 0.001 },
  milliliter: { per: 'l', factor: 0.001 },
  cl: { per: 'l', factor: 0.01 },
  dl: { per: 'l', factor: 0.1 },
  l: { per: 'l', factor: 1 },
  ltr: { per: 'l', factor: 1 },
  liter: { per: 'l', factor: 1 },
}

// Inhoud in kg of liter uit een tekst als "350 g", "6 x 300 ml", "2 x 500 g", "1,8 liter" of "6x330ml".
export function parseSize(text: string | null | undefined): { amount: number; per: 'kg' | 'l' } | null {
  if (!text) return null
  const t = text.toLowerCase().replace(/,/g, '.')
  const unit = '(mg|kg|kilo|gram|gr|g|milliliter|ml|cl|dl|liter|ltr|l)\\b'
  const multi = t.match(new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*${unit}`))
  if (multi) {
    const u = UNIT[multi[3]]
    return { amount: Number(multi[1]) * Number(multi[2]) * u.factor, per: u.per }
  }
  const single = [...t.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'g'))]
  if (!single.length) return null
  // Bij meerdere maten (bijv. "1,8 liter" na "6x300ml") de grootste nemen: dat is de hele verpakking.
  const best = single
    .map((m) => ({ amount: Number(m[1]) * UNIT[m[2]].factor, per: UNIT[m[2]].per }))
    .sort((a, b) => b.amount - a.amount)[0]
  return best.amount > 0 ? best : null
}

// Wat één verpakking in de actie gemiddeld kost.
export function effectivePrice(d: Pick<Deal, 'deal_text' | 'price' | 'old_price'>): number | null {
  const t = d.deal_text.toLowerCase().replace(/\s+/g, ' ')
  // Actieprijs én normale prijs bekend: de actieprijs is de prijs.
  if (d.price !== null && d.old_price !== null) return d.price
  const normal = d.old_price ?? d.price
  let m = t.match(/(\d+) voor €? ?(\d+[.,]\d{2})/)
  if (m) return num(m[2]) / num(m[1])
  m = t.match(/^(?:nu |voor )€? ?(\d+[.,]\d{2})$/)
  if (m) return num(m[1])
  if (normal === null) return null
  m = t.match(/(\d+) ?\+ ?(\d+) ?gratis/)
  if (m) return (normal * num(m[1])) / (num(m[1]) + num(m[2]))
  m = t.match(/(\d+)e gratis/)
  if (m) return (normal * (num(m[1]) - 1)) / num(m[1])
  m = t.match(/(\d+)e halve prijs/)
  if (m) return (normal * (num(m[1]) - 0.5)) / num(m[1])
  m = t.match(/(\d+(?:[.,]\d+)?) ?%/)
  if (m && !/volume|tot/.test(t)) return normal * (1 - num(m[1]) / 100)
  return d.price
}

// Prijs per kg of liter in de actie, of null als inhoud of prijs onbekend is.
export function unitPrice(d: Deal): { value: number; per: 'kg' | 'l' } | null {
  const size = parseSize(d.size_text) ?? parseSize(d.title)
  const price = effectivePrice(d)
  if (!size || price === null || size.amount <= 0) return null
  const value = price / size.amount
  return value > 0 && value < 1000 ? { value, per: size.per } : null
}

export function formatUnitPrice(u: { value: number; per: 'kg' | 'l' }) {
  return `€${u.value.toFixed(2).replace('.', ',')}/${u.per}`
}

// Volgorde: eerst de winkel waar het product meestal gekocht wordt, dan acties die in de winkel gelden,
// dan het grootste geschatte voordeel, dan de laagste prijs.
export function compareDeals(product: Pick<Product, 'store'> | undefined) {
  return (a: Deal, b: Deal) => {
    const own = (d: Deal) => (product?.store && STORE_NAME[d.store] === product.store ? 0 : 1)
    if (own(a) !== own(b)) return own(a) - own(b)
    if (a.online_only !== b.online_only) return Number(a.online_only) - Number(b.online_only)
    const da = estimateDiscount(a) ?? -1
    const db = estimateDiscount(b) ?? -1
    if (da !== db) return db - da
    return (a.price ?? Infinity) - (b.price ?? Infinity)
  }
}

// Alle acties per product, al gesorteerd.
export function dealsByProduct(deals: Deal[], products: Product[]) {
  const map = new Map<string, Deal[]>()
  for (const d of deals) map.set(d.product_id, [...(map.get(d.product_id) ?? []), d])
  for (const [id, list] of map) {
    const p = products.find((x) => x.id === id)
    if (!p) {
      map.delete(id)
      continue
    }
    list.sort(compareDeals(p))
    // Hebben minstens twee acties een prijs per kg (of liter)? Dan is die eerlijker dan het percentage:
    // die acties eerst, goedkoopste per kg/liter voorop; acties zonder bekende inhoud daarna.
    const counts = { kg: 0, l: 0 }
    for (const d of list) {
      const u = unitPrice(d)
      if (u) counts[u.per]++
    }
    const per: 'kg' | 'l' | null = counts.kg >= 2 && counts.kg >= counts.l ? 'kg' : counts.l >= 2 ? 'l' : null
    if (per) {
      const own = (d: Deal) => (p.store && STORE_NAME[d.store] === p.store ? 0 : 1)
      const up = (d: Deal) => {
        const u = unitPrice(d)
        return u && u.per === per ? u.value : Infinity
      }
      const base = new Map(list.map((d, i) => [d, i]))
      list.sort((a, b) => own(a) - own(b) || Number(a.online_only) - Number(b.online_only) || up(a) - up(b) || base.get(a)! - base.get(b)!)
    }
  }
  return map
}
