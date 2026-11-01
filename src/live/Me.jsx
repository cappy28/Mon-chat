// Onglet « Moi » : modifier son profil + look Ruche + plan de l'appli
import { useState } from 'react'
import { myProfile, saveProfile, BANS, banCss, makeBanner } from './profile.js'
import { Face } from './Face.jsx'
import { plan } from './plan.js'

const GAMES = ['Minecraft', 'Fortnite', 'Roblox', 'Valorant', 'League of Legends', 'Rocket League',
  'Brawl Stars', 'GTA V', 'Among Us', 'EA FC', 'Clash Royale', 'Overwatch 2']

export default function Me({ me }) {
  const [p, setP] = useState(myProfile)
  const [skin, setSkin] = useState(localStorage.skin !== '0')
  const [msg, setMsg] = useState('')
  const [txt, setTxt] = useState('')

  const up = o => { const n = { ...p, ...o }; setP(n); saveProfile(n) }
  const ban = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { up({ ban: await makeBanner(f) }) } catch { setMsg('Image illisible.') }
  }
  const flip = on => {
    setSkin(on)
    localStorage.skin = on ? '1' : '0'
    document.documentElement.classList.toggle('ruche', on)
  }
  const diag = async () => {
    const t = plan()
    setTxt(t)
    try { await navigator.clipboard.writeText(t); setMsg('Copié ! Colle-le dans ta conversation avec moi.') }
    catch { setMsg('Sélectionne le texte ci-dessous et copie-le.') }
  }

  return (
    <div className="lv-me">
      <div className="lv-ban" style={{ background: banCss(p.ban) }}>
        <span className="lv-me-av">
          <Face name={me} av={localStorage.avatar} st={localStorage.status || 'on'} big />
        </span>
      </div>
      <b className="lv-me-name">{me}</b>
      <label>Pronoms
        <input value={p.pron} maxLength={20} placeholder="il/lui, elle, iel…" onChange={e => up({ pron: e.target.value })} />
      </label>
      <label>🎮 Joue à
        <input list="lv-games" value={p.game} maxLength={60} placeholder="Rien pour l'instant"
          onChange={e => up({ game: e.target.value })} />
      </label>
      <datalist id="lv-games">{GAMES.map(g => <option key={g} value={g} />)}</datalist>
      <label>Bio <small>{p.bio.length}/190</small>
        <textarea rows="3" maxLength={190} value={p.bio} onChange={e => up({ bio: e.target.value })} />
      </label>
      <label>Bannière</label>
      <div className="lv-bans">
        {Object.keys(BANS).map(k => (
          <button key={k} title={k} className={p.ban === k ? 'on' : ''} style={{ background: BANS[k] }} onClick={() => up({ ban: k })} />
        ))}
        <label className="lv-banup" title="Ta propre image">🖼️
          <input type="file" accept="image/*" hidden onChange={ban} />
        </label>
      </div>
      <label className="lv-check">
        <input type="checkbox" checked={skin} onChange={e => flip(e.target.checked)} /> Look « Ruche » sur toute l'appli
      </label>
      <button className="lv-wide" onClick={diag}>🔧 Copier le plan de l'appli</button>
      {msg && <p className="lv-muted">{msg}</p>}
      {txt && <textarea className="lv-plan" readOnly rows="4" value={txt} onFocus={e => e.target.select()} />}
    </div>
  )
      }
      
