import { EMOJIS, mentions } from '../lib/util.js';
import { renderMd } from '../lib/markdown.jsx';
import { Avatar, FileCard } from './Bits.jsx';

export const preview = (r) => r.txt?.slice(0, 80) || (r.img ? '🖼️ Image' : r.file ? '📎 ' + r.file.name : '');

export default function Message({ m, me, av, names, sel, onSel, reacts, parent, pinned, have, prog, act }) {
  const pinged = m.u !== me && mentions(m.txt, me);
  return (
    <div id={'m-' + m.id} className={'msg' + (sel ? ' sel' : '') + (pinged ? ' ping' : '')} onClick={onSel}>
      <Avatar n={m.u} src={av(m.u)} />
      <div className="body">
        {m.re && (
          <div className="quote" onClick={e => { e.stopPropagation(); act.jump(m.re); }}>
            ↪️ {!parent ? <i>Message introuvable</i>
              : parent.del ? <i>Message supprimé</i>
              : <><b>{parent.u}</b> {preview(parent)}</>}
          </div>
        )}
        <b>{m.u}</b> <small>{new Date(m.t).toLocaleString()}{m.ed && ' (modifié)'}{pinned && ' · 📌'}</small>
        {m.txt && <div className="txt">{renderMd(m.txt, names, me)}</div>}
        {m.img && <img src={m.img} className="pic" alt=""
          onClick={e => { e.stopPropagation(); e.target.requestFullscreen?.(); }} />}
        {m.file && <FileCard f={m.file} have={have} prog={prog}
          onGet={() => act.get(m.file)} onSave={() => act.save(m.file)} />}
        {reacts && (
          <div className="reacts">
            {Object.entries(reacts).map(([e, us]) => (
              <span key={e} title={us.join(', ')} className={us.includes(me) ? 'mine' : ''}
                onClick={ev => { ev.stopPropagation(); act.react(m, e); }}>{e} {us.length}</span>
            ))}
          </div>
        )}
        {sel && (
          <div className="bar" onClick={e => e.stopPropagation()}>
            {EMOJIS.map(e => <span key={e} onClick={() => act.react(m, e)}>{e}</span>)}
            <span onClick={() => act.reply(m)}>↩️</span>
            <span className={pinned ? 'pinned' : ''} title={pinned ? 'Désépingler' : 'Épingler'}
              onClick={() => act.pin?.(m)}>📌</span>
            {m.u === me && <>
              {m.txt && <span onClick={() => act.edit(m)}>✏️</span>}
              <span onClick={() => act.remove(m)}>🗑️</span>
            </>}
          </div>
        )}
      </div>
    </div>
  );
}
