// Publishable values only: these are safe to ship in the browser bundle.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://qskaepckyhgysnweqzrf.supabase.co'
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_20imn2PDc9Dxn0wNUW-tJA_YfoH6G88'
export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ??
  'BMUqFpybtON78Qr2Wwp5FhNsv5LjDTuC3hYOBLQNbrw8IY_pQWKzHYOmaUfz1MAEd9A_vaqiWYr3QKA6dgNS5ys'
