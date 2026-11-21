// Zoekt een product op bij de open databases van Open Food/Beauty/Products Facts.
export interface BarcodeInfo {
  name: string // weergavenaam, met merk
  productName: string // naam zonder merk
  brand: string | null
  categories: string[] // bijv. en:spreads, en:sweet-spreads
  source: 'food' | 'beauty' | 'products'
  imageUrl: string | null
  size: string | null // bijv. "500 g"
  paoMonths: number | null // houdbaarheid na openen
}

function parsePao(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = v.match(/(\d+)\s*(m|month|maand)/i)
  return m ? Math.min(Number(m[1]), 120) : null
}

const SOURCES: [BarcodeInfo['source'], string][] = [
  ['food', 'https://world.openfoodfacts.org'],
  ['beauty', 'https://world.openbeautyfacts.org'],
  ['products', 'https://world.openproductsfacts.org'],
]

export async function lookupBarcode(code: string): Promise<BarcodeInfo | null> {
  for (const [source, base] of SOURCES) {
    try {
      const res = await fetch(
        `${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_nl,generic_name_nl,brands,categories_tags,quantity,image_front_small_url,image_small_url,periods_after_opening`,
      )
      if (!res.ok) continue
      const json = await res.json()
      const p = json?.product
      const productName: string | undefined = p?.product_name_nl || p?.product_name || p?.generic_name_nl
      if (productName) {
        const brand: string | null = p.brands?.split(',')[0]?.trim() || null
        const name = brand && !productName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${productName}` : productName
        return {
          name,
          productName,
          brand,
          categories: Array.isArray(p.categories_tags) ? p.categories_tags : [],
          source,
          imageUrl: p.image_front_small_url || p.image_small_url || null,
          size: typeof p.quantity === 'string' && p.quantity.trim() ? p.quantity.trim() : null,
          paoMonths: parsePao(p.periods_after_opening),
        }
      }
    } catch {
      // probeer de volgende bron
    }
  }
  return null
}
