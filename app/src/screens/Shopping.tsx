import { useEffect, useMemo, useState } from 'react'
import { useInventory } from '../lib/inventory'
import { byName, inBasket, isLow, needed, onShoppingList, staleBasket } from '../lib/logic'
import type { Product } from '../lib/types'
import { Icon } from '../components/Icon'

export function Shopping() {
  const { products, places, updateProduct, addProduct, finishShopping, checkItem, uncheckItem, notify } = useInventory()
  const [adding, setAdding] = useState(false)
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => products.filter(onShoppingList).sort(byName), [products])
  const todo = list.filter((p) => !p.list_checked)
  const done = list.filter(inBasket)

  // Ruim een mandje van een eerdere boodschappenronde stilletjes op.
  useEffect(() => {
    products.filter(staleBasket).forEach((p) => updateProduct(p.id, { list_checked: false, list_checked_at: null, on_list: false, list_qty: null }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function check(p: Product) {
    const n = needed(p)
    if ('vibrate' in navigator) navigator.vibrate(30)
    const row = await checkItem(p.id)
    if (row) notify(`${p.name}: +${n} in voorraad (nu ${row.qty})`)
  }
  const pct = list.length ? Math.round((done.length / list.length) * 100) : 0

  const extraMatches = useMemo(() => {
    const q = extra.trim().toLowerCase()
    return products.filter((p) => !onShoppingList(p) && (!q || p.name.toLowerCase().includes(q))).sort(byName).slice(0, 8)
  }, [products, extra])

  const placeOf = (p: Product) => places.find((pl) => pl.id === p.place_id)

  async function finish() {
    setBusy(true)
    const n = await finishShopping()
    setBusy(false)
    notify(n ? 'Mandje geleegd. Tot de volgende keer!' : 'Het mandje was al leeg')
  }

  async function addExtraNew() {
    const name = extra.trim()
    if (!name) return
    await addProduct({ name, qty: 0, min_qty: 0, on_list: true, list_qty: 1, place_id: places[0]?.id ?? null })
    setExtra('')
    setAdding(false)
    notify(`${name} staat op het lijstje`)
  }

  function setAmount(p: Product, n: number) {
    if (n < 1) return
    updateProduct(p.id, { list_qty: n })
  }

  return (
    <div className="screen with-footer">
      <header className="stack-xs">
        <h1 className="title">Boodschappen</h1>
        <span className="muted">Vink af wat je koopt: de voorraad wordt meteen bijgewerkt</span>
      </header>

      {list.length > 0 && (
        <div className="card progress">
          <div className="progress-top">
            <span>
              {done.length} van {list.length} in het mandje
            </span>
            <span className="muted">{pct}%</span>
          </div>
          <div className="bar">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {todo.length > 0 && (
        <section className="stack-sm">
          <h2 className="eyebrow">Nog halen</h2>
          {todo.map((p) => (
            <div key={p.id} className="shop-row card">
              <button type="button" className="shop-check" aria-pressed="false" aria-label={`${p.name} in het mandje`} onClick={() => check(p)}>
                <span className="box" />
                <span className="shop-text">
                  <strong>{p.name}</strong>
                  <small>
                    {placeOf(p)?.name ?? 'Zonder plek'} · nog {p.qty} thuis
                    {!isLow(p) && p.on_list ? ' · extra' : ''}
                  </small>
                </span>
              </button>
              <div className="amount" style={{ background: placeOf(p)?.color ?? '#EEECE7' }}>
                <button type="button" aria-label={`Minder ${p.name}`} onClick={() => setAmount(p, needed(p) - 1)} disabled={needed(p) <= 1}>
                  <Icon name="minus" size={14} stroke={2.6} />
                </button>
                <span>+{needed(p)}</span>
                <button type="button" aria-label={`Meer ${p.name}`} onClick={() => setAmount(p, needed(p) + 1)}>
                  <Icon name="plus" size={14} stroke={2.6} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="stack-sm">
          <h2 className="eyebrow">In het mandje · al in voorraad</h2>
          {done.map((p) => (
            <button key={p.id} type="button" className="shop-done" aria-pressed="true" onClick={() => uncheckItem(p.id)} aria-label={`${p.name} terug op het lijstje, voorraad weer −${needed(p)}`}>
              <span className="box on">
                <Icon name="check" size={16} stroke={3} />
              </span>
              <span className="strike">{p.name}</span>
              <span className="strong">+{needed(p)}</span>
            </button>
          ))}
        </section>
      )}

      {list.length === 0 && <p className="empty">Het lijstje is leeg. Alles is op voorraad!</p>}

      {!adding ? (
        <button type="button" className="dashed" onClick={() => setAdding(true)}>
          <Icon name="plus" size={20} stroke={2.2} /> Iets extra op het lijstje
        </button>
      ) : (
        <div className="card form">
          <label className="field">
            <span>Wat wil je extra halen?</span>
            <input autoFocus value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Zoek of typ een naam" />
          </label>
          <div className="chips">
            {extraMatches.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => {
                  updateProduct(p.id, { on_list: true })
                  setExtra('')
                  setAdding(false)
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setExtra('') }}>
              Annuleer
            </button>
            {extra.trim() && !products.some((p) => p.name.toLowerCase() === extra.trim().toLowerCase()) && (
              <button type="button" className="btn-secondary" onClick={addExtraNew}>
                Voeg “{extra.trim()}” toe
              </button>
            )}
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div className="footer-cta">
          <button type="button" className="btn-primary" disabled={busy || done.length === 0} onClick={finish}>
            <Icon name="check" size={20} stroke={2.4} />
            {done.length === 0 ? 'Vink af wat je in je mandje legt' : `Klaar met boodschappen (${done.length})`}
          </button>
        </div>
      )}
    </div>
  )
}
