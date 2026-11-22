// Dagelijks: pushmelding voor producten die binnen 30 dagen verlopen.
// Wekelijks (body {"mode":"weekly"}): overzicht van het lijstje en wat binnenkort verloopt.
// Wordt aangeroepen door pg_cron (zie supabase/migrations) met een gedeeld geheim.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const DAYS = 30

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg, error: cfgErr } = await supabase.rpc('get_push_config')
  if (cfgErr || !cfg) return new Response('config missing', { status: 500 })
  if (req.headers.get('x-cron-secret') !== cfg.cron_secret) return new Response('forbidden', { status: 403 })

  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private)

  const body = await req.json().catch(() => ({}))
  if (body?.mode === 'weekly') return weekly(supabase)

  const limit = new Date(Date.now() + DAYS * 86400000).toISOString().slice(0, 10)
  const { data: due, error } = await supabase
    .from('products')
    .select('id, household_id, name, expiry_date')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', limit)
    .is('expiry_notified_at', null)
  if (error) return new Response(error.message, { status: 500 })
  if (!due?.length) return Response.json({ sent: 0 })

  const byHousehold = new Map<string, typeof due>()
  for (const p of due) byHousehold.set(p.household_id, [...(byHousehold.get(p.household_id) ?? []), p])

  let sent = 0
  for (const [hh, items] of byHousehold) {
    const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('household_id', hh)
    const names = items.map((i) => i.name)
    const body =
      names.length === 1
        ? `${names[0]} verloopt binnenkort.`
        : `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` en nog ${names.length - 3}` : ''} verlopen binnenkort.`
    const payload = JSON.stringify({ title: 'Bijna over datum', body, url: '/' })
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
    await supabase.from('products').update({ expiry_notified_at: new Date().toISOString() }).in('id', items.map((i) => i.id))
  }
  return Response.json({ sent })
})

// Wekelijks overzicht: wat moet er gehaald worden en wat verloopt binnenkort.
async function weekly(supabase: ReturnType<typeof createClient>) {
  const { data: products } = await supabase
    .from('products')
    .select('household_id, name, qty, min_qty, on_list, list_checked, list_dismissed_qty, expiry_date, use_rate')
  const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const byHh = new Map<string, { buy: string[]; expiring: string[] }>()
  for (const p of products ?? []) {
    const e = byHh.get(p.household_id) ?? { buy: [], expiring: [] }
    const predicted = p.use_rate && p.qty > 0 && p.qty >= p.min_qty && p.qty / p.use_rate <= 7
    const dismissed = p.list_dismissed_qty !== null && p.qty >= p.list_dismissed_qty
    if (!p.list_checked && (p.on_list || ((p.qty < p.min_qty || predicted) && !dismissed))) e.buy.push(p.name)
    if (p.expiry_date && p.expiry_date <= soon) e.expiring.push(p.name)
    byHh.set(p.household_id, e)
  }
  const { data: deals } = await supabase.from('deals').select('household_id, product_id')
  const dealCount = new Map<string, Set<string>>()
  for (const d of deals ?? []) dealCount.set(d.household_id, (dealCount.get(d.household_id) ?? new Set()).add(d.product_id))
  let sent = 0
  for (const [hh, { buy, expiring }] of byHh) {
    const onSale = dealCount.get(hh)?.size ?? 0
    if (!buy.length && !expiring.length && !onSale) continue
    const parts: string[] = []
    if (buy.length) parts.push(`${buy.length} op het lijstje (${buy.slice(0, 3).join(', ')}${buy.length > 3 ? '…' : ''})`)
    if (expiring.length) parts.push(`${expiring.length} verloopt binnen 2 weken`)
    if (onSale) parts.push(`${onSale} in de aanbieding`)
    const payload = JSON.stringify({ title: 'Weekoverzicht', body: parts.join(' · '), url: '/' })
    const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('household_id', hh)
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }
  return Response.json({ sent, mode: 'weekly' })
}
