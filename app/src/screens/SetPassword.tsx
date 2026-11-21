import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

// Wordt getoond na een herstel-link, of voor accounts die nog via een maillink zijn aangemaakt.
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } })
    setBusy(false)
    if (error) setError(error.message.toLowerCase().includes('different') ? 'Kies een ander wachtwoord dan je vorige.' : 'Opslaan lukte niet. Probeer het opnieuw.')
    else onDone()
  }

  return (
    <main className="auth">
      <div className="auth-hero">
        <Logo size={64} />
        <h1>Kies een wachtwoord</h1>
        <p className="muted">Daarmee log je in de app op je beginscherm in. Je hoeft dan nooit meer op een mail te wachten.</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>Nieuw wachtwoord</span>
          <input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minstens 6 tekens" />
        </label>
        <button type="submit" className="btn-primary" disabled={busy || password.length < 6}>
          {busy ? 'Opslaan…' : 'Wachtwoord opslaan'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
