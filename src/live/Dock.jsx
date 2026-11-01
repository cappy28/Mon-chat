// Bouton flottant (déplaçable) + liste des potes à appeler
import { useRef, useState } from 'react'
import { Face, Logo } from './Face.jsx'

export default function Dock({ me, people, onCall }) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState([])
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
  const call = (names, video) => { onCall(names, video); setPick([]); setOpen(false) }
  const flip = n => setPick(x => (x.includes(n) ? x.filter(y => y !== n) : [...x, n]))
  const upper = pos.y > innerHeight / 2
  const place = upper ? { top: innerHeight - pos.y + 8 } : { bottom: pos.y + 64 }

  return (
    <>
      <button className="lv-fab" style={{ right: pos.x, bottom: pos.y }} title="Appels"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)}>
        <Logo />
        {list.length > 0 && <span className="lv-badge">{list.length}</span>}
      </button>
      {open && (
        <div className="lv-panel" style={{ right: Math.max(4, Math.min(pos.x, innerWidth - 300)), ...place }}>
          <h3><Logo size={20} /> Ruche · appels</h3>
          {!list.length && <p className="lv-muted">Personne en ligne avec la nouvelle version pour l'instant.</p>}
          {list.map(p => (
            <div key={p.n} className="lv-row">
              <input type="checkbox" checked={pick.includes(p.n)} onChange={() => flip(p.n)} />
              <Face name={p.n} av={p.av} st={p.st} />
              <span>{p.n}{p.st === 'dnd' ? ' 🔕' : ''}</span>
              <button onClick={() => call([p.n], false)} title="Appel vocal">📞</button>
              <button onClick={() => call([p.n], true)} title="Appel vidéo">🎥</button>
            </div>
          ))}
          {pick.length > 1 && (
            <button className="lv-wide" onClick={() => call(pick, false)}>📞 Appel de groupe ({pick.length + 1})</button>
          )}
        </div>
      )}
    </>
  )
}
  
