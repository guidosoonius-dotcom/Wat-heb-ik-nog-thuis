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
  if (d.price !== null && d.old_price !== null && d.old_price > d.price) return Math.round((1 - d.price / d.old_price) * 100)
  return null
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
    if (!p) map.delete(id)
    else list.sort(compareDeals(p))
  }
  return map
}
