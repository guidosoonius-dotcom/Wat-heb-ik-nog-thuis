import { useState } from 'react'
import { useInventory } from '../lib/inventory'
import { suggestPlace } from '../lib/suggest'
import type { Suggestion } from '../lib/suggest'
import type { Product } from '../lib/types'
import { Icon } from './Icon'

interface Proposal {
  product: Product
  suggestion: Suggestion
  from: string
  to: string
  newPlace: boolean
  newCategory: boolean
}

export function AutoSort({ onClose }: { onClose: () => void }) {
  const { products, places, categories, addPlace, addCategory, updateProduct, notify } = useInventory()
  const [busy, setBusy] = useState(false)

  // Eenmalig berekenen bij openen, zodat de lijst niet verschuift tijdens het toepassen.
  const [proposals] = useState<Proposal[]>(() => {
    const placeName = (id: string | null) => places.find((p) => p.id === id)?.name ?? 'Zonder plek'
    const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? ''
    const list: Proposal[] = []
    for (const p of products) {
      if (p.category_id) continue
      const others = products.filter((x) => x.id !== p.id)
      const s = suggestPlace({ name: p.name }, places, categories, others)
      if (!s) continue
      const samePlace = 'id' in s.place && s.place.id === p.place_id
      if (samePlace && !s.category) continue
      const targetPlace = 'id' in s.place ? placeName(s.place.id) : s.place.create.name
      const targetCat = !s.category ? '' : 'id' in s.category ? catName(s.category.id) : s.category.create
      list.push({
        product: p,
        suggestion: s,
        from: placeName(p.place_id),
        to: [targetPlace, targetCat].filter(Boolean).join(' › '),
        newPlace: 'create' in s.place,
        newCategory: !!s.category && 'create' in s.category,
      })
    }
    return list.sort((a, b) => a.to.localeCompare(b.to, 'nl') || a.product.name.localeCompare(b.product.name, 'nl'))
  })

  const [off, setOff] = useState<Set<string>>(() => new Set())
  const chosen = proposals.filter((p) => !off.has(p.product.id))
  const [uncategorized] = useState(() => products.filter((p) => !p.category_id).length)

  function toggle(id: string) {
    const next = new Set(off)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOff(next)
  }

  async function apply() {
    setBusy(true)
    const placeIds = new Map<string, string>() // naam nieuwe plek -> id
    const catIds = new Map<string, string>() // plekId|naam -> id
    let done = 0
    for (const { product, suggestion: s } of chosen) {
      let pid: string | undefined
      if ('id' in s.place) pid = s.place.id
      else {
        const key = s.place.create.name.toLowerCase()
        pid = placeIds.get(key) ?? (await addPlace(s.place.create.name, s.place.create.color, s.place.create.icon))?.id
        if (pid) placeIds.set(key, pid)
      }
      if (!pid) continue
      let cid: string | null = null
      if (s.category) {
        if ('id' in s.category) cid = s.category.id
        else {
          const key = `${pid}|${s.category.create.toLowerCase()}`
          cid = catIds.get(key) ?? (await addCategory(pid, s.category.create))?.id ?? null
          if (cid) catIds.set(key, cid)
        }
      }
      await updateProduct(product.id, { place_id: pid, category_id: cid })
      done++
    }
    setBusy(false)
    notify(`${done} ${done === 1 ? 'product' : 'producten'} ingedeeld`)
    onClose()
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="autosort-title">
      <div className="sheet-scroll">
        <div className="sheet-head">
          <h1 id="autosort-title">Automatisch indelen</h1>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Sluiten">
            <Icon name="close" size={18} stroke={2.4} />
          </button>
        </div>
        {proposals.length > 0 ? (
          <>
            <p className="hint">
              Voorstel voor {proposals.length} van de {uncategorized} producten zonder categorie. Haal het vinkje weg bij wat je zo wilt laten.
            </p>
            <div className="stack-sm">
              {proposals.map((p) => {
                const on = !off.has(p.product.id)
                return (
                  <button key={p.product.id} type="button" className={`sort-row card ${on ? '' : 'off'}`} aria-pressed={on} onClick={() => toggle(p.product.id)}>
                    <span className={`box ${on ? 'on' : ''}`}>{on && <Icon name="check" size={16} stroke={3} />}</span>
                    <span className="sort-text">
                      <strong>{p.product.name}</strong>
                      <small>
                        {p.from !== p.to.split(' › ')[0] && <span className="muted">{p.from} → </span>}
                        {p.to}
                        {(p.newPlace || p.newCategory) && <span className="cat-chip new">nieuw</span>}
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <p className="empty">{uncategorized ? 'Voor de producten zonder categorie weet de app geen goede plek. Deel ze zelf in via het product.' : 'Alles is al ingedeeld!'}</p>
        )}
      </div>
      {proposals.length > 0 && (
        <div className="sheet-foot">
          <button type="button" className="btn-primary" disabled={busy || chosen.length === 0} onClick={apply}>
            {busy ? 'Bezig met indelen…' : `Toepassen (${chosen.length})`}
          </button>
        </div>
      )}
    </div>
  )
}
