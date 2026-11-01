// Alerte « nouvelle version » : site (commit) ou appli (numéro de release beta-N)
import { useEffect, useState } from 'react'

const REMOTE = 'https://cappy28.github.io/Mon-chat/version.json'
const RELEASES = 'https://api.github.com/repos/cappy28/Mon-chat/releases?per_page=1'
const PAGE = 'https://github.com/cappy28/Mon-chat/releases'

async function getJson(u) {
  try {
    const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' })
    return r.ok ? await r.json() : null
  } catch { return null }
}

export default function Update() {
  const [up, setUp] = useState(null)

  useEffect(() => {
    let mine = null
    let dead = false
    const web = location.hostname.endsWith('github.io')
    const check = async () => {
      mine ||= await getJson('./version.json') // version chargée au démarrage
      if (!mine || mine.v === 'dev') return
      if (web) {
        const last = await getJson(REMOTE)
        if (!dead && last?.v && last.v !== mine.v) setUp('web')
      } else if (mine.app) {
        const list = await getJson(RELEASES)
        const n = Number(String(list?.[0]?.tag_name || '').match(/(\d+)$/)?.[1] || 0)
        if (!dead && n > mine.app) setUp('app')
      }
    }
    check()
    const t = setInterval(check, 10 * 60000)
    return () => { dead = true; clearInterval(t) }
  }, [])

  if (!up) return null
  return (
    <div className="lv-update">
      ✨ Nouvelle version de Ruche
      {up === 'web'
        ? <button onClick={() => location.reload()}>Recharger</button>
        : <a href={PAGE} target="_blank" rel="noreferrer">Télécharger</a>}
      <button onClick={() => setUp(null)}>✕</button>
    </div>
  )
                                   }
