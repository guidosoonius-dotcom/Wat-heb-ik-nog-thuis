import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import type { Category, Household, Place, Product } from './types'

export type ProductInput = Partial<Omit<Product, 'id' | 'household_id' | 'updated_at'>> & { name: string }

interface Inventory {
  household: Household | null
  places: Place[]
  categories: Category[]
  products: Product[]
  loading: boolean
  toast: string | null
  offline: boolean
  pending: number
  notify: (msg: string) => void
  reload: () => Promise<void>
  adjustQty: (id: string, delta: number) => Promise<void>
  addProduct: (input: ProductInput) => Promise<Product | null>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  finishShopping: () => Promise<number>
  checkItem: (id: string) => Promise<Product | null>
  uncheckItem: (id: string) => Promise<void>
  addPlace: (name: string, color: string, icon?: string) => Promise<Place | null>
  addCategory: (placeId: string, name: string) => Promise<Category | null>
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  updatePlace: (id: string, patch: Partial<Place>) => Promise<void>
  deletePlace: (id: string) => Promise<void>
  renameHousehold: (name: string) => Promise<void>
}

const Ctx = createContext<Inventory | null>(null)

// Wijzigingen die zonder verbinding zijn gedaan en later worden verstuurd.
type Op =
  | { k: 'rpc'; fn: string; args: Record<string, unknown> }
  | { k: 'update'; table: string; id: string; patch: Record<string, unknown> }
  | { k: 'insert'; table: string; row: Record<string, unknown> }

function isNetworkError(err: unknown) {
  if (!navigator.onLine) return true
  const msg = String((err as { message?: string })?.message ?? err)
  return /failed to fetch|network|load failed|fetch failed/i.test(msg)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* opslag vol of geblokkeerd */
  }
}

export function useInventory() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useInventory outside provider')
  return v
}

function upsertLocal<T extends { id: string }>(list: T[], row: T) {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [...list, row]
  const copy = list.slice()
  copy[i] = row
  return copy
}

export function InventoryProvider({ householdId, children }: { householdId: string; children: ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const productsRef = useRef<Product[]>([])
  productsRef.current = products
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [offline, setOffline] = useState(!navigator.onLine)
  const outboxKey = `outbox-${householdId}`
  const snapshotKey = `snapshot-${householdId}`
  const outbox = useRef<Op[]>(readJson<Op[]>(outboxKey, []))
  const [pending, setPending] = useState(outbox.current.length)
  const flushing = useRef(false)

  const queue = useCallback(
    (op: Op) => {
      outbox.current = [...outbox.current, op]
      writeJson(outboxKey, outbox.current)
      setPending(outbox.current.length)
      setOffline(true)
    },
    [outboxKey],
  )

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const fail = useCallback(
    (err: unknown) => {
      console.error(err)
      notify('Er ging iets mis. Controleer je verbinding.')
    },
    [notify],
  )

  const run = useCallback(async (op: Op) => {
    if (op.k === 'rpc') return supabase.rpc(op.fn, op.args)
    if (op.k === 'update') return supabase.from(op.table).update(op.patch).eq('id', op.id)
    return supabase.from(op.table).insert(op.row)
  }, [])

  const flush = useCallback(async () => {
    if (flushing.current || !outbox.current.length) return true
    flushing.current = true
    while (outbox.current.length) {
      const { error } = await run(outbox.current[0])
      if (error && isNetworkError(error)) break
      if (error) console.error('Wijziging overgeslagen', error)
      outbox.current = outbox.current.slice(1)
      writeJson(outboxKey, outbox.current)
      setPending(outbox.current.length)
    }
    flushing.current = false
    return outbox.current.length === 0
  }, [run, outboxKey])

  const reload = useCallback(async () => {
    const synced = await flush()
    const [h, pl, pr, ca] = await Promise.all([
      supabase.from('households').select('id,name,invite_code,shortcut_token').eq('id', householdId).single(),
      supabase.from('places').select('*').eq('household_id', householdId).order('sort'),
      supabase.from('products').select('*').eq('household_id', householdId).order('name'),
      supabase.from('categories').select('*').eq('household_id', householdId).order('sort'),
    ])
    const err = h.error ?? pl.error ?? pr.error ?? ca.error
    if (err) {
      if (isNetworkError(err)) {
        setOffline(true)
        const snap = readJson<{ h: Household; pl: Place[]; pr: Product[]; ca: Category[] } | null>(snapshotKey, null)
        if (snap) {
          setHousehold((cur) => cur ?? snap.h)
          setPlaces((cur) => (cur.length ? cur : snap.pl))
          setCategories((cur) => (cur.length ? cur : snap.ca))
          setProducts((cur) => (cur.length ? cur : snap.pr))
        }
      } else fail(err)
    } else {
      setOffline(!synced)
      setHousehold(h.data as Household)
      setPlaces(pl.data as Place[])
      setCategories(ca.data as Category[])
      // Nog niet verstuurde wijzigingen blijven lokaal zichtbaar tot ze zijn verwerkt.
      if (synced) setProducts(pr.data as Product[])
      writeJson(snapshotKey, { h: h.data, pl: pl.data, pr: pr.data, ca: ca.data })
    }
    setLoading(false)
  }, [householdId, fail, flush, snapshotKey])

  useEffect(() => {
    reload()
    const filter = `household_id=eq.${householdId}`
    const ch = supabase
      .channel(`hh-${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products', filter }, (p) =>
        setProducts((l) => upsertLocal(l, p.new as Product)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products', filter }, (p) =>
        setProducts((l) => upsertLocal(l, p.new as Product)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products' }, (p) =>
        setProducts((l) => l.filter((x) => x.id !== (p.old as { id: string }).id)),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'places', filter }, (p) =>
        setPlaces((l) => upsertLocal(l, p.new as Place).sort((a, b) => a.sort - b.sort)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'places', filter }, (p) =>
        setPlaces((l) => upsertLocal(l, p.new as Place).sort((a, b) => a.sort - b.sort)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'places' }, (p) =>
        setPlaces((l) => l.filter((x) => x.id !== (p.old as { id: string }).id)),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'categories', filter }, (p) =>
        setCategories((l) => upsertLocal(l, p.new as Category).sort((a, b) => a.sort - b.sort)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'categories', filter }, (p) =>
        setCategories((l) => upsertLocal(l, p.new as Category).sort((a, b) => a.sort - b.sort)),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'categories' }, (p) =>
        setCategories((l) => l.filter((x) => x.id !== (p.old as { id: string }).id)),
      )
      .subscribe()
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    const onOnline = () => reload()
    const onOffline = () => setOffline(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [householdId, reload])

  const adjustQty = useCallback(
    async (id: string, delta: number) => {
      setProducts((l) => l.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)))
      const args = { p_id: id, p_delta: delta }
      if (outbox.current.length) return queue({ k: 'rpc', fn: 'adjust_qty', args })
      const { data, error } = await supabase.rpc('adjust_qty', args)
      if (error) return isNetworkError(error) ? queue({ k: 'rpc', fn: 'adjust_qty', args }) : fail(error)
      if (data) setProducts((l) => upsertLocal(l, data as Product))
    },
    [fail, queue],
  )

  const addProduct = useCallback(
    async (input: ProductInput) => {
      const row = { ...input, id: crypto.randomUUID(), household_id: householdId }
      const local = {
        qty: 0, min_qty: 1, place_id: null, category_id: null, expiry_date: null, barcode: null, on_list: false, list_qty: null,
        list_checked: false, list_checked_at: null, image_url: null, size_label: null, pao_months: null, opened_at: null,
        store: null, use_rate: null, updated_at: new Date().toISOString(), ...row,
      } as Product
      const offlineSave = () => {
        queue({ k: 'insert', table: 'products', row })
        setProducts((l) => upsertLocal(l, local))
        return local
      }
      if (outbox.current.length) return offlineSave()
      const { data, error } = await supabase.from('products').insert(row).select().single()
      if (error) {
        if (isNetworkError(error)) return offlineSave()
        fail(error)
        return null
      }
      setProducts((l) => upsertLocal(l, data as Product))
      return data as Product
    },
    [householdId, fail, queue],
  )

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      setProducts((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      const op: Op = { k: 'update', table: 'products', id, patch }
      if (outbox.current.length) return queue(op)
      const { data, error } = await supabase.from('products').update(patch).eq('id', id).select().single()
      if (error) return isNetworkError(error) ? queue(op) : fail(error)
      setProducts((l) => upsertLocal(l, data as Product))
    },
    [fail, queue],
  )

  const deleteProduct = useCallback(
    async (id: string) => {
      setProducts((l) => l.filter((p) => p.id !== id))
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) fail(error)
    },
    [fail],
  )

  const checkItem = useCallback(
    async (id: string) => {
      const cur = productsRef.current.find((p) => p.id === id)
      if (!cur || cur.list_checked) return null
      const n = cur.list_qty ?? Math.max(cur.min_qty - cur.qty, 1)
      const localRow: Product = { ...cur, qty: cur.qty + n, list_qty: n, list_checked: true, list_checked_at: new Date().toISOString() }
      setProducts((l) => l.map((p) => (p.id === id ? localRow : p)))
      const op: Op = { k: 'rpc', fn: 'check_item', args: { p_id: id } }
      if (outbox.current.length) {
        queue(op)
        return localRow
      }
      const { data, error } = await supabase.rpc('check_item', { p_id: id })
      if (error) {
        if (isNetworkError(error)) {
          queue(op)
          return localRow
        }
        fail(error)
        reload()
        return null
      }
      if (data) setProducts((l) => upsertLocal(l, data as Product))
      return (data as Product) ?? null
    },
    [fail, reload, queue],
  )

  const uncheckItem = useCallback(
    async (id: string) => {
      setProducts((l) =>
        l.map((p) => (p.id === id && p.list_checked ? { ...p, qty: Math.max(p.qty - (p.list_qty ?? 0), 0), list_checked: false, list_checked_at: null } : p)),
      )
      const op: Op = { k: 'rpc', fn: 'uncheck_item', args: { p_id: id } }
      if (outbox.current.length) return queue(op)
      const { data, error } = await supabase.rpc('uncheck_item', { p_id: id })
      if (error) {
        if (isNetworkError(error)) return queue(op)
        fail(error)
        reload()
        return
      }
      if (data) setProducts((l) => upsertLocal(l, data as Product))
    },
    [fail, reload, queue],
  )

  const finishShopping = useCallback(async () => {
    const { data, error } = await supabase.rpc('finish_shopping', { p_household: householdId })
    if (error) {
      fail(error)
      return 0
    }
    await reload()
    return (data as number) ?? 0
  }, [householdId, fail, reload])

  const addPlace = useCallback(
    async (name: string, color: string, icon = 'box') => {
      const sort = places.reduce((m, p) => Math.max(m, p.sort), 0) + 1
      const { data, error } = await supabase
        .from('places')
        .insert({ household_id: householdId, name, color, icon, sort })
        .select()
        .single()
      if (error) {
        fail(error)
        return null
      }
      setPlaces((l) => upsertLocal(l, data as Place))
      return data as Place
    },
    [householdId, places, fail],
  )

  const addCategory = useCallback(
    async (placeId: string, name: string) => {
      const sort = categories.filter((c) => c.place_id === placeId).reduce((m, c) => Math.max(m, c.sort), 0) + 1
      const { data, error } = await supabase
        .from('categories')
        .insert({ household_id: householdId, place_id: placeId, name, sort })
        .select()
        .single()
      if (error) {
        fail(error)
        return null
      }
      setCategories((l) => upsertLocal(l, data as Category))
      return data as Category
    },
    [householdId, categories, fail],
  )

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Category>) => {
      setCategories((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      const { error } = await supabase.from('categories').update(patch).eq('id', id)
      if (error) fail(error)
    },
    [fail],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      setCategories((l) => l.filter((c) => c.id !== id))
      setProducts((l) => l.map((p) => (p.category_id === id ? { ...p, category_id: null } : p)))
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) fail(error)
    },
    [fail],
  )

  const updatePlace = useCallback(
    async (id: string, patch: Partial<Place>) => {
      setPlaces((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      const { error } = await supabase.from('places').update(patch).eq('id', id)
      if (error) fail(error)
    },
    [fail],
  )

  const deletePlace = useCallback(
    async (id: string) => {
      setPlaces((l) => l.filter((p) => p.id !== id))
      setProducts((l) => l.map((p) => (p.place_id === id ? { ...p, place_id: null } : p)))
      const { error } = await supabase.from('places').delete().eq('id', id)
      if (error) fail(error)
    },
    [fail],
  )

  const renameHousehold = useCallback(
    async (name: string) => {
      setHousehold((h) => (h ? { ...h, name } : h))
      const { error } = await supabase.from('households').update({ name }).eq('id', householdId)
      if (error) fail(error)
    },
    [householdId, fail],
  )

  const value = useMemo<Inventory>(
    () => ({
      household,
      places,
      categories,
      products,
      loading,
      toast,
      offline,
      pending,
      notify,
      reload,
      adjustQty,
      addProduct,
      updateProduct,
      deleteProduct,
      finishShopping,
      checkItem,
      uncheckItem,
      addPlace,
      addCategory,
      updateCategory,
      deleteCategory,
      updatePlace,
      deletePlace,
      renameHousehold,
    }),
    [household, places, categories, products, loading, toast, offline, pending, notify, reload, adjustQty, addProduct, updateProduct, deleteProduct, finishShopping, checkItem, uncheckItem, addPlace, addCategory, updateCategory, deleteCategory, updatePlace, deletePlace, renameHousehold],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
