// Stelt een plek en categorie voor op basis van barcodegegevens en/of de productnaam.
import type { BarcodeInfo } from './barcode'
import type { Category, Place, Product } from './types'

type Kind =
  | 'keuken'
  | 'bijkeuken'
  | 'voorraad'
  | 'badkamer'
  | 'koelkast'
  | 'vriezer'
  | 'huisdier'
  | 'klussen'
  | 'kantoor'

interface KindDef {
  match: string[] // woorden waaraan een bestaande plek te herkennen is
  fallback?: Kind
  create: { name: string; icon: string; color: string }
}

const KINDS: Record<Kind, KindDef> = {
  keuken: { match: ['keuken'], create: { name: 'Keuken', icon: 'kitchen', color: '#F6E7D3' } },
  bijkeuken: { match: ['bijkeuken', 'wasruimte', 'washok', 'berging'], fallback: 'keuken', create: { name: 'Bijkeuken', icon: 'washer', color: '#ECE4F1' } },
  voorraad: { match: ['voorraad', 'marvat', 'pantry', 'provisie'], fallback: 'keuken', create: { name: 'Voorraadkast', icon: 'cabinet', color: '#E3EEDF' } },
  badkamer: { match: ['badkamer', 'toilet'], create: { name: 'Badkamer', icon: 'bath', color: '#DCEBF3' } },
  koelkast: { match: ['koelkast', 'koel'], create: { name: 'Koelkast', icon: 'fridge', color: '#DDEFF0' } },
  vriezer: { match: ['vriezer', 'diepvries'], create: { name: 'Vriezer', icon: 'snow', color: '#E1E7F5' } },
  huisdier: { match: ['huisdier', 'hond', 'kat'], create: { name: 'Huisdierspullen', icon: 'paw', color: '#F3E6D8' } },
  klussen: { match: ['schuur', 'garage', 'gereedschap', 'klus', 'zolder'], create: { name: 'Schuur', icon: 'tool', color: '#E8E4DA' } },
  kantoor: { match: ['kantoor', 'bureau', 'werkkamer'], create: { name: 'Bureau', icon: 'pen', color: '#EAE3F3' } },
}

interface Rule {
  kind: Kind
  cat: string | null
  reason: string
  tags?: string[] // stukjes van Open Food Facts-categorieën (en:...)
  words?: string[] // (begin van) woorden in de productnaam
}

// Volgorde telt: de eerste regel die past wint.
const RULES: Rule[] = [
  { kind: 'vriezer', cat: null, reason: 'diepvriesproduct', tags: ['frozen', 'ice-cream'], words: ['diepvries', 'ijsjes', 'roomijs'] },
  { kind: 'huisdier', cat: 'Voer', reason: 'huisdierspullen', tags: ['pet-food', 'dog-food', 'cat-food', 'pet-'], words: ['hondenvoer', 'kattenvoer', 'kattenbak', 'kattengrit', 'hondensnack', 'brokjes'] },
  { kind: 'badkamer', cat: 'Medicijnen', reason: 'medicijn', tags: ['medicine', 'medication', 'pharma'], words: ['paracetamol', 'ibuprofen', 'pijnstiller', 'neusspray', 'hoestdrank', 'zetpil', 'pleister'] },
  { kind: 'bijkeuken', cat: 'Baby', reason: 'babyspullen', tags: ['diaper', 'nappies', 'baby-wipes'], words: ['luier', 'billendoekje', 'luierzak'] },
  { kind: 'voorraad', cat: 'Babyvoeding', reason: 'babyvoeding', tags: ['baby-food', 'baby-milk', 'infant'], words: ['flesvoeding', 'opvolgmelk', 'knijpzak', 'babykoek'] },
  { kind: 'keuken', cat: 'Broodbeleg', reason: 'broodbeleg', tags: ['spreads', 'jams', 'honeys', 'chocolate-spreads', 'sprinkles', 'peanut-butter', 'sandwich'], words: ['pindakaas', 'hagelslag', 'jam', 'chocopasta', 'choco', 'honing', 'vlokken', 'muisjes', 'speculoos', 'appelstroop', 'notenpasta', 'smeerkaas', 'beleg'] },
  { kind: 'keuken', cat: 'Ontbijt', reason: 'ontbijt', tags: ['breakfast', 'cereals', 'mueslis', 'oat'], words: ['muesli', 'granola', 'havermout', 'cornflakes', 'ontbijt', 'beschuit', 'crackers', 'rijstwafel'] },
  { kind: 'koelkast', cat: null, reason: 'gekoeld product', tags: ['dairies', 'cheeses', 'yogurts', 'fresh-', 'meats', 'eggs', 'butters', 'chilled'], words: ['yoghurt', 'kwark', 'kaas', 'vla', 'boter', 'eieren', 'vleeswaren', 'gehakt'] },
  { kind: 'badkamer', cat: 'Tandverzorging', reason: 'tandverzorging', tags: ['toothpaste', 'oral-care', 'mouthwash', 'toothbrush', 'dental'], words: ['tandpasta', 'tandenborstel', 'opzetborstel', 'mondwater', 'flosdraad', 'floss', 'tandzijde'] },
  { kind: 'badkamer', cat: 'Haar & douche', reason: 'haar- en doucheproduct', tags: ['shampoo', 'conditioner', 'shower', 'hair', 'bath'], words: ['shampoo', 'conditioner', 'douche', 'haar', 'badschuim', 'crèmespoeling'] },
  { kind: 'badkamer', cat: 'Hygiëne', reason: 'hygiëneproduct', tags: ['sanitary', 'tampon', 'cotton'], words: ['maandverband', 'tampon', 'inlegkruis', 'wattenstaaf', 'wattenschijf'] },
  { kind: 'badkamer', cat: 'Huid & lichaam', reason: 'verzorgingsproduct', tags: ['deodorant', 'skin', 'body', 'sun', 'shaving', 'soap', 'face', 'cosmetic', 'beauty', 'hygiene'], words: ['deo', 'deodorant', 'zeep', 'handzeep', 'bodylotion', 'lotion', 'crème', 'creme', 'zonnebrand', 'scheer', 'gezicht', 'lippenbalsem', 'make-up', 'mascara'] },
  { kind: 'keuken', cat: 'Afwas', reason: 'afwasmiddel', tags: ['dishwash', 'dish-'], words: ['vaatwas', 'afwas', 'glansspoel', 'spons', 'vaatdoek', 'schuurspons'] },
  { kind: 'keuken', cat: 'Keukenspullen', reason: 'keukenspul', tags: ['kitchen', 'foil', 'baking-paper'], words: ['keukenrol', 'folie', 'bakpapier', 'vershoud', 'diepvrieszak', 'boterhamzak', 'vuilniszak', 'afvalzak'] },
  { kind: 'bijkeuken', cat: 'Was', reason: 'wasmiddel', tags: ['laundry', 'fabric-softener'], words: ['wasmiddel', 'wasverzachter', 'vlekken', 'wascapsule', 'wasparfum', 'witwas'] },
  { kind: 'bijkeuken', cat: 'Papier', reason: 'papierwaren', tags: ['toilet-paper', 'tissues', 'paper-towel'], words: ['wc-papier', 'toiletpapier', 'tissues', 'zakdoek'] },
  { kind: 'bijkeuken', cat: 'Schoonmaak', reason: 'schoonmaakmiddel', tags: ['cleaning', 'cleaner', 'detergent', 'bleach', 'disinfect'], words: ['reiniger', 'allesreiniger', 'wc-reiniger', 'glasreiniger', 'ontkalker', 'bleek', 'chloor', 'ontstopper', 'microvezel', 'schoonmaak', 'wc-blok'] },
  { kind: 'bijkeuken', cat: 'Huishouden', reason: 'huishoudartikel', tags: ['batter', 'light-bulb', 'lamp'], words: ['batterij', 'batterijen', 'lamp', 'stofzuiger', 'lucifers', 'kaarsen', 'aansteker'] },
  { kind: 'voorraad', cat: 'Pasta & rijst', reason: 'pasta of rijst', tags: ['pastas', 'rices', 'noodles', 'couscous'], words: ['pasta', 'spaghetti', 'penne', 'macaroni', 'fusilli', 'lasagne', 'rijst', 'noedels', 'mie', 'couscous', 'bulgur', 'quinoa'] },
  { kind: 'voorraad', cat: 'Conserven', reason: 'conserven', tags: ['canned', 'tomato-sauces', 'legumes', 'tunas', 'pulses'], words: ['blik', 'tomatenblokjes', 'passata', 'tomatenpuree', 'bonen', 'kikkererwten', 'linzen', 'tonijn', 'kokosmelk', 'mais', 'soep'] },
  { kind: 'voorraad', cat: 'Sauzen & kruiden', reason: 'saus of kruiden', tags: ['sauces', 'condiments', 'spices', 'oils', 'vinegars', 'salts', 'stocks'], words: ['saus', 'ketchup', 'mayonaise', 'mosterd', 'sojasaus', 'zout', 'peper', 'kruiden', 'bouillon', 'olie', 'olijfolie', 'azijn', 'pesto', 'curry'] },
  { kind: 'voorraad', cat: 'Bakken', reason: 'bakproduct', tags: ['flours', 'sugars', 'baking'], words: ['bloem', 'meel', 'suiker', 'bakpoeder', 'gist', 'vanille', 'cacao'] },
  { kind: 'voorraad', cat: 'Koffie & thee', reason: 'koffie of thee', tags: ['coffee', 'teas', 'herbal-tea'], words: ['koffie', 'koffiebonen', 'koffiepads', 'cups', 'thee', 'espresso'] },
  { kind: 'voorraad', cat: 'Dranken', reason: 'drank', tags: ['beverages', 'wines', 'beers', 'sodas', 'waters', 'juices', 'spirits'], words: ['bier', 'wijn', 'frisdrank', 'cola', 'sap', 'limonade', 'siroop', 'water'] },
  { kind: 'voorraad', cat: 'Snacks', reason: 'snack', tags: ['snacks', 'biscuits', 'chips', 'chocolates', 'nuts', 'candies', 'confectioner'], words: ['koek', 'koekjes', 'chips', 'chocolade', 'noten', 'pinda', 'snoep', 'drop', 'reep', 'nootjes'] },
  { kind: 'klussen', cat: 'Tuin', reason: 'tuinproduct', tags: ['garden', 'plant', 'fertiliz', 'potting'], words: ['potgrond', 'tuin', 'plantenvoeding', 'mest', 'zaden', 'bloembollen', 'onkruid'] },
  { kind: 'klussen', cat: 'Gereedschap', reason: 'klusspullen', tags: ['tools', 'paint', 'hardware'], words: ['schroef', 'spijker', 'verf', 'kwast', 'lijm', 'tape', 'boor', 'plamuur'] },
  { kind: 'kantoor', cat: null, reason: 'kantoorartikel', tags: ['office', 'stationery'], words: ['pen', 'pennen', 'printpapier', 'printer', 'cartridge', 'enveloppen', 'nietjes', 'schrift'] },
]

export type Suggestion = {
  reason: string
  place: { id: string } | { create: { name: string; icon: string; color: string } }
  category: { id: string } | { create: string } | null
}

function words(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9-]+/)
    .filter(Boolean)
}

function ruleMatches(rule: Rule, nameWords: string[], tags: string[]) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (rule.words?.some((w) => nameWords.some((nw) => nw === norm(w) || (w.length >= 4 && nw.startsWith(norm(w))) || (w.length >= 4 && nw.endsWith(norm(w)))))) return true
  if (rule.tags?.some((t) => tags.some((tag) => tag.includes(t)))) return true
  return false
}

function findPlace(kind: Kind, places: Place[]): Place | null {
  const def = KINDS[kind]
  return places.find((p) => def.match.some((m) => p.name.toLowerCase().includes(m))) ?? null
}

function resolve(rule: Pick<Rule, 'kind' | 'cat' | 'reason'>, places: Place[], categories: Category[]): Suggestion {
  let kind: Kind | undefined = rule.kind
  let place: Place | null = null
  while (kind && !place) {
    place = findPlace(kind, places)
    if (!place) kind = KINDS[kind].fallback
  }
  if (!place) {
    return { reason: rule.reason, place: { create: KINDS[rule.kind].create }, category: rule.cat ? { create: rule.cat } : null }
  }
  if (!rule.cat) return { reason: rule.reason, place: { id: place.id }, category: null }
  const want = rule.cat.toLowerCase()
  const cat = categories.find((c) => c.place_id === place!.id && (c.name.toLowerCase() === want || c.name.toLowerCase().includes(want) || want.includes(c.name.toLowerCase())))
  return { reason: rule.reason, place: { id: place.id }, category: cat ? { id: cat.id } : { create: rule.cat } }
}

export function suggestPlace(
  input: { name: string; info?: BarcodeInfo | null },
  places: Place[],
  categories: Category[],
  products: Product[],
): Suggestion | null {
  const name = (input.info?.productName ?? input.name).trim()
  if (name.length < 3 && !input.info?.categories.length) return null

  // 1. Staat er al een vergelijkbaar product in huis? Volg dan die indeling.
  // Alle woorden van het bestaande product moeten als heel woord voorkomen ("Shampoo" in "Andrélon shampoo",
  // maar "Pasta" niet in "Tandpasta").
  const ownWords = new Set(words(name))
  const twin = products
    .filter((p) => {
      if (!p.place_id || p.name.length < 4) return false
      const w = words(p.name)
      return w.length > 0 && w.every((x) => ownWords.has(x))
    })
    .sort((a, b) => b.name.length - a.name.length)[0]
  if (twin) {
    return { reason: `net als ${twin.name}`, place: { id: twin.place_id! }, category: twin.category_id ? { id: twin.category_id } : null }
  }

  // 2. Regels op naam en barcodecategorieën.
  const nameWords = words(name)
  const tags = (input.info?.categories ?? []).map((t) => t.toLowerCase())
  const rule = RULES.find((r) => ruleMatches(r, nameWords, [])) ?? RULES.find((r) => ruleMatches(r, [], tags))
  if (rule) return resolve(rule, places, categories)

  // 3. Alleen de bron is bekend.
  if (input.info?.source === 'beauty') return resolve({ kind: 'badkamer', cat: 'Huid & lichaam', reason: 'verzorgingsproduct' }, places, categories)
  if (input.info?.source === 'food') return resolve({ kind: 'voorraad', cat: null, reason: 'houdbaar eten' }, places, categories)
  if (input.info?.source === 'products') return resolve({ kind: 'bijkeuken', cat: 'Huishouden', reason: 'huishoudartikel' }, places, categories)
  return null
}
