// Construit public/sons.json (lancé par GitHub Actions, pas dans l'appli)
import { mkdirSync, writeFileSync } from 'node:fs'

const APIS = ['https://myinstants-api.vercel.app', 'https://myinstants.loosecast.web.id']
const PACKS = [
  ['🔥 Tendances FR', '/trending?q=fr'],
  ['🆕 Tout frais', '/recent'],
  ['🌍 Tendances US', '/trending?q=us'],


$$
'🏆 Légendes FR', '/best?q=fr'],
$$


const MUST = ['vine boom', 'bruh', 'emotional damage', 'metal pipe', 'sad violin', 'roblox oof',
  'mlg air horn', 'anime wow', 'among us', 'windows xp', 'quoicoubeh', 'tralalero']

async function grab(path) {
  for (const api of APIS) {
    try {
      const r = await fetch(api + path, { signal: AbortSignal.timeout(20000) })
      if (!r.ok) continue
      const j = await r.json()
      const out = (j.data || [])
        .filter(s => typeof s.mp3 === 'string' && s.mp3.startsWith('https://'))
        .map(s => ({ n: String(s.title).slice(0, 40), u: s.mp3 }))
      if (out.length) return out
    } catch (e) {
      console.log('Échec', api + path, e.message)
    }
  }
  return []
}

const seen = new Set()
const uniq = list => list.filter(s => !seen.has(s.u) && seen.add(s.u))
const cats = []

const must = []
for (const q of MUST) must.push(...(await grab('/search?q=' + encodeURIComponent(q))).slice(0, 1))
if (must.length) cats.push({ titre: '💀 Indispensables', sons: uniq(must) })

for (const [titre, path] of PACKS) {
  const sons = uniq(await grab(path)).slice(0, 48)
  if (sons.length) cats.push({ titre, sons })
}

mkdirSync('public', { recursive: true })
writeFileSync('public/sons.json', JSON.stringify({ maj: new Date().toISOString(), cats }))
console.log(cats.map(c => `${c.titre} : ${c.sons.length}`).join('\n') || 'Aucun son récupéré')
              
