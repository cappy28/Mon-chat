// Carte de profil d'un pote
import { Face } from './Face.jsx'
import { banCss } from './profile.js'

const ST = { on: '🟢 En ligne', idle: '🌙 Absent', dnd: '🔕 Ne pas déranger' }

export default function Card({ p, onClose, onCall }) {
  return (
    <div className="lv-veil" onClick={onClose}>
      <div className="lv-card" onClick={e => e.stopPropagation()}>
        <div className="lv-ban" style={{ background: banCss(p.ban) }} />
        <div className="lv-card-av"><Face name={p.n} av={p.av} st={p.st} big /></div>
        <h3>{p.n} {p.pron && <small>· {p.pron}</small>}</h3>
        <p className="lv-muted">{ST[p.st] || ST.on}</p>
        {p.game && <p className="lv-game">🎮 Joue à <b>{p.game}</b></p>}
        {p.bio && <p className="lv-bio">{p.bio}</p>}
        {onCall && (
          <div className="lv-card-btns">
            <button className="lv-wide" onClick={() => onCall(false)}>📞 Appeler</button>
            <button className="lv-wide" onClick={() => onCall(true)}>🎥 Vidéo</button>
          </div>
        )}
      </div>
    </div>
  )
        }
    
