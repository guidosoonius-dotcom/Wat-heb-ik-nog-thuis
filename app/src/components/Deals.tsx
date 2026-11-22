import { useMemo, useState } from 'react'
import { useInventory } from '../lib/inventory'
import { toBuy } from '../lib/logic'
import { STORE_NAME, dealsByProduct, effectivePrice, estimateDiscount, formatUnitPrice, unitPrice } from '../lib/deals'
import type { Deal, Product } from '../lib/types'
import { Icon } from './Icon'

export { STORE_NAME }
const STORE_SHORT: Record<Deal['store'], string> = { ...STORE_NAME, ah: 'AH' }

const FOLDERS: [string, string][] = [
  ['AH Bonus', 'https://www.ah.nl/bonus'],
  ['Jumbo', 'https://www.jumbo.com/aanbiedingen/nu'],
  ['Lidl', 'https://www.lidl.nl/aanbiedingen'],
  ['Aldi', 'https://www.aldi.nl/aanbiedingen.html'],
  ['Plus', 'https://www.plus.nl/aanbiedingen'],
  ['Dirk', 'https://www.dirk.nl/aanbiedingen'],
  ['Hoogvliet', 'https://www.hoogvliet.com/aanbiedingen'],
  ['Kruidvat', 'https://www.kruidvat.nl/acties'],
  ['Etos', 'https://www.etos.nl/acties/'],
  ['Action', 'https://www.action.com/nl-nl/weekactie/'],
]

// Beste aanbieding per product (de eerste in de vaste volgorde uit lib/deals).
export function bestDeals(deals: Deal[], products: Product[]) {
  const map = new Map<string, Deal>()
  for (const [id, list] of dealsByProduct(deals, products)) map.set(id, list[0])
  return map
}

// Label van de beste actie; met andere winkels erbij wordt het een knop die alle acties toont.
export function DealBadge({ deal, more = 0, onClick }: { deal: Deal; more?: number; onClick?: () => void }) {
  const text = (
    <>
      {STORE_SHORT[deal.store]} · {deal.deal_text}
      {more > 0 && <span className="deal-more">+{more} {more === 1 ? 'winkel' : 'winkels'}</span>}
    </>
  )
  if (!onClick) return <span className={`deal-badge ${deal.store}`}>{text}</span>
  return (
    <button type="button" className={`deal-badge ${deal.store} as-button`} onClick={onClick} aria-label={`Acties bekijken: ${STORE_NAME[deal.store]} ${deal.deal_text}${more ? ` en nog ${more} winkels` : ''}`}>
      {text}
    </button>
  )
}

function price(n: number | null) {
  return n === null ? '' : `€${n.toFixed(2).replace('.', ',')}`
}

function until(d: string | null) {
  return d ? `t/m ${new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}` : null
}

// Alle acties voor één product, beste eerst, met per actie "Hier kopen".
export function DealPicker({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { deals, products, updateProduct, notify } = useInventory()
  const product = products.find((p) => p.id === productId)
  const list = useMemo(() => dealsByProduct(deals, products).get(productId) ?? [], [deals, products, productId])
  if (!product) return null
  const onList = toBuy(product)

  function choose(d: Deal) {
    if (!product) return
    updateProduct(product.id, { store: STORE_NAME[d.store], ...(onList ? {} : { on_list: true }) })
    notify(onList ? `${product.name}: halen bij ${STORE_NAME[d.store]}` : `${product.name} op het lijstje (${STORE_NAME[d.store]})`)
    onClose()
  }

  return (
    <div className="action-backdrop" onClick={onClose}>
      <div className="action-sheet deal-picker" role="dialog" aria-modal="true" aria-labelledby="deal-picker-title" onClick={(e) => e.stopPropagation()}>
        <div className="action-head">
          <div className="action-title">
            <h2 id="deal-picker-title">{product.name}</h2>
            <span className="muted small">
              {list.length} {list.length === 1 ? 'actie' : 'acties'} · {list.filter((d) => unitPrice(d)).length >= 2 ? 'laagste prijs per kg/liter eerst' : 'beste eerst'}{product.store ? `, ${product.store} voorop` : ''}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Sluiten">
            <Icon name="close" size={18} stroke={2.4} />
          </button>
        </div>
        <div className="deal-list">
          {list.map((d, i) => {
            const pct = estimateDiscount(d)
            const own = product.store === STORE_NAME[d.store]
            return (
              <div key={d.id} className={`deal-option card ${i === 0 ? 'best' : ''}`}>
                <div className="deal-option-top">
                  <span className={`deal-badge ${d.store}`}>
                    {STORE_SHORT[d.store]} · {d.deal_text}
                  </span>
                  {pct !== null && <span className="deal-pct">± {pct}% voordeel</span>}
                </div>
                <div className="deal-option-body">
                  {d.image_url && <img src={d.image_url} alt="" loading="lazy" />}
                  <small>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer">
                        {d.title}
                      </a>
                    ) : (
                      d.title
                    )}
                    {(d.price ?? effectivePrice(d)) !== null && ` · ${d.price === null ? '± ' : ''}${price(d.price ?? effectivePrice(d))}`}
                    {d.old_price !== null && <s> {price(d.old_price)}</s>}
                    {unitPrice(d) && <strong className="unit-price"> · {formatUnitPrice(unitPrice(d)!)}</strong>}
                    {until(d.valid_until) && ` · ${until(d.valid_until)}`}
                    {d.online_only && ' · alleen online'}
                    {i === 0 && <strong className="deal-best"> · Beste keus</strong>}
                  </small>
                </div>
                {own && onList ? (
                  <span className="muted small">Je haalt het al hier</span>
                ) : (
                  <button type="button" className="btn-secondary small" onClick={() => choose(d)}>
                    {onList ? `Halen bij ${STORE_NAME[d.store]}` : `Op lijstje (${STORE_NAME[d.store]})`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="hint">
          Het voordeel is een schatting: "1+1 gratis" telt als 50%, "2e halve prijs" als 25%. De prijs per kg of liter is berekend met de actieprijs
          (bij "1+1 gratis" de helft van de normale prijs) en de inhoud uit de productnaam; die staat er alleen bij als beide bekend zijn.
        </p>
      </div>
    </div>
  )
}

export function DealsSection({ onShowDeals }: { onShowDeals: (productId: string) => void }) {
  const { deals, products, household, updateProduct, refreshDeals, notify } = useInventory()
  const all = useMemo(() => dealsByProduct(deals, products), [deals, products])
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
          {deals.length ? 'Alles wat in de aanbieding is, staat al op je lijstje (zie de labels).' : 'Geen acties gevonden voor jullie producten.'}
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
                <DealBadge deal={deal} more={new Set((all.get(product.id) ?? []).map((d) => d.store)).size - 1} onClick={() => onShowDeals(product.id)} />
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
                  {unitPrice(deal) && <strong className="unit-price"> · {formatUnitPrice(unitPrice(deal)!)}</strong>}
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
        <summary>Folders bekijken</summary>
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
