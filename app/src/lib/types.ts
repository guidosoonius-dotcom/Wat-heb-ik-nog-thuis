export interface Place {
  id: string
  household_id: string
  name: string
  color: string
  icon: string
  sort: number
}

export interface Category {
  id: string
  household_id: string
  place_id: string
  name: string
  sort: number
}

export interface Product {
  id: string
  household_id: string
  place_id: string | null
  category_id: string | null
  name: string
  qty: number
  min_qty: number
  expiry_date: string | null
  barcode: string | null
  on_list: boolean
  list_qty: number | null
  list_checked: boolean
  updated_at: string
}

export interface Household {
  id: string
  name: string
  invite_code: string
}

export type Status = 'ok' | 'low' | 'out' | 'none'
