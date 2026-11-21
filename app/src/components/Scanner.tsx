import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Icon } from './Icon'

export function Scanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)
  const cb = useRef(onResult)
  cb.current = onResult

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: IScannerControls | undefined
    let cancelled = false
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current!,
        (result, _err, c) => {
          if (result && !done.current) {
            done.current = true
            c.stop()
            if ('vibrate' in navigator) navigator.vibrate(60)
            cb.current(result.getText())
          }
        },
      )
      .then((c) => {
        controls = c
        if (done.current || cancelled) c.stop()
      })
      .catch(() => setError('Geen toegang tot de camera. Sta cameratoegang toe in de instellingen.'))
    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Barcode scannen">
      <video ref={videoRef} playsInline muted />
      <div className="scanner-frame" aria-hidden="true" />
      <div className="scanner-top">
        <span>Richt op de barcode</span>
        <button type="button" className="icon-btn light" onClick={onClose} aria-label="Scanner sluiten">
          <Icon name="close" size={20} stroke={2.4} />
        </button>
      </div>
      {error && <p className="scanner-error">{error}</p>}
    </div>
  )
}
