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
  list_checked_at: string | null
  image_url: string | null
  size_label: string | null
  pao_months: number | null
  opened_at: string | null
  store: string | null
  use_rate: number | null
  list_dismissed_qty: number | null
  updated_at: string
}

export interface Household {
  id: string
  name: string
  invite_code: string
  shortcut_token: string
  deals_checked_at: string | null
}

export interface Deal {
  id: number
  product_id: string
  store: 'ah' | 'jumbo' | 'aldi' | 'dirk' | 'hoogvliet' | 'lidl' | 'action'
  title: string
  deal_text: string
  price: number | null
  old_price: number | null
  image_url: string | null
  url: string | null
  online_only: boolean
  valid_until: string | null
  size_text?: string | null
}

export type Status = 'ok' | 'low' | 'out' | 'none'
