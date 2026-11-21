import { Suspense, lazy, useMemo, useState } from 'react'
import { CATALOG, CATEGORIES } from '../lib/catalog'
import type { CatalogCategory, CatalogItem } from '../lib/catalog'
import { useInventory } from '../lib/inventory'
import { lookupBarcode } from '../lib/barcode'
import type { Product } from '../lib/types'
import { Icon } from './Icon'
import { Stepper } from './ProductRow'
const Scanner = lazy(() => import('./Scanner').then((m) => ({ default: m.Scanner })))

export interface SheetRequest {
  product?: Product
  name?: string
  barcode?: string
  placeId?: string | null
}

export function ProductSheet({ request, onClose, onOpenProduct }: { request: SheetRequest; onClose: () => void; onOpenProduct: (p: Product) => void }) {
  const { places, products, addProduct, updateProduct, deleteProduct, notify } = useInventory()
  const editing = request.product
  const [name, setName] = useState(editing?.name ?? request.name ?? '')
  const [placeId, setPlaceId] = useState<string | null>(editing?.place_id ?? request.placeId ?? places[0]?.id ?? null)
  const [qty, setQty] = useState(editing?.qty ?? 1)
  const [min, setMin] = useState(editing?.min_qty ?? 1)
  const [expiryOn, setExpiryOn] = useState(!!editing?.expiry_date)
  const [expiry, setExpiry] = useState(editing?.expiry_date ?? '')
  const [barcode, setBarcode] = useState(editing?.barcode ?? request.barcode ?? null)
  const [onList, setOnList] = useState(editing?.on_list ?? false)
  const [cat, setCat] = useState<CatalogCategory>('Verzorging')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const existingNames = useMemo(() => new Set(products.map((p) => p.name.toLowerCase())), [products])
  const duplicate = !editing ? products.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase()
    const list = q ? CATALOG.filter((c) => c.name.toLowerCase().includes(q)) : CATALOG.filter((c) => c.cat === cat)
    return list.filter((c) => !existingNames.has(c.name.toLowerCase())).slice(0, 18)
  }, [name, cat, existingNames])

  function pick(item: CatalogItem) {
    setName(item.name)
    setMin(item.min)
    const pl = places.find((p) => p.name.toLowerCase() === item.place.toLowerCase())
    if (pl) setPlaceId(pl.id)
  }

  async function onScan(code: string) {
    setScanning(false)
    setBarcode(code)
    const found = products.find((p) => p.barcode === code)
    if (found) {
      onOpenProduct(found)
      return
    }
    if (!name.trim()) {
      notify('Product opzoeken…')
      const n = await lookupBarcode(code)
      if (n) setName(n)
      else notify('Barcode niet gevonden. Typ zelf een naam.')
    }
  }

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    const fields = {
      name: name.trim(),
      place_id: placeId,
      qty,
      min_qty: min,
      expiry_date: expiryOn && expiry ? expiry : null,
      barcode,
      on_list: onList,
    }
    if (editing) {
      await updateProduct(editing.id, fields)
      notify('Opgeslagen')
    } else {
      const p = await addProduct(fields)
      if (p) notify(`${p.name} toegevoegd`)
    }
    setBusy(false)
    onClose()
  }

  async function remove() {
    if (!editing) return
    await deleteProduct(editing.id)
    notify(`${editing.name} verwijderd`)
    onClose()
  }

  const placeName = places.find((p) => p.id === placeId)?.name

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet-scroll">
        <div className="sheet-head">
          <h1 id="sheet-title">{editing ? 'Product bewerken' : 'Product toevoegen'}</h1>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Sluiten">
            <Icon name="close" size={18} stroke={2.4} />
          </button>
        </div>

        {!editing && (
          <>
            <button type="button" className="scan-cta" onClick={() => setScanning(true)}>
              <span className="scan-cta-icon">
                <Icon name="scan" size={26} />
              </span>
              <span>
                <strong>Scan barcode</strong>
                <small>{barcode ? `Gescand: ${barcode}` : 'Naam wordt automatisch ingevuld'}</small>
              </span>
            </button>

            <section className="stack-sm">
              <h2 className="eyebrow">Of kies uit de startlijst</h2>
              {!name.trim() && (
                <div className="tabs" role="tablist" aria-label="Categorie">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" role="tab" aria-selected={cat === c} className={`tab ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="chips">
                {suggestions.map((s) => (
                  <button key={s.name} type="button" className={`chip ${name === s.name ? 'on' : ''}`} onClick={() => pick(s)}>
                    {s.name}
                  </button>
                ))}
                {suggestions.length === 0 && <span className="muted small">Geen suggesties. Typ hieronder je eigen naam.</span>}
              </div>
            </section>
          </>
        )}

        <div className="card form">
          <label className="field">
            <span>Naam</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. tandpasta" autoComplete="off" />
          </label>
          {duplicate && (
            <button type="button" className="notice" onClick={() => onOpenProduct(duplicate)}>
              Staat al in je voorraad. <u>Open {duplicate.name}</u>
            </button>
          )}

          <div className="field">
            <span>Plek</span>
            <div className="place-picker" role="group" aria-label="Plek">
              {places.map((p) => (
                <button key={p.id} type="button" aria-pressed={placeId === p.id} className={placeId === p.id ? 'on' : ''} style={{ background: p.color }} onClick={() => setPlaceId(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <span>Nu in huis</span>
              <Stepper value={qty} label="In huis" onDec={() => setQty(Math.max(0, qty - 1))} onInc={() => setQty(qty + 1)} />
            </div>
            <div className="field">
              <span>Minimaal</span>
              <Stepper value={min} label="Minimum" onDec={() => setMin(Math.max(0, min - 1))} onInc={() => setMin(min + 1)} />
            </div>
          </div>
          <p className="hint">Onder het minimum komt het vanzelf op het lijstje.</p>

          <button type="button" className="switch-row" aria-pressed={expiryOn} onClick={() => setExpiryOn(!expiryOn)}>
            <span>
              <Icon name="calendar" size={18} />
              <span>
                Houdbaarheid bijhouden <span className="muted">(optioneel)</span>
              </span>
            </span>
            <span className={`switch ${expiryOn ? 'on' : ''}`} aria-hidden="true">
              <span />
            </span>
          </button>
          {expiryOn && (
            <label className="field">
              <span>Houdbaar tot</span>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </label>
          )}

          {editing && (
            <button type="button" className="switch-row" aria-pressed={onList} onClick={() => setOnList(!onList)}>
              <span>
                <Icon name="bag" size={18} />
                Toch op het lijstje zetten
              </span>
              <span className={`switch ${onList ? 'on' : ''}`} aria-hidden="true">
                <span />
              </span>
            </button>
          )}
        </div>

        {editing && (
          <div className="danger-zone">
            {!confirmDelete ? (
              <button type="button" className="link-danger" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={18} /> Product verwijderen
              </button>
            ) : (
              <div className="confirm">
                <span>Weet je het zeker?</span>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Nee
                </button>
                <button type="button" className="btn-danger" onClick={remove}>
                  Verwijder
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sheet-foot">
        <button type="button" className="btn-primary" disabled={!name.trim() || busy} onClick={save}>
          {editing ? 'Opslaan' : `Opslaan${placeName ? ` in ${placeName}` : ''}`}
        </button>
      </div>

      {scanning && <Suspense fallback={null}><Scanner onResult={onScan} onClose={() => setScanning(false)} /></Suspense>}
    </div>
  )
}
