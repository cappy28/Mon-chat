import { useEffect, useState } from 'react';
import { get } from 'idb-keyval';
import { colorOf, fmtSize } from '../lib/util.js';

export function Avatar({ n, src, size = 32, talk }) {
  const cls = 'av' + (talk ? ' talk' : '');
  const st = { width: size, height: size, fontSize: size * 0.45 };
  return src
    ? <img className={cls} src={src} style={st} alt="" />
    : <div className={cls} style={{ ...st, background: colorOf(n) }}>{n?.[0]?.toUpperCase()}</div>;
}

export function FileCard({ f, have, prog, onGet, onSave }) {
  const [url, setUrl] = useState(null);
  const kind = (f.type || '').split('/')[0];
  const media = ['image', 'video', 'audio'].includes(kind);
  useEffect(() => {
    if (!have || !media) return;
    let u, alive = true;
    get('f:' + f.fid).then(b => {
      if (b && alive) { u = URL.createObjectURL(new Blob([b], { type: f.type })); setUrl(u); }
    });
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [have, f.fid]);
  return (
    <div className="file" onClick={e => e.stopPropagation()}>
      {url && kind === 'image' && <img src={url} className="pic" alt="" onClick={e => e.target.requestFullscreen?.()} />}
      {url && kind === 'video' && <video src={url} className="pic" controls playsInline />}
      {url && kind === 'audio' && <audio src={url} controls />}
      <div className="fbox">
        <span>📎 {f.name}</span> <small>{fmtSize(f.size)}</small>
        {have ? <button onClick={onSave}>💾</button>
          : prog != null ? <small>⏳ {Math.round(prog * 100)} %</small>
          : <button onClick={onGet}>⬇️</button>}
      </div>
    </div>
  );
    }
    
