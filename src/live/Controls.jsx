// Barre de contrôle de l'appel + panneau d'options
import { useState } from 'react'

const canScreen = !!navigator.mediaDevices?.getDisplayMedia

export function Controls({ c, panel, tog, onHang }) {
  const s = c.st
  const hold = v => e => { e.preventDefault(); c.ptt(v) }
  return (
    <>
      {s.ptt && !s.muted && (
        <button className={'lv-ptt' + (s.talking ? ' on' : '')}
          onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)}
          onPointerCancel={hold(false)} onContextMenu={e => e.preventDefault()}>
          {s.talking ? '🎙️ Tu parles…' : 'Maintenir pour parler'}
        </button>
      )}
      <div className="lv-bar">
        <button className={s.muted ? 'off' : ''} onClick={() => c.toggle('muted')} title="Micro (M)">{s.muted ? '🔇' : '🎤'}</button>
        <button className={s.deaf ? 'off' : ''} onClick={() => c.toggle('deaf')} title="Sourdine">{s.deaf ? '🙉' : '🎧'}</button>
        <button className={s.cam ? 'on' : ''} onClick={() => c.video('cam')} title="Caméra">📷</button>
        {canScreen && <button className={s.scr ? 'on' : ''} onClick={() => c.video('scr')} title="Partager l'écran">🖥️</button>}
        <button className={panel === 'sb' ? 'on' : ''} onClick={() => tog('sb')} title="Soundboard">🔊</button>
        <button className={panel === 'opt' ? 'on' : ''} onClick={() => tog('opt')} title="Options">⚙️</button>
        <button className="lv-red" onClick={onHang} title="Raccrocher">📞</button>
      </div>
    </>
  )
}

export function Options({ c, addable, onAdd }) {
  const [ns, setNs] = useState(localStorage.ns === '1')
  return (
    <div className="lv-opt">
      <label>
        <input type="checkbox" checked={c.st.ptt} onChange={e => c.setPtt(e.target.checked)} />
        Appuyer pour parler <small>(touche V maintenue ou gros bouton)</small>
      </label>
      <label>
        <input type="checkbox" checked={ns}
          onChange={e => { setNs(e.target.checked); localStorage.ns = e.target.checked ? '1' : '0' }} />
        Anti-bruit renforcé <small>(s'applique au prochain appel)</small>
      </label>
      <p className="lv-muted">Raccourcis : M = micro · V maintenu = parler</p>
      {addable.length > 0 && <b>Ajouter à l'appel</b>}
      {addable.map(n => (
        <button key={n} className="lv-wide" onClick={() => onAdd(n)}>➕ {n}</button>
      ))}
    </div>
  )
        }
          
