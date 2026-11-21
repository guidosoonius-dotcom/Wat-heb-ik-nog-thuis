import { useInventory } from '../lib/inventory'
import { addMonths, todayIso } from '../lib/logic'
import type { Product } from '../lib/types'
import { Icon } from './Icon'

// Verschijnt als je een product scant dat al in de voorraad staat.
export function ScanAction({ productId, onClose, onEdit }: { productId: string; onClose: () => void; onEdit: (p: Product) => void }) {
  const { products, places, adjustQty, updateProduct, notify } = useInventory()
  const product = products.find((p) => p.id === productId)
  if (!product) return null
  const place = places.find((p) => p.id === product.place_id)

  async function change(delta: number) {
    if (!product) return
    if ('vibrate' in navigator) navigator.vibrate(40)
    await adjustQty(product.id, delta)
    const now = Math.max(0, product.qty + delta)
    notify(`${product.name}: ${delta > 0 ? '+1' : '−1'} (nu ${now})`)
    onClose()
  }

  async function opened() {
    if (!product?.pao_months) return
    const today = todayIso()
    const byPao = addMonths(today, product.pao_months)
    const expiry = product.expiry_date && product.expiry_date < byPao ? product.expiry_date : byPao
    await updateProduct(product.id, { opened_at: today, expiry_date: expiry })
    notify(`Geopend: houdbaar tot ${new Date(expiry + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`)
    onClose()
  }

  return (
    <div className="action-backdrop" onClick={onClose}>
      <div className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="scan-action-title" onClick={(e) => e.stopPropagation()}>
        <div className="action-head">
          {product.image_url ? (
            <img className="action-thumb" src={product.image_url} alt="" />
          ) : (
            <span className="action-thumb tint" style={{ background: place?.color ?? '#EEECE7' }} aria-hidden="true">
              {product.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="action-title">
            <h2 id="scan-action-title">{product.name}</h2>
            <span className="muted small">
              {[place?.name, product.size_label].filter(Boolean).join(' · ')}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Sluiten">
            <Icon name="close" size={18} stroke={2.4} />
          </button>
        </div>
        <div className="action-qty">
          <span>In huis</span>
          <strong>{product.qty}</strong>
        </div>
        <div className="action-buttons">
          <button type="button" className="action-big take" onClick={() => change(-1)} disabled={product.qty === 0}>
            <Icon name="minus" size={26} stroke={2.6} />
            Ik pak er een
          </button>
          <button type="button" className="action-big buy" onClick={() => change(1)}>
            <Icon name="plus" size={26} stroke={2.6} />
            Gekocht
          </button>
        </div>
        {product.pao_months && (
          <button type="button" className="btn-ghost" onClick={opened}>
            <Icon name="calendar" size={18} /> Vandaag geopend ({product.pao_months} mnd houdbaar)
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={() => onEdit(product)}>
          <Icon name="edit" size={18} /> Bewerken
        </button>
      </div>
    </div>
  )
}
