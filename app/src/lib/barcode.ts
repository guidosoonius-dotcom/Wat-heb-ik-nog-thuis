// Zoekt een product op bij de open databases van Open Food/Beauty/Products Facts.
export interface BarcodeInfo {
  name: string // weergavenaam, met merk
  productName: string // naam zonder merk
  brand: string | null
  categories: string[] // bijv. en:spreads, en:sweet-spreads
  source: 'food' | 'beauty' | 'products'
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
        `${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_nl,generic_name_nl,brands,categories_tags`,
      )
      if (!res.ok) continue
      const json = await res.json()
      const p = json?.product
      const productName: string | undefined = p?.product_name_nl || p?.product_name || p?.generic_name_nl
      if (productName) {
        const brand: string | null = p.brands?.split(',')[0]?.trim() || null
        const name = brand && !productName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${productName}` : productName
        return { name, productName, brand, categories: Array.isArray(p.categories_tags) ? p.categories_tags : [], source }
      }
    } catch {
      // probeer de volgende bron
    }
  }
  return null
}
