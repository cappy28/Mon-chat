import { EMOJIS, esc, mentions } from '../lib/util.js';
import { Avatar, FileCard } from './Bits.jsx';

const preview = (r) => r.txt?.slice(0, 80) || (r.img ? '🖼️ Image' : r.file ? '📎 ' + r.file.name : '');

// Met en valeur les @pseudo connus
function Text({ txt, names, me }) {
  const alt = [...names].sort((a, b) => b.length - a.length).map(esc).join('|');
  if (!alt) return <p>{txt}</p>;
  const parts = txt.split(new RegExp(`(@(?:${alt}))(?![\\w-])`, 'gi'));
  return (
    <p>{parts.map((p, i) => i % 2
      ? <span key={i} className={'mention' + (p.slice(1).toLowerCase() === me.toLowerCase() ? ' me' : '')}>{p}</span>
      : p)}</p>
  );
}

export default function Message({ m, me, av, names, sel, onSel, reacts, parent, have, prog, act }) {
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
        <b>{m.u}</b> <small>{new Date(m.t).toLocaleString()}{m.ed && ' (modifié)'}</small>
        {m.txt && <Text txt={m.txt} names={names} me={me} />}
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
                                
