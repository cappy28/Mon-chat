// Écran d'appel entrant (plein écran + sonnerie)
import { useEffect } from 'react'
import { ringStart, ringStop } from './media.js'
import { Face } from './Face.jsx'

export default function Ring({ inc, av, onOk, onNo }) {
  useEffect(() => { ringStart(false); return ringStop }, [])
  const group = inc.to.length > 1
  return (
    <div className="lv-ring">
      <div className="lv-ring-av"><Face name={inc.from} av={av} big /></div>
      <h2>{inc.from}</h2>
      <p>{inc.video ? '🎥 Appel vidéo' : '📞 Appel vocal'}{group ? ` · groupe de ${inc.to.length + 1}` : ''}</p>
      {localStorage.status === 'dnd' && <p className="lv-muted">🔕 Ne pas déranger : sonnerie coupée</p>}
      <div className="lv-ring-btns">
        <button className="lv-no" onClick={onNo}>✕<small>Refuser</small></button>
        <button className="lv-ok" onClick={() => onOk(false)}>📞<small>Répondre</small></button>
        {inc.video && <button className="lv-ok" onClick={() => onOk(true)}>🎥<small>Vidéo</small></button>}
      </div>
    </div>
  )
      }
          
