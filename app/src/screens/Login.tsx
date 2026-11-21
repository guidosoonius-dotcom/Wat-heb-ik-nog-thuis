import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { InstallHint } from '../components/InstallHint'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1))
    if (!params.get('error')) return null
    window.history.replaceState(null, '', window.location.pathname)
    return params.get('error_code') === 'otp_expired'
      ? 'Deze inloglink is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.'
      : 'Inloggen via de link lukte niet. Vraag hieronder een nieuwe aan.'
  })

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message.includes('rate') ? 'Even geduld: je hebt net al een mail gekregen.' : 'Versturen lukte niet. Klopt het e-mailadres?')
    else setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('Die code klopt niet of is verlopen.')
  }

  return (
    <main className="auth">
      <div className="auth-hero">
        <Logo size={72} />
        <h1>Wat heb ik<br />nog thuis</h1>
        <p className="muted">De voorraad van jullie huis, altijd bij de hand.</p>
      </div>

      {step === 'email' ? (
        <form className="card form" onSubmit={sendCode}>
          <label className="field">
            <span>Je e-mailadres</span>
            <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.nl" />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || !email.includes('@')}>
            {busy ? 'Versturen…' : 'Stuur inlogcode'}
          </button>
          <p className="hint">Geen wachtwoord nodig. Je krijgt een code per mail.</p>
        </form>
      ) : (
        <form className="card form" onSubmit={verify}>
          <label className="field">
            <span>Code uit de mail naar {email}</span>
            <input className="code-input" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="123456" />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || code.length < 6}>
            {busy ? 'Controleren…' : 'Inloggen'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => { setStep('email'); setCode('') }}>
            Ander e-mailadres
          </button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <InstallHint />
    </main>
  )
}
