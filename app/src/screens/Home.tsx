import { useMemo, useState } from 'react'
import { useInventory } from '../lib/inventory'
import { byName, expirySoon, isLow, onShoppingList, todayLabel } from '../lib/logic'
import type { Product } from '../lib/types'
import { Icon } from '../components/Icon'
import { ProductRow } from '../components/ProductRow'
import { InstallHint } from '../components/InstallHint'

interface Props {
  onOpen: (p: Product) => void
  onScan: () => void
  onShowPlace: (placeId: string | null, filter?: 'all' | 'low' | 'expiry') => void
  onShowList: () => void
  onShowHousehold: () => void
}

export function Home({ onOpen, onScan, onShowPlace, onShowList, onShowHousehold }: Props) {
  const { products, places, household } = useInventory()
  const [query, setQuery] = useState('')

  const low = useMemo(() => products.filter(isLow).sort((a, b) => a.qty - b.qty || byName(a, b)), [products])
  const listCount = useMemo(() => products.filter(onShoppingList).length, [products])
  const expiring = useMemo(() => products.filter(expirySoon).length, [products])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)).sort(byName) : []
  }, [products, query])

  return (
    <div className="screen">
      <header className="home-head">
        <div>
          <span className="muted small strong">{todayLabel()}</span>
          <h1 className="title">Wat heb ik<br />nog thuis</h1>
        </div>
        <button type="button" className="avatar-btn" onClick={onShowHousehold} aria-label={`Huishouden: ${household?.name ?? ''}`}>
          <Icon name="home" size={20} />
        </button>
      </header>

      <InstallHint />

      <div className="search">
        <Icon name="search" size={20} />
        <input type="search" aria-label="Zoek een product" placeholder="Zoek een product…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="icon-btn plain" onClick={onScan} aria-label="Barcode scannen">
          <Icon name="scan" size={22} />
        </button>
      </div>

      {query.trim() ? (
        <section className="stack-sm">
          <h2 className="h2">{results.length} gevonden</h2>
          {results.map((p) => (
            <ProductRow key={p.id} product={p} onOpen={onOpen} showPlace />
          ))}
          {results.length === 0 && <p className="empty">Niets gevonden. Voeg het toe met de plusknop.</p>}
        </section>
      ) : (
        <>
          <div className="stats">
            <button type="button" className="stat" onClick={() => onShowPlace(null, 'low')}>
              <span className="dot warn" />
              <strong>{low.length}</strong>
              <span>Bijna op</span>
            </button>
            <button type="button" className="stat stat-accent" onClick={onShowList}>
              <Icon name="bag" size={16} stroke={2.2} />
              <strong>{listCount}</strong>
              <span>Op het lijstje</span>
            </button>
            <button type="button" className="stat" onClick={() => onShowPlace(null, 'expiry')}>
              <Icon name="calendar" size={16} stroke={2.2} />
              <strong>{expiring}</strong>
              <span>Verloopt snel</span>
            </button>
          </div>

          <section className="stack-sm">
            <div className="section-head">
              <h2 className="h2">Bijna op</h2>
              {listCount > 0 && (
                <button type="button" className="link" onClick={onShowList}>
                  Bekijk lijstje
                </button>
              )}
            </div>
            {low.slice(0, 6).map((p) => (
              <ProductRow key={p.id} product={p} onOpen={onOpen} showPlace />
            ))}
            {low.length > 6 && (
              <button type="button" className="link center" onClick={() => onShowPlace(null, 'low')}>
                Nog {low.length - 6} meer
              </button>
            )}
            {low.length === 0 && (
              <p className="empty">{products.length === 0 ? 'Nog geen producten. Tik op de plus om te beginnen.' : 'Alles is op voorraad. Lekker!'}</p>
            )}
          </section>

          <section className="stack-sm">
            <div className="section-head">
              <h2 className="h2">Plekken in huis</h2>
            </div>
            <div className="tiles">
              {places.map((pl) => {
                const items = products.filter((p) => p.place_id === pl.id)
                const lowHere = items.filter(isLow).length
                return (
                  <button key={pl.id} type="button" className="tile" style={{ background: pl.color }} onClick={() => onShowPlace(pl.id)}>
                    <Icon name={pl.icon} size={26} stroke={1.8} />
                    <span className="tile-text">
                      <strong>{pl.name}</strong>
                      <small>
                        {items.length} {items.length === 1 ? 'product' : 'producten'}
                        {lowHere > 0 ? ` · ${lowHere} bijna op` : ''}
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
