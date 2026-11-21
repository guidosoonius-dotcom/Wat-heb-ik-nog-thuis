import { useMemo, useState } from 'react'
import { useInventory } from '../lib/inventory'
import { byName, isLow } from '../lib/logic'
import type { Product } from '../lib/types'
import { Icon } from '../components/Icon'
import { ProductRow } from '../components/ProductRow'
import { AutoSort } from '../components/AutoSort'

export type StockFilter = 'all' | 'low' | 'expiry'

interface Props {
  placeId: string | null
  filter: StockFilter
  onChange: (placeId: string | null, filter: StockFilter) => void
  onOpen: (p: Product) => void
}

export function Stock({ placeId, filter, onChange, onOpen }: Props) {
  const { products, places, categories } = useInventory()
  const place = places.find((p) => p.id === placeId) ?? null
  const [sorting, setSorting] = useState(false)
  const uncategorized = products.filter((p) => !p.category_id && (!placeId || p.place_id === placeId)).length

  const items = useMemo(() => {
    let list = products.filter((p) => !placeId || p.place_id === placeId)
    if (filter === 'low') list = list.filter(isLow)
    if (filter === 'expiry') list = list.filter((p) => p.expiry_date)
    return filter === 'expiry'
      ? list.sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
      : list.sort(byName)
  }, [products, placeId, filter])

  const lowCount = products.filter((p) => (!placeId || p.place_id === placeId) && isLow(p)).length
  const total = products.filter((p) => !placeId || p.place_id === placeId).length

  const grouped = useMemo(() => {
    if (filter === 'expiry') return null
    const shown = placeId ? places.filter((pl) => pl.id === placeId) : places
    const groups = shown.map((pl) => {
      const inPlace = items.filter((p) => p.place_id === pl.id)
      const cats = categories
        .filter((c) => c.place_id === pl.id)
        .map((c) => ({ id: c.id, name: c.name, items: inPlace.filter((p) => p.category_id === c.id) }))
        .filter((c) => c.items.length)
      const rest = inPlace.filter((p) => !cats.some((c) => c.id === p.category_id))
      if (rest.length) cats.push({ id: `${pl.id}-rest`, name: cats.length ? 'Overig' : '', items: rest })
      return { place: { id: pl.id, name: pl.name, color: pl.color }, cats, count: inPlace.length }
    })
    const orphans = placeId ? [] : items.filter((p) => !places.some((pl) => pl.id === p.place_id))
    if (orphans.length) groups.push({ place: { id: 'none', name: 'Zonder plek', color: '#EEECE7' }, cats: [{ id: 'none-rest', name: '', items: orphans }], count: orphans.length })
    return groups.filter((g) => g.count)
  }, [items, places, categories, placeId, filter])

  return (
    <div className="screen no-pad">
      <div className="place-hero" style={{ background: place?.color ?? '#EAE6DE' }}>
        <div className="place-hero-row">
          <div>
            <h1 className="title">{place?.name ?? 'Alle voorraad'}</h1>
            <span className="subtle">
              {total} {total === 1 ? 'product' : 'producten'} · {lowCount} bijna op
            </span>
          </div>
          <Icon name={place?.icon ?? 'grid'} size={48} stroke={1.4} />
        </div>
        <div className="scroller" role="group" aria-label="Plek kiezen">
          <button type="button" className={`pill ${!placeId ? 'on' : ''}`} aria-pressed={!placeId} onClick={() => onChange(null, filter)}>
            Alles
          </button>
          {places.map((pl) => (
            <button key={pl.id} type="button" className={`pill ${placeId === pl.id ? 'on' : ''}`} aria-pressed={placeId === pl.id} onClick={() => onChange(pl.id, filter)}>
              {pl.name}
            </button>
          ))}
        </div>
        <div className="filters" role="group" aria-label="Filter">
          {(
            [
              ['all', 'Alles'],
              ['low', 'Bijna op'],
              ['expiry', 'Met datum'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={`filter ${filter === id ? 'on' : ''}`} aria-pressed={filter === id} onClick={() => onChange(placeId, id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="list-pad stack-sm">
        {uncategorized > 0 && filter === 'all' && (
          <button type="button" className="sort-banner" onClick={() => setSorting(true)}>
            <Icon name="sparkle" size={18} />
            <span>
              {uncategorized} {uncategorized === 1 ? 'product' : 'producten'} zonder categorie · <u>Automatisch indelen</u>
            </span>
          </button>
        )}
        {sorting && <AutoSort onClose={() => setSorting(false)} />}
        {grouped
          ? grouped.map((g) => (
              <section key={g.place.id} className="stack-sm">
                {!placeId && (
                  <h2 className="eyebrow">
                    <span className="swatch" style={{ background: g.place.color }} />
                    {g.place.name}
                  </h2>
                )}
                {g.cats.map((c) => (
                  <div key={c.id} className="stack-sm">
                    {c.name && (
                      <h3 className="subhead">
                        {c.name} <small>{c.items.length}</small>
                      </h3>
                    )}
                    {c.items.map((p) => (
                      <ProductRow key={p.id} product={p} onOpen={onOpen} />
                    ))}
                  </div>
                ))}
              </section>
            ))
          : items.map((p) => <ProductRow key={p.id} product={p} onOpen={onOpen} showPlace={!placeId} />)}
        {items.length === 0 && (
          <p className="empty">{filter === 'all' ? 'Hier staat nog niets. Tik op de plus om iets toe te voegen.' : 'Niets in deze selectie. Lekker op voorraad!'}</p>
        )}
      </div>
    </div>
  )
}
