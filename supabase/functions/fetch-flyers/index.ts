// Leest één keer per week de aanbiedingspagina's van Aldi, Dirk, Hoogvliet, Lidl en Action
// en laat Claude Haiku 5.5 daar een gestructureerde lijst van maken (product, actie, prijs, geldigheid).
// De koppeling aan de producten van elk huishouden gebeurt daarna in fetch-deals.
// Aanroep: door pg_cron met x-cron-secret. Vereist het geheim ANTHROPIC_API_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@1.12.0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.12.0/helpers/zod'
import { z } from 'npm:zod@4.6.7'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MAX_CHARS = 150_000 // ± 40k tokens per winkel, binnen het goedkope tarief van Haiku 5.5

const STORES: Record<string, { name: string; url: string; scope: string }> = {
  aldi: { name: 'Aldi', url: 'https://www.aldi.nl/aanbiedingen.html', scope: 'supermarkt' },
  dirk: { name: 'Dirk', url: 'https://www.dirk.nl/aanbiedingen', scope: 'supermarkt' },
  hoogvliet: { name: 'Hoogvliet', url: 'https://www.hoogvliet.com/aanbiedingen', scope: 'supermarkt' },
  lidl: { name: 'Lidl', url: 'https://www.lidl.nl/c/aanbiedingen/a10008785', scope: 'supermarkt' },
  action: { name: 'Action', url: 'https://www.action.com/nl-nl/weekactie/', scope: 'non-food winkel' },
}

const DealList = z.object({
  deals: z.array(
    z.object({
      product: z.string().describe('Productnaam zoals in de aanbieding, inclusief merk, zonder prijs'),
      deal: z.string().describe('De actie in het kort, bijv. "1+1 gratis", "25% korting", "2 voor 3,00" of "nu 1,99"'),
      price: z.number().nullable().describe('Actieprijs in euro, of null als die niet genoemd wordt'),
      old_price: z.number().nullable().describe('Normale prijs in euro, of null'),
      valid_from: z.string().nullable().describe('Eerste geldige dag als YYYY-MM-DD, of null'),
      valid_until: z.string().nullable().describe('Laatste geldige dag als YYYY-MM-DD, of null'),
    }),
  ),
})

// Zichtbare tekst + productgegevens (JSON-LD) uit een pagina halen; scripts, stijlen en afbeeldingen weg.
function pageToText(html: string) {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].replace(/"(image|url|@context|logo|sameAs)"\s*:\s*("[^"]*"|\[[^\]]*\])\s*,?/g, ''))
    .join('\n')
  const visible = html
    .replace(/<(script|style|svg|noscript|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|span|a|td|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
    .filter((l, i, arr) => l !== arr[i - 1])
    .join('\n')
  // Productgegevens die in scripts of attributen staan (Next/Nuxt-data, data-attributen, alt-teksten).
  const KEYS = 'name|title|productName|fullTitle|brand|brandName|subtitle|description|shortDescription|price|oldPrice|' +
    'originalPrice|regularPrice|currentPrice|promotionPrice|promoPrice|discountText|promotionText|promotionLabel|' +
    'label|badge|sticker|unitSize|packaging|validFrom|validUntil|startDate|endDate|offerText|teaser|headline'
  const data: string[] = []
  const seen = new Set<string>()
  // Namen en labels één keer; prijzen en datums altijd (anders raken ze los van hun product), maar niet direct herhaald.
  const push = (line: string, unique = true) => {
    if (line.length < 3 || line === data[data.length - 1]) return
    if (unique) {
      if (seen.has(line)) return
      seen.add(line)
    }
    data.push(line)
  }
  for (const m of html.matchAll(new RegExp(`\\\\?"(${KEYS})\\\\?"\\s*:\\s*(\\\\?"((?:[^"\\\\]|\\\\.){1,160}?)\\\\?"|-?\\d+(?:\\.\\d+)?)`, 'g'))) {
    const value = (m[3] ?? m[2]).replace(/\\u([0-9a-f]{4})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\+/g, '')
    if (/^https?:|\.(jpg|png|webp|svg)|^[a-f0-9-]{20,}$/i.test(value)) continue
    push(`${m[1]}: ${value}`, !/price|Price|valid|Date/.test(m[1]))
  }
  for (const m of html.matchAll(/(?:alt|aria-label|title|data-price|data-name|data-product-name)="([^"]{3,160})"/g)) push(m[1])

  const parts = [visible, ld, data.join('\n')].filter(Boolean)
  return parts.join('\n\n').slice(0, MAX_CHARS)
}

async function readStore(client: Anthropic, key: string, today: string) {
  const store = STORES[key]
  const res = await fetch(store.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'nl-NL,nl;q=0.9' } })
  if (!res.ok) throw new Error(`pagina ${res.status}`)
  const text = pageToText(await res.text())
  if (text.length < 2000) throw new Error(`te weinig tekst op de pagina (${text.length} tekens)`)

  const response = await client.messages.parse({
    model: 'claude-haiku-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(DealList) },
    system:
      'Je zet de tekst van een Nederlandse aanbiedingspagina om in een lijst aanbiedingen. ' +
      'Neem alleen producten op die een huishouden op voorraad houdt: houdbaar eten en drinken, ontbijt en broodbeleg, ' +
      'koffie en thee, verzorging en drogisterij, schoonmaak- en wasmiddelen, papierwaren, babyspullen, huisdiervoer, ' +
      'batterijen en vuilniszakken. Sla kleding, elektronica, speelgoed, decoratie, meubels, verse groente, vers vlees en ' +
      'kant-en-klaarmaaltijden over. Verzin niets: neem alleen op wat echt in de tekst staat, en laat een prijs of datum ' +
      'leeg (null) als die er niet bij staat. Bij dubbele vermeldingen: één keer opnemen.',
    messages: [
      {
        role: 'user',
        content: `Winkel: ${store.name} (${store.scope}). Datum van vandaag: ${today}.\n\nTekst van de aanbiedingspagina:\n<pagina>\n${text}\n</pagina>`,
      },
    ],
  })
  if (response.stop_reason === 'refusal') throw new Error('model weigerde')
  if (response.stop_reason === 'max_tokens') console.warn(`${key}: uitvoer afgekapt, lijst mogelijk onvolledig`)
  const deals = response.parsed_output?.deals ?? []
  return { deals, usage: response.usage, chars: text.length }
}

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg } = await supabase.rpc('get_push_config')
  if (!cfg || req.headers.get('x-cron-secret') !== cfg.cron_secret) return new Response('forbidden', { status: 403 })
  const body = await req.json().catch(() => ({}))
  const only: string[] | undefined = Array.isArray(body?.stores) ? body.stores : undefined

  // Droogtest: alleen kijken hoeveel tekst elke pagina oplevert, zonder Claude aan te roepen.
  if (body?.dry) {
    const out = await Promise.all(
      Object.entries(STORES)
        .filter(([k]) => !only || only.includes(k))
        .map(async ([k, s]) => {
          try {
            const r = await fetch(s.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'nl-NL,nl;q=0.9' } })
            const t = pageToText(await r.text())
            return { store: k, status: r.status, chars: t.length, sample: t.slice(0, 400), tail: t.slice(-600) }
          } catch (e) {
            return { store: k, error: String(e) }
          }
        }),
    )
    return Response.json({ dry: out })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })
  const client = new Anthropic({ apiKey })
  const today = new Date().toISOString().slice(0, 10)
  const keys = Object.keys(STORES).filter((k) => !only || only.includes(k))

  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const { deals, usage, chars } = await readStore(client, key, today)
        const rows = deals
          .filter((d) => d.product.trim() && d.deal.trim())
          .map((d) => ({
            store: key,
            title: d.product.trim().slice(0, 200),
            deal_text: d.deal.trim().slice(0, 80),
            price: d.price,
            old_price: d.old_price,
            valid_from: /^\d{4}-\d{2}-\d{2}$/.test(d.valid_from ?? '') ? d.valid_from : null,
            valid_until: /^\d{4}-\d{2}-\d{2}$/.test(d.valid_until ?? '') ? d.valid_until : null,
          }))
        // Alleen vervangen als er iets gevonden is, zodat een mislukte week de vorige lijst niet wist.
        if (rows.length) {
          await supabase.from('flyer_deals').delete().eq('store', key)
          await supabase.from('flyer_deals').insert(rows)
        }
        return { store: key, deals: rows.length, chars, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }
      } catch (e) {
        console.error(key, e)
        return { store: key, error: String((e as Error)?.message ?? e) }
      }
    }),
  )
  return Response.json({ results })
})
