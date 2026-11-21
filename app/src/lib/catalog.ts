// Startlijst: veelgebruikte voorraadproducten met een voorgestelde plek en minimum.
export interface CatalogItem {
  name: string
  cat: CatalogCategory
  place: string
  min: number
}

export type CatalogCategory = 'Verzorging' | 'Baby' | 'Schoonmaak' | 'Voorraad' | 'Keuken'

export const CATEGORIES: CatalogCategory[] = ['Verzorging', 'Baby', 'Schoonmaak', 'Voorraad', 'Keuken']

const B = 'Badkamer'
const BK = 'Bijkeuken'
const V = 'Voorraadkast (Marvat)'
const K = 'Keuken'

const raw: [string, CatalogCategory, string, number][] = [
  // Verzorging
  ['Tandpasta', 'Verzorging', B, 2],
  ['Opzetborstels', 'Verzorging', B, 1],
  ['Flosdraad', 'Verzorging', B, 1],
  ['Mondwater', 'Verzorging', B, 1],
  ['Shampoo', 'Verzorging', B, 1],
  ['Conditioner', 'Verzorging', B, 1],
  ['Douchegel', 'Verzorging', B, 2],
  ['Deodorant', 'Verzorging', B, 2],
  ['Handzeep', 'Verzorging', B, 2],
  ['Bodylotion', 'Verzorging', B, 1],
  ['Scheermesjes', 'Verzorging', B, 2],
  ['Zonnebrand', 'Verzorging', B, 1],
  ['Wattenstaafjes', 'Verzorging', B, 1],
  ['Wattenschijfjes', 'Verzorging', B, 1],
  ['Maandverband', 'Verzorging', B, 1],
  ['Tampons', 'Verzorging', B, 1],
  ['Paracetamol', 'Verzorging', B, 1],
  ['Ibuprofen', 'Verzorging', B, 1],
  ['Pleisters', 'Verzorging', B, 1],
  ['Tissues', 'Verzorging', BK, 2],
  // Baby
  ['Luiers', 'Baby', BK, 2],
  ['Billendoekjes', 'Baby', BK, 3],
  ['Billenzalf', 'Baby', B, 1],
  ['Babyshampoo', 'Baby', B, 1],
  ['Babyolie', 'Baby', B, 1],
  ['Luierzakjes', 'Baby', BK, 1],
  ['Flesvoeding', 'Baby', K, 2],
  ['Fruitknijpzakjes', 'Baby', V, 4],
  ['Babykoekjes', 'Baby', V, 1],
  ['Paracetamol zetpillen (baby)', 'Baby', B, 1],
  ['Babywasmiddel', 'Baby', BK, 1],
  // Schoonmaak
  ['Allesreiniger', 'Schoonmaak', BK, 1],
  ['Wc-reiniger', 'Schoonmaak', BK, 1],
  ['Wc-blokjes', 'Schoonmaak', BK, 2],
  ['Wc-papier', 'Schoonmaak', BK, 8],
  ['Glasreiniger', 'Schoonmaak', BK, 1],
  ['Badkamerreiniger', 'Schoonmaak', BK, 1],
  ['Ontkalker', 'Schoonmaak', BK, 1],
  ['Schuursponsjes', 'Schoonmaak', K, 2],
  ['Vaatdoekjes', 'Schoonmaak', K, 2],
  ['Microvezeldoeken', 'Schoonmaak', BK, 2],
  ['Wasmiddel', 'Schoonmaak', BK, 1],
  ['Wasverzachter', 'Schoonmaak', BK, 1],
  ['Vlekkenverwijderaar', 'Schoonmaak', BK, 1],
  ['Vuilniszakken', 'Schoonmaak', K, 1],
  ['Stofzuigerzakken', 'Schoonmaak', BK, 1],
  ['Batterijen AA', 'Schoonmaak', BK, 4],
  ['Batterijen AAA', 'Schoonmaak', BK, 4],
  // Voorraad
  ['Pasta', 'Voorraad', V, 2],
  ['Rijst', 'Voorraad', V, 1],
  ['Havermout', 'Voorraad', K, 1],
  ['Bloem', 'Voorraad', V, 1],
  ['Suiker', 'Voorraad', V, 1],
  ['Koffie', 'Voorraad', V, 1],
  ['Thee', 'Voorraad', V, 1],
  ['Olijfolie', 'Voorraad', V, 1],
  ['Zonnebloemolie', 'Voorraad', V, 1],
  ['Tomatenblokjes', 'Voorraad', V, 2],
  ['Passata', 'Voorraad', V, 1],
  ['Kokosmelk', 'Voorraad', V, 1],
  ['Kikkererwten', 'Voorraad', V, 1],
  ['Kidneybonen', 'Voorraad', V, 1],
  ['Tonijn in blik', 'Voorraad', V, 2],
  ['Bouillonblokjes', 'Voorraad', V, 1],
  ['Pindakaas', 'Voorraad', K, 1],
  ['Hagelslag', 'Voorraad', K, 1],
  ['Jam', 'Voorraad', K, 1],
  ['Chocopasta', 'Voorraad', K, 1],
  ['Honing', 'Voorraad', K, 1],
  ['Appelstroop', 'Voorraad', K, 1],
  ['Muesli', 'Voorraad', K, 1],
  ['Beschuit', 'Voorraad', K, 1],
  ['Crackers', 'Voorraad', K, 1],
  ['Noten', 'Voorraad', V, 1],
  ['Ketchup', 'Voorraad', V, 1],
  ['Mayonaise', 'Voorraad', V, 1],
  ['Sojasaus', 'Voorraad', V, 1],
  ['Zout', 'Voorraad', V, 1],
  // Keuken
  ['Afwasmiddel', 'Keuken', K, 1],
  ['Vaatwastabletten', 'Keuken', K, 1],
  ['Vaatwaszout', 'Keuken', K, 1],
  ['Glansspoelmiddel', 'Keuken', K, 1],
  ['Keukenrol', 'Keuken', K, 2],
  ['Aluminiumfolie', 'Keuken', K, 1],
  ['Vershoudfolie', 'Keuken', K, 1],
  ['Bakpapier', 'Keuken', K, 1],
  ['Diepvrieszakjes', 'Keuken', K, 1],
  ['Boterhamzakjes', 'Keuken', K, 1],
]

export const CATALOG: CatalogItem[] = raw.map(([name, cat, place, min]) => ({ name, cat, place, min }))
