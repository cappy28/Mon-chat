// Soundboard : packs (sons.json), recherche Myinstants, favoris, « mes sons »
import { get, set } from 'idb-keyval'

const PAGES = 'https://cappy28.github.io/Mon-chat/sons.json'
const APIS = ['https://myinstants-api.vercel.app', 'https://myinstants.loosecast.web.id']

// N'accepte que des liens https ou des sons intégrés (data:audio)
export const okUrl = u =>
  typeof u === 'string' && u.length < 600000 && (/^https:\/\/\S+$/.test(u) || u.startsWith('data:audio/'))

export async function loadPacks() {
  for (const url of ['./sons.json', PAGES]) {
    try {
      const r = await fetch(url, { cache: 'no-cache' })
      if (!r.ok) continue
      const j = await r.json()
      if (Array.isArray(j.cats) && j.cats.length) return j
    } catch {}
  }
  return { cats: [] }
}

export async function search(q) {
  for (const api of APIS) {
    try {
      const r = await fetch(`${api}/search?q=${encodeURIComponent(q)}`)
      if (!r.ok) continue
      const j = await r.json()
      return (j.data || []).filter(s => okUrl(s.mp3)).slice(0, 48)
        .map(s => ({ n: String(s.title).slice(0, 40), u: s.mp3 }))
    } catch {}
  }
  throw new Error('indisponible')
}

export function favs() {
  try { return JSON.parse(localStorage.sbfav || '[]') } catch { return [] }
}

export function toggleFav(s) {
  const f = favs()
  const n = f.some(x => x.u === s.u) ? f.filter(x => x.u !== s.u) : [{ n: s.n, u: s.u }, ...f].slice(0, 60)
  localStorage.sbfav = JSON.stringify(n)
  return n
}

export const mine = async () => (await get('sb:mine')) || []

export async function addMine(file) {
  if (!/^audio\//.test(file.type) && !/\.(mp3|ogg|wav|m4a|opus|aac)$/i.test(file.name)) {
    throw new Error('Choisis un fichier audio.')
  }
  if (file.size > 300000) throw new Error('Son trop lourd : 300 Ko maximum (garde quelques secondes).')
  let u = await new Promise((ok, ko) => {
    const r = new FileReader()
    r.onload = () => ok(r.result)
    r.onerror = ko
    r.readAsDataURL(file)
  })
  if (!u.startsWith('data:audio/')) u = u.replace(/^data:[^;,]*/, 'data:audio/mpeg')
  const list = [{ n: file.name.replace(/\.[^.]+$/, '').slice(0, 30), u }, ...(await mine())].slice(0, 40)
  await set('sb:mine', list)
  return list
}

export async function delMine(s) {
  const list = (await mine()).filter(x => x.u !== s.u)
  await set('sb:mine', list)
  return list
}

let live = []
export function play(u) {
  const a = new Audio(u)
  a.volume = Math.min(1, Math.max(0, +(localStorage.sbvol ?? 0.6)))
  const done = () => { live = live.filter(x => x !== a) }
  live.push(a)
  a.onended = done
  a.play().catch(done)
  setTimeout(() => { a.pause(); done() }, 12000)
}

export function stopAll() {
  live.forEach(a => a.pause())
  live = []
        }
    
