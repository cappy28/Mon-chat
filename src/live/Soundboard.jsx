// Panneau soundboard : packs de mèmes, recherche, favoris, mes sons
import { useEffect, useState } from 'react'
import { loadPacks, search, favs, toggleFav, mine, addMine, delMine, stopAll } from './sounds.js'

export default function Soundboard({ onPlay, onClose }) {
  const [packs, setPacks] = useState([])
  const [tab, setTab] = useState('fav')
  const [list, setList] = useState([])
  const [fv, setFv] = useState(favs)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [vol, setVol] = useState(+(localStorage.sbvol ?? 0.6))

  useEffect(() => {
    loadPacks().then(j => {
      setPacks(j.cats)
      if (!favs().length && j.cats.length) setTab(0)
      if (!j.cats.length) setMsg('Packs indisponibles : utilise la recherche ou « Mes sons ».')
    })
  }, [])

  useEffect(() => {
    if (tab === 'fav') setList(fv)
    else if (tab === 'mine') mine().then(setList)
    else if (typeof tab === 'number') setList(packs[tab]?.sons || [])
  }, [tab, packs, fv])

  const find = async e => {
    e.preventDefault()
    if (!q.trim()) return
    setTab('search')
    setList([])
    setMsg('Recherche…')
    try {
      const r = await search(q.trim())
      setList(r)
      setMsg(r.length ? '' : 'Aucun son trouvé.')
    } catch {
      setMsg('Recherche en direct indisponible (API Myinstants injoignable).')
    }
  }

  const upload = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setList(await addMine(f)); setMsg('') } catch (er) { setMsg(er.message) }
  }

  const tabBtn = (id, label) => (
    <button key={String(id)} className={tab === id ? 'on' : ''} onClick={() => { setMsg(''); setTab(id) }}>{label}</button>
  )

  return (
    <div className="lv-sb">
      <div className="lv-sb-top">
        <b>🔊 Soundboard</b>
        <input type="range" min="0" max="1" step="0.05" value={vol} title="Volume des sons"
          onChange={e => { setVol(+e.target.value); localStorage.sbvol = e.target.value }} />
        <button onClick={stopAll} title="Couper les sons">⏹</button>
        <button onClick={onClose}>✕</button>
      </div>
      <form onSubmit={find}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un mème (ex : bruh)…" />
      </form>
      <div className="lv-tabs">
        {tabBtn('fav', '⭐ Favoris')}
        {packs.map((p, i) => tabBtn(i, p.titre))}
        {tab === 'search' && tabBtn('search', '🔎 Résultats')}
        {tabBtn('mine', '📁 Mes sons')}
      </div>
      {msg && <p className="lv-muted">{msg}</p>}
      <div className="lv-pads">
        {list.map((s, i) => (
          <div key={i + s.u.slice(-40)} className="lv-pad">
            <button onClick={() => onPlay(s)} title={s.n}>{s.n}</button>
            {tab === 'mine'
              ? <i onClick={async () => setList(await delMine(s))}>🗑</i>
              : <i onClick={() => setFv(toggleFav(s))}>{fv.some(x => x.u === s.u) ? '★' : '☆'}</i>}
          </div>
        ))}
        {tab === 'mine' && (
          <label className="lv-add">➕ Ajouter un son<br /><small>mp3 ≤ 300 Ko</small>
            <input type="file" accept="audio/*" hidden onChange={upload} />
          </label>
        )}
      </div>
      {tab === 'fav' && !list.length && <p className="lv-muted">Touche ☆ sur un son pour l'épingler ici.</p>}
      <p className="lv-credit">Sons de mèmes : Myinstants (API non officielle) · usage privé entre potes</p>
    </div>
  )
    }
    
