// Siri-snelkoppeling: zet een product op het boodschappenlijstje.
// GET/POST /functions/v1/quick-add?token=<huishouden-token>&naam=<product>
// Het antwoord is platte tekst die Siri kan voorlezen.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8' }
const reply = (text: string, status = 200) => new Response(text, { status, headers: cors })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  let token = url.searchParams.get('token') ?? ''
  let naam = url.searchParams.get('naam') ?? url.searchParams.get('name') ?? ''
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      token = body.token ?? token
      naam = body.naam ?? body.name ?? naam
    } catch {
      const text = await req.text().catch(() => '')
      if (text && !naam) naam = text
    }
  }
  naam = naam.trim().replace(/[.!?]+$/, '')
  if (!/^[0-9a-f]{32}$/.test(token)) return reply('Ongeldige snelkoppeling.', 403)
  if (!naam) return reply('Welk product moet op het lijstje?', 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: hh } = await supabase.from('households').select('id').eq('shortcut_token', token).maybeSingle()
  if (!hh) return reply('Ongeldige snelkoppeling.', 403)

  const pretty = naam.charAt(0).toUpperCase() + naam.slice(1)
  const { data: products } = await supabase.from('products').select('id, name, on_list, list_checked').eq('household_id', hh.id)
  const lower = naam.toLowerCase()
  const match =
    products?.find((p) => p.name.toLowerCase() === lower) ??
    products?.find((p) => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase()))

  if (match) {
    await supabase.from('products').update({ on_list: true, list_checked: false, list_checked_at: null }).eq('id', match.id)
    return reply(`${match.name} staat op het boodschappenlijstje.`)
  }
  await supabase.from('products').insert({ household_id: hh.id, name: pretty, qty: 0, min_qty: 0, on_list: true, list_qty: 1 })
  return reply(`${pretty} is toegevoegd aan het boodschappenlijstje.`)
})
