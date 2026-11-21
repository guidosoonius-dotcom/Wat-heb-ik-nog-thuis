import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { CATALOG, CATEGORIES } from '../lib/catalog'
import type { CatalogCategory, CatalogItem } from '../lib/catalog'
import { useInventory } from '../lib/inventory'
import { lookupBarcode } from '../lib/barcode'
import type { BarcodeInfo } from '../lib/barcode'
import { suggestPlace } from '../lib/suggest'
import type { Suggestion } from '../lib/suggest'
import type { Product } from '../lib/types'
import { Icon } from './Icon'
import { Stepper } from './ProductRow'
const Scanner = lazy(() => import('./Scanner').then((m) => ({ default: m.Scanner })))

export interface SheetRequest {
  product?: Product
  name?: string
  barcode?: string
  placeId?: string | null
  info?: BarcodeInfo | null
}

const NEW_PLACE_COLORS = ['#F7DEDD', '#DDEFF0', '#E1E7F5', '#F3E6D8', '#E8E4DA', '#EAE3F3']

export function ProductSheet({ request, onClose, onOpenProduct }: { request: SheetRequest; onClose: () => void; onOpenProduct: (p: Product) => void }) {
  const { places, categories, products, addProduct, updateProduct, deleteProduct, addPlace, addCategory, notify } = useInventory()
  const editing = request.product
  const [name, setName] = useState(editing?.name ?? request.name ?? '')
  const [placeId, setPlaceId] = useState<string | null>(editing?.place_id ?? request.placeId ?? places[0]?.id ?? null)
  const [qty, setQty] = useState(editing?.qty ?? 1)
  const [min, setMin] = useState(editing?.min_qty ?? 1)
  const [expiryOn, setExpiryOn] = useState(!!editing?.expiry_date)
  const [expiry, setExpiry] = useState(editing?.expiry_date ?? '')
  const [barcode, setBarcode] = useState(editing?.barcode ?? request.barcode ?? null)
  const [onList, setOnList] = useState(editing?.on_list ?? false)
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null)
  const [info, setInfo] = useState<BarcodeInfo | null>(request.info ?? null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [touched, setTouched] = useState(!!editing || !!request.placeId)
  const [newCat, setNewCat] = useState<string | null>(null)
  const [newPlace, setNewPlace] = useState<string | null>(null)
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

  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name
  const placeCategories = categories.filter((c) => c.place_id === placeId)
  const pending = suggestion && (!('id' in suggestion.place) || (suggestion.category && !('id' in suggestion.category))) ? suggestion : null

  function apply(s: Suggestion | null) {
    setSuggestion(s)
    setHint(null)
    if (!s || !('id' in s.place)) return
    setPlaceId(s.place.id)
    const cid = s.category && 'id' in s.category ? s.category.id : null
    setCategoryId(cid)
    if (!s.category || 'id' in s.category) {
      const label = [placeName(s.place.id), catName(cid)].filter(Boolean).join(' › ')
      setHint(`Voorgesteld: ${label} (${s.reason})`)
    }
  }

  // Stel automatisch een plek en categorie voor zolang de gebruiker die niet zelf heeft gekozen.
  useEffect(() => {
    if (touched) return
    const t = window.setTimeout(() => apply(suggestPlace({ name, info }, places, categories, products)), info ? 0 : 450)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, info, touched])

  async function acceptSuggestion() {
    if (!pending) return
    let pid: string | null = 'id' in pending.place ? pending.place.id : null
    if (!pid && 'create' in pending.place) {
      const c = pending.place.create
      pid = (await addPlace(c.name, c.color, c.icon))?.id ?? null
      if (pid) notify(`Nieuwe plek: ${c.name}`)
    }
    if (!pid) return
    let cid: string | null = null
    if (pending.category) {
      if ('id' in pending.category) cid = pending.category.id
      else {
        cid = (await addCategory(pid, pending.category.create))?.id ?? null
        if (cid) notify(`Nieuwe categorie: ${pending.category.create}`)
      }
    }
    setPlaceId(pid)
    setCategoryId(cid)
    setSuggestion(null)
    setTouched(true)
  }

  function choosePlace(id: string) {
    setTouched(true)
    setSuggestion(null)
    setHint(null)
    setPlaceId(id)
    if (!categories.some((c) => c.id === categoryId && c.place_id === id)) setCategoryId(null)
  }

  async function createPlace() {
    const n = newPlace?.trim()
    if (!n) return
    const pl = await addPlace(n, NEW_PLACE_COLORS[places.length % NEW_PLACE_COLORS.length])
    if (pl) choosePlace(pl.id)
    setNewPlace(null)
  }

  async function createCategory() {
    const n = newCat?.trim()
    if (!n || !placeId) return
    const c = await addCategory(placeId, n)
    if (c) setCategoryId(c.id)
    setNewCat(null)
    setTouched(true)
  }

  function pick(item: CatalogItem) {
    setName(item.name)
    setMin(item.min)
    const s = suggestPlace({ name: item.name }, places, categories, products)
    if (s) {
      apply(s)
    } else {
      const pl = places.find((p) => p.name.toLowerCase() === item.place.toLowerCase())
      if (pl) setPlaceId(pl.id)
    }
    setTouched(true)
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
      const found = await lookupBarcode(code)
      if (found) {
        setName(found.name)
        setTouched(false)
        setInfo(found)
      } else notify('Barcode niet gevonden. Typ zelf een naam.')
    }
  }

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    const fields = {
      name: name.trim(),
      place_id: placeId,
      category_id: categories.some((c) => c.id === categoryId && c.place_id === placeId) ? categoryId : null,
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

          {pending && (
            <div className="proposal" role="status">
              <Icon name="sparkle" size={18} />
              <div className="proposal-text">
                <strong>
                  {'create' in pending.place
                    ? `Nieuwe plek “${pending.place.create.name}”${pending.category && 'create' in pending.category ? ` met categorie “${pending.category.create}”` : ''}?`
                    : `Nieuwe categorie “${pending.category && 'create' in pending.category ? pending.category.create : ''}” in ${placeName(pending.place.id)}?`}
                </strong>
                <small>Dit lijkt een {pending.reason}.</small>
                <div className="proposal-actions">
                  <button type="button" className="btn-secondary small" onClick={acceptSuggestion}>
                    Aanmaken
                  </button>
                  <button type="button" className="btn-ghost small" onClick={() => { setSuggestion(null); setTouched(true) }}>
                    Nee, zelf kiezen
                  </button>
                </div>
              </div>
            </div>
          )}
          {hint && !pending && (
            <p className="suggest-hint">
              <Icon name="sparkle" size={14} /> {hint}
            </p>
          )}

          <div className="field">
            <span>Plek</span>
            <div className="place-picker" role="group" aria-label="Plek">
              {places.map((p) => (
                <button key={p.id} type="button" aria-pressed={placeId === p.id} className={placeId === p.id ? 'on' : ''} style={{ background: p.color }} onClick={() => choosePlace(p.id)}>
                  {p.name}
                </button>
              ))}
              {newPlace === null ? (
                <button type="button" className="add-dashed" onClick={() => setNewPlace('')}>
                  <Icon name="plus" size={16} stroke={2.4} /> Nieuwe plek
                </button>
              ) : (
                <div className="inline-add span-2">
                  <input autoFocus value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder="Bijv. vriezer" aria-label="Naam nieuwe plek" onKeyDown={(e) => e.key === 'Enter' && createPlace()} />
                  <button type="button" className="btn-secondary small" disabled={!newPlace.trim()} onClick={createPlace}>
                    Maak
                  </button>
                  <button type="button" className="icon-btn plain" aria-label="Annuleer" onClick={() => setNewPlace(null)}>
                    <Icon name="close" size={16} stroke={2.4} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {placeId && (
            <div className="field">
              <span>Categorie <span className="muted">(optioneel)</span></span>
              <div className="chips" role="group" aria-label="Categorie">
                {placeCategories.map((c) => (
                  <button key={c.id} type="button" aria-pressed={categoryId === c.id} className={`chip ${categoryId === c.id ? 'on' : ''}`} onClick={() => { setCategoryId(categoryId === c.id ? null : c.id); setTouched(true); setHint(null) }}>
                    {c.name}
                  </button>
                ))}
                {newCat === null ? (
                  <button type="button" className="chip chip-dashed" onClick={() => setNewCat('')}>
                    <Icon name="plus" size={14} stroke={2.6} /> Nieuw
                  </button>
                ) : (
                  <div className="inline-add">
                    <input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Bijv. broodbeleg" aria-label="Naam nieuwe categorie" onKeyDown={(e) => e.key === 'Enter' && createCategory()} />
                    <button type="button" className="btn-secondary small" disabled={!newCat.trim()} onClick={createCategory}>
                      Maak
                    </button>
                    <button type="button" className="icon-btn plain" aria-label="Annuleer" onClick={() => setNewCat(null)}>
                      <Icon name="close" size={16} stroke={2.4} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

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
          {editing ? 'Opslaan' : `Opslaan${placeName(placeId) ? ` in ${placeName(placeId)}` : ''}`}
        </button>
      </div>

      {scanning && <Suspense fallback={null}><Scanner onResult={onScan} onClose={() => setScanning(false)} /></Suspense>}
    </div>
  )
}
