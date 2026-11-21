// Zoekt een productnaam op bij de open databases van Open Food/Beauty/Products Facts.
const SOURCES = [
  'https://world.openfoodfacts.org',
  'https://world.openbeautyfacts.org',
  'https://world.openproductsfacts.org',
]

export async function lookupBarcode(code: string): Promise<string | null> {
  for (const base of SOURCES) {
    try {
      const res = await fetch(
        `${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_nl,brands`,
      )
      if (!res.ok) continue
      const json = await res.json()
      const p = json?.product
      const name: string | undefined = p?.product_name_nl || p?.product_name
      if (name) {
        const brand: string | undefined = p.brands?.split(',')[0]?.trim()
        return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name
      }
    } catch {
      // probeer de volgende bron
    }
  }
  return null
}
