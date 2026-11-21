import { useInventory } from '../lib/inventory'
import { STATUS_LABEL, expiryLabel, expirySoon, statusOf } from '../lib/logic'
import type { Product } from '../lib/types'
import { Icon } from './Icon'

export function Stepper({ value, onDec, onInc, label }: { value: number; onDec: () => void; onInc: () => void; label: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={onDec} aria-label={`${label}: één minder`} disabled={value <= 0}>
        <Icon name="minus" size={18} stroke={2.4} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={onInc} aria-label={`${label}: één erbij`}>
        <Icon name="plus" size={18} stroke={2.4} />
      </button>
    </div>
  )
}

export function ProductRow({ product, onOpen, showPlace }: { product: Product; onOpen: (p: Product) => void; showPlace?: boolean }) {
  const { adjustQty, places } = useInventory()
  const status = statusOf(product)
  const place = places.find((pl) => pl.id === product.place_id)
  return (
    <div className="row card">
      {showPlace && (
        <span className="row-tint" style={{ background: place?.color ?? '#EEECE7' }} aria-hidden="true">
          {product.name.charAt(0).toUpperCase()}
        </span>
      )}
      <button type="button" className="row-main" onClick={() => onOpen(product)}>
        <span className="row-name">{product.name}</span>
        <span className="row-meta">
          <span className={`status status-${status}`}>
            <span className="dot" />
            {STATUS_LABEL[status]}
          </span>
          {showPlace && place && <span className="muted">· {place.name}</span>}
          {!showPlace && <span className="muted">min. {product.min_qty}</span>}
          {product.expiry_date && (
            <span className={`badge ${expirySoon(product) ? 'badge-warn' : ''}`}>
              <Icon name="calendar" size={12} stroke={2.4} />
              {expiryLabel(product.expiry_date)}
            </span>
          )}
        </span>
      </button>
      <Stepper
        value={product.qty}
        label={product.name}
        onDec={() => adjustQty(product.id, -1)}
        onInc={() => adjustQty(product.id, 1)}
      />
    </div>
  )
}
