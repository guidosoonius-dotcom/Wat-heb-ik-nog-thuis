import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { InventoryProvider, useInventory } from './lib/inventory'
import { lookupBarcode } from './lib/barcode'
import { onShoppingList } from './lib/logic'
import type { Product } from './lib/types'
import { Login } from './screens/Login'
import { Onboarding } from './screens/Onboarding'
import { SetPassword } from './screens/SetPassword'
import { Home } from './screens/Home'
import { Stock } from './screens/Stock'
import type { StockFilter } from './screens/Stock'
import { Shopping } from './screens/Shopping'
import { HouseholdScreen } from './screens/HouseholdScreen'
import { ProductSheet } from './components/ProductSheet'
import type { SheetRequest } from './components/ProductSheet'
const Scanner = lazy(() => import('./components/Scanner').then((m) => ({ default: m.Scanner })))
import { Icon } from './components/Icon'
import { Logo } from './components/Logo'

type Tab = 'home' | 'stock' | 'list' | 'household'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [householdId, setHouseholdId] = useState<string | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setHouseholdId(session === null ? null : undefined)
      return
    }
    supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)
      .order('created_at')
      .limit(1)
      .then(({ data }) => setHouseholdId(data?.[0]?.household_id ?? null))
  }, [session])

  if (session === undefined || (session && householdId === undefined)) {
    return (
      <div className="splash">
        <Logo size={64} />
      </div>
    )
  }
  if (!session) return <Login />
  if (recovery || !session.user.user_metadata?.has_password) return <SetPassword onDone={() => setRecovery(false)} />
  if (!householdId) return <Onboarding onReady={setHouseholdId} />
  return (
    <InventoryProvider householdId={householdId}>
      <Shell />
    </InventoryProvider>
  )
}

function Shell() {
  const { products, loading, toast, notify } = useInventory()
  const [tab, setTab] = useState<Tab>('home')
  const [stockPlace, setStockPlace] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [sheet, setSheet] = useState<SheetRequest | null>(null)
  const [scanning, setScanning] = useState(false)

  const open = useCallback((p: Product) => setSheet({ product: p }), [])

  const go = (t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  const onScan = useCallback(
    async (code: string) => {
      setScanning(false)
      const found = products.find((p) => p.barcode === code)
      if (found) {
        setSheet({ product: found })
        return
      }
      notify('Product opzoeken…')
      const name = await lookupBarcode(code)
      if (!name) notify('Onbekende barcode. Vul zelf een naam in.')
      setSheet({ name: name ?? '', barcode: code, placeId: stockPlace })
    },
    [products, notify, stockPlace],
  )

  const listCount = products.filter(onShoppingList).length

  return (
    <div className="app">
      <main className="content">
        {loading ? (
          <div className="splash inline">
            <Logo size={48} />
          </div>
        ) : tab === 'home' ? (
          <Home
            onOpen={open}
            onScan={() => setScanning(true)}
            onShowPlace={(id, f) => {
              setStockPlace(id)
              setStockFilter(f ?? 'all')
              go('stock')
            }}
            onShowList={() => go('list')}
            onShowHousehold={() => go('household')}
          />
        ) : tab === 'stock' ? (
          <Stock
            placeId={stockPlace}
            filter={stockFilter}
            onOpen={open}
            onChange={(id, f) => {
              setStockPlace(id)
              setStockFilter(f)
            }}
          />
        ) : tab === 'list' ? (
          <Shopping />
        ) : (
          <HouseholdScreen />
        )}
      </main>

      <nav className="tabbar" aria-label="Hoofdmenu">
        <TabButton icon="home" label="Home" active={tab === 'home'} onClick={() => go('home')} />
        <TabButton icon="grid" label="Voorraad" active={tab === 'stock'} onClick={() => go('stock')} />
        <button type="button" className="fab" aria-label="Product toevoegen" onClick={() => setSheet({ placeId: tab === 'stock' ? stockPlace : null })}>
          <Icon name="plus" size={26} stroke={2.4} />
        </button>
        <TabButton icon="list" label="Lijstje" active={tab === 'list'} onClick={() => go('list')} badge={listCount} />
        <TabButton icon="user" label="Huishouden" active={tab === 'household'} onClick={() => go('household')} />
      </nav>

      {sheet && <ProductSheet key={sheet.product?.id ?? 'new'} request={sheet} onClose={() => setSheet(null)} onOpenProduct={open} />}
      {scanning && <Suspense fallback={null}><Scanner onResult={onScan} onClose={() => setScanning(false)} /></Suspense>}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function TabButton({ icon, label, active, onClick, badge }: { icon: string; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button type="button" className={`tab-btn ${active ? 'on' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} size={24} />
      {label}
      {!!badge && <span className="tab-badge">{badge}</span>}
    </button>
  )
}
