// Zoekt dagelijks bij Albert Heijn en Jumbo welke producten uit de voorraad in de aanbieding zijn.
// LET OP: gebruikt de niet-officiële koppelingen van de AH-app en de Jumbo-website; die kunnen
// zonder waarschuwing veranderen. Fouten per winkel worden genegeerd, zodat de rest blijft werken.
// Aanroep: door pg_cron met x-cron-secret (alle huishoudens), of vanuit de app met de JWT van de
// gebruiker (alleen diens huishouden).
import { createClient } from 'npm:@supabase/supabase-js@2'

const AH_UA = 'Appie/8.22.3'
const WEB_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Deal {
  store: 'ah' | 'jumbo'
  title: string
  deal_text: string
  price: number | null
  old_price: number | null
  image_url: string | null
  url: string | null
  online_only: boolean
  valid_until: string | null
  score: number
}

const SYNONYMS: Record<string, string[]> = {
  wcpapier: ['toiletpapier'],
  toiletpapier: ['wcpapier'],
  luiers: ['luier'],
  billendoekjes: ['babydoekjes', 'billendoekje'],
  vaatwastabletten: ['vaatwastablet', 'vaatwascapsules', 'vaatwasmiddel'],
  wasmiddel: ['wasmiddel', 'wascapsules', 'wasgel'],
  deodorant: ['deo'],
  koffiebonen: ['bonen'],
}

function words(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// Hoe goed past een aanbieding bij een product? 0 = niet.
function score(productName: string, title: string) {
  const keys = words(productName).filter((w) => w.length >= 4 && !/^\d/.test(w))
  if (!keys.length) return 0
  const main = [...keys].sort((a, b) => b.length - a.length)[0]
  const t = words(title)
  const hit = (k: string) =>
    [k, ...(SYNONYMS[k] ?? [])].some((v) => t.some((w) => w === v || w.startsWith(v) || (v.length >= 5 && w.endsWith(v)) || (w.length >= 5 && v.startsWith(w))))
  if (!hit(main)) return 0
  return 1 + keys.filter((k) => k !== main && hit(k)).length
}

function cleanQuery(name: string) {
  return name.replace(/\b\d+([.,]\d+)?\s*(g|gr|kg|ml|l|cl|stuks?|st|x)\b/gi, '').replace(/\s+/g, ' ').trim()
}

async function ahToken() {
  const r = await fetch('https://api.ah.nl/mobile-auth/v1/auth/token/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': AH_UA, 'x-application': 'AHWEBSHOP' },
    body: JSON.stringify({ clientId: 'appie' }),
  })
  if (!r.ok) throw new Error(`AH token ${r.status}`)
  return (await r.json()).access_token as string
}

async function ahDeals(token: string, name: string): Promise<Deal[]> {
  const r = await fetch(
    `https://api.ah.nl/mobile-services/product/search/v2?query=${encodeURIComponent(cleanQuery(name))}&sortOn=RELEVANCE&page=0&size=24`,
    { headers: { 'User-Agent': AH_UA, 'x-application': 'AHWEBSHOP', Authorization: `Bearer ${token}` } },
  )
  if (!r.ok) return []
  const j = await r.json()
  // Vaste multipack-korting ("volume voordeel", einddatum 2999) is geen echte actie.
  // deno-lint-ignore no-explicit-any
  const real = (p: any) => p.isBonus && !/volume voordeel/i.test(p.bonusMechanism ?? '') && !String(p.bonusEndDate ?? '').startsWith('2999')
  // deno-lint-ignore no-explicit-any
  return (j.products ?? []).filter(real).map((p: any) => ({
    store: 'ah' as const,
    title: p.title,
    deal_text: p.bonusMechanism || p.discountLabels?.[0]?.defaultDescription || 'Bonus',
    price: typeof p.currentPrice === 'number' ? p.currentPrice : null,
    old_price: typeof p.priceBeforeBonus === 'number' ? p.priceBeforeBonus : null,
    // deno-lint-ignore no-explicit-any
    image_url: (p.images ?? []).find((i: any) => i.width === 200 || i.width === 400)?.url ?? p.images?.[0]?.url ?? null,
    url: `https://www.ah.nl/producten/product/wi${p.webshopId}`,
    online_only: false,
    valid_until: p.bonusEndDate ?? null,
    score: score(name, `${p.title} ${p.subCategory ?? ''}`),
  }))
}

const JUMBO_QUERY =
  'query SearchProducts($input: ProductSearchInput!) { searchProducts(input: $input) { products { id title link image promotions { tags { text } } price { price promoPrice } } } }'

async function jumboDeals(name: string): Promise<Deal[]> {
  const q = cleanQuery(name)
  const r = await fetch('https://www.jumbo.com/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WEB_UA,
      origin: 'https://www.jumbo.com',
      'apollographql-client-name': 'JUMBO_WEB-search',
      'apollographql-client-version': 'master-v29.1.0-web',
    },
    body: JSON.stringify({
      operationName: 'SearchProducts',
      variables: { input: { searchType: 'keyword', searchTerms: q, friendlyUrl: '', offSet: 0, currentUrl: `/producten/?searchType=keyword&searchTerms=${encodeURIComponent(q)}`, previousUrl: '', bloomreachCookieId: '' } },
      query: JUMBO_QUERY,
    }),
  })
  if (!r.ok) return []
  const j = await r.json()
  // deno-lint-ignore no-explicit-any
  return (j.data?.searchProducts?.products ?? []).filter((p: any) => p.promotions?.length).map((p: any) => {
    // deno-lint-ignore no-explicit-any
    const tags: string[] = p.promotions.flatMap((pr: any) => (pr.tags ?? []).map((t: any) => t.text)).filter(Boolean)
    const onlineOnly = tags.some((t) => /alleen online/i.test(t))
    const promo = typeof p.price?.promoPrice === 'number' ? p.price.promoPrice / 100 : null
    const normal = typeof p.price?.price === 'number' ? p.price.price / 100 : null
    return {
      store: 'jumbo' as const,
      title: p.title,
      deal_text: tags.filter((t) => !/alleen online/i.test(t)).join(' · ') || 'Actie',
      price: promo ?? normal,
      old_price: promo ? normal : null,
      image_url: p.image ?? null,
      url: p.link ? `https://www.jumbo.com${p.link}` : null,
      online_only: onlineOnly,
      valid_until: null,
      score: score(name, p.title),
    }
  })
}

async function refreshHousehold(supabase: ReturnType<typeof createClient>, householdId: string) {
  const { data: products } = await supabase.from('products').select('id, name').eq('household_id', householdId).limit(200)
  let token: string | null = null
  try {
    token = await ahToken()
  } catch (e) {
    console.error('AH niet bereikbaar', e)
  }
  const rows: Record<string, unknown>[] = []
  const list = (products ?? []).filter((p) => p.name.trim().length >= 3)
  for (let i = 0; i < list.length; i += 6) {
    const batch = list.slice(i, i + 6)
    await Promise.all(
      batch.map(async (p) => {
        const [ah, jumbo] = await Promise.all([
          token ? ahDeals(token, p.name).catch(() => []) : Promise.resolve([] as Deal[]),
          jumboDeals(p.name).catch(() => []),
        ])
        for (const set of [ah, jumbo]) {
          set
            .filter((d) => d.score > 0)
            .sort((a, b) => b.score - a.score || Number(a.online_only) - Number(b.online_only))
            .slice(0, 2)
            .forEach(({ score: _s, ...d }) => rows.push({ ...d, household_id: householdId, product_id: p.id }))
        }
      }),
    )
  }
  await supabase.from('deals').delete().eq('household_id', householdId)
  if (rows.length) await supabase.from('deals').insert(rows)
  await supabase.from('households').update({ deals_checked_at: new Date().toISOString() }).eq('id', householdId)
  return rows.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg } = await supabase.rpc('get_push_config')

  let households: string[] = []
  if (cfg && req.headers.get('x-cron-secret') === cfg.cron_secret) {
    const { data } = await supabase.from('households').select('id')
    households = (data ?? []).map((h) => h.id)
  } else {
    const jwt = req.headers.get('authorization')?.replace(/^Bearer /i, '') ?? ''
    const { data: u } = await supabase.auth.getUser(jwt)
    if (!u.user) return new Response('Niet ingelogd', { status: 401, headers: cors })
    const { data } = await supabase.from('household_members').select('household_id').eq('user_id', u.user.id).limit(1)
    if (!data?.length) return new Response('Geen huishouden', { status: 404, headers: cors })
    // Niet vaker dan eens per 10 minuten handmatig verversen.
    const { data: hh } = await supabase.from('households').select('deals_checked_at').eq('id', data[0].household_id).single()
    if (hh?.deals_checked_at && Date.now() - new Date(hh.deals_checked_at).getTime() < 10 * 60000) {
      return Response.json({ deals: null, skipped: true }, { headers: cors })
    }
    households = [data[0].household_id]
  }

  let total = 0
  for (const id of households) total += await refreshHousehold(supabase, id)
  return Response.json({ deals: total, households: households.length }, { headers: cors })
})
