import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

export function Onboarding({ onReady }: { onReady: (householdId: string) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_household', { p_name: 'Ons huis' })
    setBusy(false)
    if (error) setError('Aanmaken lukte niet. Probeer het opnieuw.')
    else onReady(data as string)
  }

  async function join() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_household', { p_code: code })
    setBusy(false)
    if (error) setError('Die code kennen we niet. Controleer hem nog eens.')
    else onReady(data as string)
  }

  return (
    <main className="auth">
      <div className="auth-hero">
        <Logo size={64} />
        <h1>Welkom!</h1>
        <p className="muted">Begin een nieuwe voorraad, of doe mee met die van je partner.</p>
      </div>
      <div className="card form">
        <h2 className="h3">Nieuw huishouden</h2>
        <p className="hint">Met de plekken keuken, bijkeuken, voorraadkast (Marvat) en badkamer.</p>
        <button type="button" className="btn-primary" disabled={busy} onClick={create}>
          Start onze voorraad
        </button>
      </div>
      <div className="card form">
        <h2 className="h3">Meedoen met een code</h2>
        <label className="field">
          <span>Uitnodigingscode</span>
          <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="A1B2C3" autoCapitalize="characters" />
        </label>
        <button type="button" className="btn-secondary" disabled={busy || code.length < 6} onClick={join}>
          Doe mee
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  )
}
