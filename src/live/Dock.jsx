// Bouton flottant (déplaçable) + onglets « Potes » (profils, appels) et « Moi »
import { useRef, useState } from 'react'
import { Face, Logo } from './Face.jsx'
import Card from './Card.jsx'
import Me from './Me.jsx'

export default function Dock({ me, people, onCall }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('potes')
  const [pick, setPick] = useState([])
  const [card, setCard] = useState(null)
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.dockpos) || { x: 16, y: 96 } } catch { return { x: 16, y: 96 } }
  })
  const drag = useRef(null)

  const byName = {}
  for (const p of Object.values(people)) if (p.n && p.n !== me) byName[p.n] = p
  const list = Object.values(byName).sort((a, b) => a.n.localeCompare(b.n))

  const down = e => {
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = e => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true
    if (d.moved) setPos({
      x: Math.min(innerWidth - 60, Math.max(4, d.x - dx)),
      y: Math.min(innerHeight - 60, Math.max(4, d.y - dy)),
    })
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (d?.moved) localStorage.dockpos = JSON.stringify(pos)
    else if (d) setOpen(o => !o)
  }
  const call = (names, video) => { onCall(names, video); setPick([]); setOpen(false); setCard(null) }
  const flip = n => setPick(x => (x.includes(n) ? x.filter(y => y !== n) : [...x, n]))
  const upper = pos.y > innerHeight / 2
  const place = upper ? { top: Math.max(8, innerHeight - pos.y + 8) } : { bottom: pos.y + 64 }

  return (
    <>
      <button className="lv-fab" style={{ right: pos.x, bottom: pos.y }} title="Ruche"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)}>
        <Logo />
        {list.length > 0 && <span className="lv-badge">{list.length}</span>}
      </button>
      {open && (
        <div className="lv-panel" style={{ right: Math.max(4, Math.min(pos.x, innerWidth - 330)), ...place }}>
          <div className="lv-dtabs">
            <Logo size={22} />
            <button className={tab === 'potes' ? 'on' : ''} onClick={() => setTab('potes')}>🐝 Potes ({list.length})</button>
            <button className={tab === 'moi' ? 'on' : ''} onClick={() => setTab('moi')}>🙂 Moi</button>
          </div>
          {tab === 'moi' ? <Me me={me} /> : (
            <>
              {!list.length && <p className="lv-muted">Personne en ligne avec la nouvelle version pour l'instant.</p>}
              {list.map(p => (
                <div key={p.n} className="lv-row">
                  <input type="checkbox" checked={pick.includes(p.n)} onChange={() => flip(p.n)} />
                  <span onClick={() => setCard(p)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Face name={p.n} av={p.av} st={p.st} />
                    <span>{p.n}{p.st === 'dnd' ? ' 🔕' : ''}{p.game && <small className="lv-sub">🎮 {p.game}</small>}</span>
                  </span>
                  <button onClick={() => call([p.n], false)} title="Appel vocal">📞</button>
                  <button onClick={() => call([p.n], true)} title="Appel vidéo">🎥</button>
                </div>
              ))}
              {pick.length > 1 && (
                <button className="lv-wide" onClick={() => call(pick, false)}>📞 Appel de groupe ({pick.length + 1})</button>
              )}
            </>
          )}
        </div>
      )}
      {card && <Card p={card} onClose={() => setCard(null)} onCall={v => call([card.n], v)} />}
    </>
  )
    }
          
