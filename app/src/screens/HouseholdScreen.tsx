import { useEffect, useState } from 'react'
import { useInventory } from '../lib/inventory'
import { supabase } from '../lib/supabase'
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from '../lib/push'
import { Icon } from '../components/Icon'
import { AutoSort } from '../components/AutoSort'

const COLORS = ['#F6E7D3', '#ECE4F1', '#E3EEDF', '#DCEBF3', '#F7DEDD', '#EEECE7']

export function HouseholdScreen() {
  const { household, places, categories, products, renameHousehold, addPlace, updatePlace, deletePlace, addCategory, deleteCategory, notify } = useInventory()
  const [catDraft, setCatDraft] = useState<Record<string, string>>({})
  const [sorting, setSorting] = useState(false)
  const [members, setMembers] = useState(1)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newPlace, setNewPlace] = useState('')

  useEffect(() => {
    if (!household) return
    supabase
      .from('household_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('household_id', household.id)
      .then(({ count }) => setMembers(count ?? 1))
    currentSubscription().then((s) => setPushOn(!!s))
  }, [household])

  if (!household) return null

  async function share() {
    const text = `Doe mee met onze voorraad in "Wat heb ik nog thuis". Open ${window.location.origin} en gebruik code ${household!.invite_code}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        /* geannuleerd */
      }
    } else {
      await navigator.clipboard.writeText(text)
      notify('Uitnodiging gekopieerd')
    }
  }

  async function togglePush() {
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
        notify('Meldingen uit')
      } else {
        await enablePush(household!.id)
        setPushOn(true)
        notify('Meldingen aan')
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Meldingen aanzetten lukte niet')
    }
    setPushBusy(false)
  }

  const needsInstall = isIos() && !isStandalone()

  return (
    <div className="screen">
      <header className="stack-xs">
        <h1 className="title">Huishouden</h1>
        <span className="muted">
          {members} {members === 1 ? 'persoon' : 'personen'} · {products.length} producten
        </span>
      </header>

      <section className="card form">
        <label className="field">
          <span>Naam</span>
          <input defaultValue={household.name} onBlur={(e) => e.target.value.trim() && e.target.value !== household.name && renameHousehold(e.target.value.trim())} />
        </label>
      </section>

      <section className="card form invite">
        <h2 className="h3">Partner uitnodigen</h2>
        <p className="hint">Laat je partner inloggen en deze code invullen. Daarna zien jullie dezelfde voorraad.</p>
        <div className="invite-code" aria-label={`Code ${household.invite_code.split('').join(' ')}`}>{household.invite_code}</div>
        <button type="button" className="btn-secondary" onClick={share}>
          <Icon name="share" size={18} /> Deel uitnodiging
        </button>
      </section>

      <section className="card form">
        <h2 className="h3">Meldingen</h2>
        <p className="hint">Krijg een seintje zodra iets binnen 30 dagen verloopt.</p>
        {needsInstall ? (
          <p className="notice static">Zet de app eerst op je beginscherm (Deel → Zet op beginscherm) en open hem van daaruit. Dan kun je meldingen aanzetten.</p>
        ) : !pushSupported() ? (
          <p className="notice static">Dit apparaat ondersteunt geen meldingen.</p>
        ) : (
          <button type="button" className="switch-row" aria-pressed={pushOn} disabled={pushBusy} onClick={togglePush}>
            <span>
              <Icon name="bell" size={18} /> Houdbaarheidsmeldingen
            </span>
            <span className={`switch ${pushOn ? 'on' : ''}`} aria-hidden="true">
              <span />
            </span>
          </button>
        )}
      </section>

      <section className="card form">
        <h2 className="h3">Plekken en categorieën</h2>
        {products.some((p) => !p.category_id) && (
          <button type="button" className="btn-secondary" onClick={() => setSorting(true)}>
            <Icon name="sparkle" size={18} /> Automatisch indelen ({products.filter((p) => !p.category_id).length} zonder categorie)
          </button>
        )}
        <div className="stack-xs">
          {places.map((pl) => (
            <div key={pl.id} className="stack-xs">
            <div className="place-edit">
              <button
                type="button"
                className="swatch big"
                style={{ background: pl.color }}
                aria-label={`Kleur van ${pl.name} wijzigen`}
                onClick={() => updatePlace(pl.id, { color: COLORS[(COLORS.indexOf(pl.color) + 1) % COLORS.length] })}
              />
              {editing === pl.id ? (
                <input
                  autoFocus
                  value={draft}
                  aria-label="Naam van de plek"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft.trim()) updatePlace(pl.id, { name: draft.trim() })
                    setEditing(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button type="button" className="place-name" onClick={() => { setEditing(pl.id); setDraft(pl.name) }}>
                  {pl.name}
                  <Icon name="edit" size={16} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn plain"
                aria-label={`${pl.name} verwijderen`}
                onClick={() => {
                  const n = products.filter((p) => p.place_id === pl.id).length
                  if (window.confirm(n ? `${pl.name} verwijderen? ${n} producten komen dan zonder plek te staan.` : `${pl.name} verwijderen?`)) deletePlace(pl.id)
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
            <div className="cat-list" aria-label={`Categorieën in ${pl.name}`}>
              {categories
                .filter((c) => c.place_id === pl.id)
                .map((c) => (
                  <span key={c.id} className="cat-tag">
                    {c.name}
                    <button
                      type="button"
                      aria-label={`Categorie ${c.name} verwijderen`}
                      onClick={() => {
                        const n = products.filter((p) => p.category_id === c.id).length
                        if (!n || window.confirm(`${c.name} verwijderen? ${n} producten verliezen dan hun categorie.`)) deleteCategory(c.id)
                      }}
                    >
                      <Icon name="close" size={14} stroke={2.4} />
                    </button>
                  </span>
                ))}
            </div>
            <form
              className="cat-add"
              onSubmit={(e) => {
                e.preventDefault()
                const n = catDraft[pl.id]?.trim()
                if (!n) return
                addCategory(pl.id, n)
                setCatDraft({ ...catDraft, [pl.id]: '' })
              }}
            >
              <input value={catDraft[pl.id] ?? ''} onChange={(e) => setCatDraft({ ...catDraft, [pl.id]: e.target.value })} placeholder="Categorie toevoegen" aria-label={`Categorie toevoegen aan ${pl.name}`} />
            </form>
            </div>
          ))}
        </div>
        <form
          className="place-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newPlace.trim()) return
            addPlace(newPlace.trim(), COLORS[places.length % COLORS.length])
            setNewPlace('')
          }}
        >
          <input value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder="Nieuwe plek, bijv. schuur" aria-label="Nieuwe plek" />
          <button type="submit" className="btn-secondary small" disabled={!newPlace.trim()}>
            Voeg toe
          </button>
        </form>
      </section>

      {sorting && <AutoSort onClose={() => setSorting(false)} />}

      <button type="button" className="btn-ghost logout" onClick={() => supabase.auth.signOut()}>
        <Icon name="logout" size={18} /> Uitloggen
      </button>
    </div>
  )
}
