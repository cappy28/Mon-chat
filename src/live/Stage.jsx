// Écran d'appel : tuiles vidéo/avatars, mode réduit, raccourcis clavier
import { useEffect, useRef, useState } from 'react'
import { useCall } from './useCall.js'
import { ringStart, ringStop } from './media.js'
import { Face } from './Face.jsx'
import Soundboard from './Soundboard.jsx'
import { Controls, Options } from './Controls.jsx'

function Media({ stream, video, muted, vol, mirror }) {
  const ref = useRef()
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
  useEffect(() => { if (ref.current && !video) ref.current.muted = !!muted }, [muted, video])
  useEffect(() => { if (ref.current && vol != null) ref.current.volume = Math.min(1, Math.max(0, vol)) }, [vol])
  return video
    ? <video ref={ref} autoPlay playsInline muted className={mirror ? 'lv-mirror' : ''} />
    : <audio ref={ref} autoPlay />
}

const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export default function Stage({ call, me, min, setMin, onHang, onAdd, onJoin, people }) {
  const c = useCall(call.id, me, call.cam)
  const [panel, setPanel] = useState('')
  const [sel, setSel] = useState('')
  const [vols, setVols] = useState(() => { try { return JSON.parse(localStorage.vols || '{}') } catch { return {} } })
  const [now, setNow] = useState(Date.now())
  const had = useRef(false)
  const list = Object.entries(c.peers)
  const n = list.length
  const ringing = !call.answered && !n

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!ringing) return; ringStart(true); return ringStop }, [ringing])
  // Quelqu'un arrive = appel décroché ; en 1-à-1, si l'autre part depuis 15 s, on raccroche
  useEffect(() => {
    if (n) { had.current = true; if (!call.answered) onJoin(); return }
    if (!had.current || call.with.length > 1) return
    const t = setTimeout(onHang, 15000)
    return () => clearTimeout(t)
  }, [n])
  // Raccourcis : M = micro, V maintenu = parler
  useEffect(() => {
    const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable
    const dn = e => {
      if (typing(e) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'v' || e.key === 'V') c.ptt(true)
      if (e.key === 'm' || e.key === 'M') c.toggle('muted')
    }
    const up = e => { if (e.key === 'v' || e.key === 'V') c.ptt(false) }
    addEventListener('keydown', dn)
    addEventListener('keyup', up)
    return () => { removeEventListener('keydown', dn); removeEventListener('keyup', up) }
  }, [])

  const setVol = (name, v) => { const o = { ...vols, [name]: v }; setVols(o); localStorage.vols = JSON.stringify(o) }
  const inCall = new Set(list.map(([, p]) => p.n))
  const addable = [...new Set(Object.values(people).map(p => p.n))].filter(x => x && x !== me && !inCall.has(x))
  const status = ringing ? `Ça sonne chez ${call.ringTo.join(', ') || '…'}`
    : !n ? (had.current ? 'Tout le monde est parti' : 'Connexion…') : fmt(now - call.since)
  const tog = p => setPanel(panel === p ? '' : p)
  const audios = Object.entries(c.auds).map(([pid, s]) => (
    <Media key={pid} stream={s} muted={c.st.deaf} vol={(vols[c.peers[pid]?.n] ?? 100) / 100} />
  ))

  if (min) return (
    <>
      {audios}
      {c.toast && <div className="lv-toast">{c.toast}</div>}
      <div className="lv-pill" onClick={() => setMin(false)} title="Agrandir">
        <span className="lv-dot" /> {status} · {n + 1} 👤
        <button className={c.st.muted ? 'off' : ''} onClick={e => { e.stopPropagation(); c.toggle('muted') }}>{c.st.muted ? '🔇' : '🎤'}</button>
        <button className="lv-red" onClick={e => { e.stopPropagation(); onHang() }}>📞</button>
      </div>
    </>
  )

  return (
    <div className="lv-stage">
      {audios}
      <header className="lv-head">
        <b>{call.video ? '🎥' : '📞'} {call.with.join(', ')}</b>
        <span className="lv-time">{status}</span>
        <button onClick={() => setMin(true)} title="Réduire">▾</button>
      </header>
      {c.err && <p className="lv-err">{c.err}</p>}
      <div className="lv-grid">
        <div className={'lv-tile' + (c.talk.me ? ' talk' : '')}>
          {c.vid ? <Media stream={c.vid} video mirror={c.st.cam} /> : <Face name={me} av={localStorage.avatar} big />}
          <div className="lv-name">{c.st.muted ? '🔇 ' : ''}{me} (toi)</div>
        </div>
        {list.map(([pid, p]) => (
          <div key={pid} className={'lv-tile' + (c.talk[pid] ? ' talk' : '')} onClick={() => setSel(sel === pid ? '' : pid)}>
            {(p.cam || p.scr) && c.vids[pid] ? <Media stream={c.vids[pid]} video /> : <Face name={p.n} av={p.av} big />}
            <div className="lv-name">{p.deaf ? '🙉 ' : p.muted ? '🔇 ' : ''}{p.n}{p.scr ? ' · 🖥️' : ''}</div>
            {sel === pid && (
              <input type="range" min="0" max="100" value={vols[p.n] ?? 100} title="Volume"
                onClick={e => e.stopPropagation()} onChange={e => setVol(p.n, +e.target.value)} />
            )}
          </div>
        ))}
      </div>
      {c.toast && <div className="lv-toast">{c.toast}</div>}
      {panel === 'sb' && <Soundboard onPlay={c.sound} onClose={() => setPanel('')} />}
      {panel === 'opt' && <Options c={c} addable={addable} onAdd={onAdd} />}
      <Controls c={c} panel={panel} tog={tog} onHang={onHang} />
    </div>
  )
    }
            
