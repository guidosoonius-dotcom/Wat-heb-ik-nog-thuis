import { useState } from 'react'
import { isIos, isStandalone } from '../lib/push'
import { Icon } from './Icon'

export function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('install-hint-hidden') === '1'
    } catch {
      return false
    }
  })
  if (hidden || !isIos() || isStandalone()) return null
  return (
    <div className="install-hint">
      <Icon name="share" size={20} />
      <p>
        Tik in Safari op <strong>Deel</strong> en kies <strong>Zet op beginscherm</strong>. Dan werkt de app als een echte app, met meldingen.
      </p>
      <button
        type="button"
        className="icon-btn"
        aria-label="Tip verbergen"
        onClick={() => {
          setHidden(true)
          try {
            localStorage.setItem('install-hint-hidden', '1')
          } catch {
            /* ignore */
          }
        }}
      >
        <Icon name="close" size={16} stroke={2.4} />
      </button>
    </div>
  )
}
