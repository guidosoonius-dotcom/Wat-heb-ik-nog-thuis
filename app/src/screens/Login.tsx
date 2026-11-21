import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { InstallHint } from '../components/InstallHint'

type Mode = 'login' | 'signup' | 'reset'

function initialError() {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1))
  if (!params.get('error')) return null
  window.history.replaceState(null, '', window.location.pathname)
  return params.get('error_code') === 'otp_expired'
    ? 'Deze link is verlopen of al gebruikt. Probeer het opnieuw.'
    : 'Die link werkte niet. Probeer het opnieuw.'
}

export function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [info, setInfo] = useState<string | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const mail = email.trim()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (error) {
        setError(
          error.message.toLowerCase().includes('not confirmed')
            ? 'Bevestig eerst je e-mailadres via de link in de mail.'
            : 'E-mailadres of wachtwoord klopt niet. Eerder ingelogd via een mail? Kies dan "Wachtwoord vergeten".',
        )
      }
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { emailRedirectTo: window.location.origin, data: { has_password: true } },
      })
      if (error) {
        setError(
          error.message.toLowerCase().includes('registered')
            ? 'Dit e-mailadres heeft al een account. Log in, of kies "Wachtwoord vergeten".'
            : error.message.toLowerCase().includes('password')
              ? 'Kies een wachtwoord van minstens 6 tekens.'
              : 'Account maken lukte niet. Probeer het opnieuw.',
        )
      } else if (!data.session) {
        setInfo('Bijna klaar! Klik op de bevestigingslink in de mail en log daarna hier in.')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin })
      if (error) setError('Versturen lukte niet. Probeer het over een paar minuten opnieuw.')
      else setInfo('Check je mail en open de link. Je kunt dan een nieuw wachtwoord kiezen en daarna hier inloggen.')
    }
    setBusy(false)
  }

  const title = mode === 'login' ? 'Inloggen' : mode === 'signup' ? 'Account maken' : 'Wachtwoord vergeten'

  return (
    <main className="auth">
      <div className="auth-hero">
        <Logo size={72} />
        <h1>
          Wat heb ik
          <br />
          nog thuis
        </h1>
        <p className="muted">De voorraad van jullie huis, altijd bij de hand.</p>
      </div>

      {mode !== 'reset' && (
        <div className="filters auth-tabs" role="tablist" aria-label="Inloggen of account maken">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={`filter ${mode === 'login' ? 'on' : ''}`} onClick={() => switchMode('login')}>
            Inloggen
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={`filter ${mode === 'signup' ? 'on' : ''}`} onClick={() => switchMode('signup')}>
            Account maken
          </button>
        </div>
      )}

      <form className="card form" onSubmit={submit} aria-label={title}>
        {mode === 'reset' && <h2 className="h3">Wachtwoord vergeten</h2>}
        <label className="field">
          <span>E-mailadres</span>
          <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.nl" />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            <span>Wachtwoord</span>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Minstens 6 tekens' : ''}
            />
          </label>
        )}
        <button type="submit" className="btn-primary" disabled={busy || !email.includes('@') || (mode !== 'reset' && password.length < 6)}>
          {busy ? 'Even geduld…' : mode === 'login' ? 'Inloggen' : mode === 'signup' ? 'Account maken' : 'Stuur herstelmail'}
        </button>
        {mode === 'login' && (
          <button type="button" className="btn-ghost" onClick={() => switchMode('reset')}>
            Wachtwoord vergeten?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="btn-ghost" onClick={() => switchMode('login')}>
            Terug naar inloggen
          </button>
        )}
        {mode === 'signup' && <p className="hint">Je partner maakt een eigen account en doet daarna mee met jullie uitnodigingscode.</p>}
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="notice static" role="status">
          {info}
        </p>
      )}
      <InstallHint />
    </main>
  )
}
