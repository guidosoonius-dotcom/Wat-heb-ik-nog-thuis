import { useMemo, useState } from 'react'
import { useInventory } from '../lib/inventory'
import { toBuy } from '../lib/logic'
import type { Deal, Product } from '../lib/types'
import { Icon } from './Icon'

export const STORE_NAME: Record<Deal['store'], string> = { ah: 'Albert Heijn', jumbo: 'Jumbo' }
const STORE_SHORT: Record<Deal['store'], string> = { ah: 'AH', jumbo: 'Jumbo' }

const FOLDERS: [string, string][] = [
  ['AH Bonus', 'https://www.ah.nl/bonus'],
  ['Jumbo', 'https://www.jumbo.com/aanbiedingen/nu'],
  ['Lidl', 'https://www.lidl.nl/aanbiedingen'],
  ['Aldi', 'https://www.aldi.nl/aanbiedingen.html'],
  ['Plus', 'https://www.plus.nl/aanbiedingen'],
  ['Dirk', 'https://www.dirk.nl/aanbiedingen'],
  ['Kruidvat', 'https://www.kruidvat.nl/acties'],
  ['Etos', 'https://www.etos.nl/acties/'],
  ['Action', 'https://www.action.com/nl-nl/weekactie/'],
]

// Beste aanbieding per product: eerst in de winkel geldig, dan de winkel waar het product meestal gekocht wordt.
export function bestDeals(deals: Deal[], products: Product[]) {
  const map = new Map<string, Deal>()
  for (const d of deals) {
    const p = products.find((x) => x.id === d.product_id)
    if (!p) continue
    const cur = map.get(d.product_id)
    const rank = (x: Deal) => (x.online_only ? 2 : 0) + (p.store && STORE_NAME[x.store] !== p.store ? 1 : 0)
    if (!cur || rank(d) < rank(cur)) map.set(d.product_id, d)
  }
  return map
}

export function DealBadge({ deal }: { deal: Deal }) {
  return (
    <span className={`deal-badge ${deal.store}`}>
      {STORE_SHORT[deal.store]} · {deal.deal_text}
    </span>
  )
}

function price(n: number | null) {
  return n === null ? '' : `€${n.toFixed(2).replace('.', ',')}`
}

export function DealsSection() {
  const { deals, products, household, updateProduct, refreshDeals, notify } = useInventory()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const best = useMemo(() => bestDeals(deals, products), [deals, products])
  // Producten die nog niet op het lijstje staan maar nu in de aanbieding zijn: voorraad aanvullen?
  const stockUp = useMemo(
    () =>
      products
        .filter((p) => best.has(p.id) && !toBuy(p) && !p.list_checked)
        .map((p) => ({ product: p, deal: best.get(p.id)! }))
        .sort((a, b) => a.product.qty - a.product.min_qty - (b.product.qty - b.product.min_qty)),
    [products, best],
  )
  const shown = open ? stockUp : stockUp.slice(0, 3)
  const checked = household?.deals_checked_at
    ? new Date(household.deals_checked_at).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  async function refresh() {
    setBusy(true)
    await refreshDeals()
    setBusy(false)
  }

  return (
    <section className="stack-sm">
      <div className="section-head">
        <h2 className="eyebrow">
          <Icon name="tag" size={14} /> Nu in de aanbieding
        </h2>
        <button type="button" className="link small-link" onClick={refresh} disabled={busy}>
          {busy ? 'Bezig…' : 'Ververs'}
        </button>
      </div>
      {stockUp.length === 0 ? (
        <p className="hint">
          {deals.length ? 'Alles wat in de aanbieding is, staat al op je lijstje (zie de labels).' : 'Geen acties gevonden voor jullie producten bij AH en Jumbo.'}
          {checked && ` Gecontroleerd: ${checked}.`}
        </p>
      ) : (
        <>
          <p className="hint">Nog genoeg in huis, maar nu voordelig. Inslaan?{checked && ` · ${checked}`}</p>
          {shown.map(({ product, deal }) => (
            <div key={product.id} className="deal-card card">
              {deal.image_url ? <img src={deal.image_url} alt="" loading="lazy" /> : <span className="deal-img-empty" aria-hidden="true" />}
              <div className="deal-text">
                <strong>{product.name}</strong>
                <DealBadge deal={deal} />
                <small>
                  {deal.url ? (
                    <a href={deal.url} target="_blank" rel="noreferrer">
                      {deal.title}
                    </a>
                  ) : (
                    deal.title
                  )}
                  {deal.price !== null && ` · ${price(deal.price)}`}
                  {deal.old_price !== null && <s> {price(deal.old_price)}</s>}
                  {deal.valid_until && ` · t/m ${new Date(deal.valid_until + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`}
                  {deal.online_only && ' · alleen online'}
                </small>
              </div>
              <button
                type="button"
                className="btn-secondary small"
                onClick={() => {
                  updateProduct(product.id, { on_list: true, store: STORE_NAME[deal.store] })
                  notify(`${product.name} op het lijstje (${STORE_NAME[deal.store]})`)
                }}
              >
                Op lijstje
              </button>
            </div>
          ))}
          {stockUp.length > 3 && (
            <button type="button" className="link center" onClick={() => setOpen(!open)}>
              {open ? 'Minder tonen' : `Nog ${stockUp.length - 3} aanbiedingen`}
            </button>
          )}
        </>
      )}
      <details className="folders">
        <summary>Folders van andere winkels</summary>
        <div className="chips">
          {FOLDERS.map(([name, url]) => (
            <a key={name} className="chip" href={url} target="_blank" rel="noreferrer">
              {name}
            </a>
          ))}
        </div>
      </details>
    </section>
  )
}
