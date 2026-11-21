import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import type { Household, Place, Product } from './types'

export type ProductInput = Partial<Omit<Product, 'id' | 'household_id' | 'updated_at'>> & { name: string }

interface Inventory {
  household: Household | null
  places: Place[]
  products: Product[]
  loading: boolean
  toast: string | null
  notify: (msg: string) => void
  reload: () => Promise<void>
  adjustQty: (id: string, delta: number) => Promise<void>
  addProduct: (input: ProductInput) => Promise<Product | null>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  finishShopping: () => Promise<number>
  addPlace: (name: string, color: string) => Promise<void>
  updatePlace: (id: string, patch: Partial<Place>) => Promise<void>
  deletePlace: (id: string) => Promise<void>
  renameHousehold: (name: string) => Promise<void>
}

const Ctx = createContext<Inventory | null>(null)

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
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

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

  const reload = useCallback(async () => {
    const [h, pl, pr] = await Promise.all([
      supabase.from('households').select('id,name,invite_code').eq('id', householdId).single(),
      supabase.from('places').select('*').eq('household_id', householdId).order('sort'),
      supabase.from('products').select('*').eq('household_id', householdId).order('name'),
    ])
    if (h.error || pl.error || pr.error) {
      fail(h.error ?? pl.error ?? pr.error)
    } else {
      setHousehold(h.data as Household)
      setPlaces(pl.data as Place[])
      setProducts(pr.data as Product[])
    }
    setLoading(false)
  }, [householdId, fail])

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
      .subscribe()
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [householdId, reload])

  const adjustQty = useCallback(
    async (id: string, delta: number) => {
      setProducts((l) => l.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)))
      const { data, error } = await supabase.rpc('adjust_qty', { p_id: id, p_delta: delta })
      if (error) return fail(error)
      if (data) setProducts((l) => upsertLocal(l, data as Product))
    },
    [fail],
  )

  const addProduct = useCallback(
    async (input: ProductInput) => {
      const { data, error } = await supabase
        .from('products')
        .insert({ ...input, household_id: householdId })
        .select()
        .single()
      if (error) {
        fail(error)
        return null
      }
      setProducts((l) => upsertLocal(l, data as Product))
      return data as Product
    },
    [householdId, fail],
  )

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      setProducts((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      const { data, error } = await supabase.from('products').update(patch).eq('id', id).select().single()
      if (error) return fail(error)
      setProducts((l) => upsertLocal(l, data as Product))
    },
    [fail],
  )

  const deleteProduct = useCallback(
    async (id: string) => {
      setProducts((l) => l.filter((p) => p.id !== id))
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) fail(error)
    },
    [fail],
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
    async (name: string, color: string) => {
      const sort = places.reduce((m, p) => Math.max(m, p.sort), 0) + 1
      const { data, error } = await supabase
        .from('places')
        .insert({ household_id: householdId, name, color, sort })
        .select()
        .single()
      if (error) return fail(error)
      setPlaces((l) => upsertLocal(l, data as Place))
    },
    [householdId, places, fail],
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
      products,
      loading,
      toast,
      notify,
      reload,
      adjustQty,
      addProduct,
      updateProduct,
      deleteProduct,
      finishShopping,
      addPlace,
      updatePlace,
      deletePlace,
      renameHousehold,
    }),
    [household, places, products, loading, toast, notify, reload, adjustQty, addProduct, updateProduct, deleteProduct, finishShopping, addPlace, updatePlace, deletePlace, renameHousehold],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
