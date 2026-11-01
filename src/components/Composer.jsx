import { useEffect, useRef, useState } from 'react';

const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

export default function Composer({ label, names, me, reply, onCancelReply, onSend, onFile, onTyping }) {
  const [text, setText] = useState('');
  const [recStart, setRecStart] = useState(0);     // 0 = pas d'enregistrement
  const [, tick] = useState(0);
  const last = useRef(0);
  const input = useRef();
  const mr = useRef(null);

  useEffect(() => {
    if (!recStart) return;
    const t = setInterval(() => tick(x => x + 1), 500);
    return () => clearInterval(t);
  }, [recStart]);

  // Changement de salon pendant un enregistrement : on annule
  useEffect(() => () => stopRec(false), []);

  function stopRec(keep) {
    const r = mr.current;
    if (!r) return;
    r.keep = keep;
    mr.current = null;
    setRecStart(0);
    if (r.state !== 'inactive') r.stop();
  }

  const startRec = async () => {
    if (mr.current) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return alert('Micro refusé ou introuvable'); }
    if (mr.current) return stream.getTracks().forEach(t => t.stop());
    let r;
    try { r = new MediaRecorder(stream); }
    catch { stream.getTracks().forEach(t => t.stop()); return alert('Enregistrement non disponible ici'); }
    const chunks = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (!r.keep || !chunks.length) return;
      const type = (r.mimeType || 'audio/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      onFile(new File(chunks, `message-vocal.${ext}`, { type }));
    };
    r.start();
    mr.current = r;
    setRecStart(Date.now());
  };

  // Suggestions quand on tape @...
  const m = text.match(/@([^\s@]*)$/);
  const sugg = m
    ? names.filter(n => n !== me && n.toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 5)
    : [];

  const change = (e) => {
    setText(e.target.value);
    if (e.target.value && Date.now() - last.current > 2500) { last.current = Date.now(); onTyping(); }
  };
  const pick = (n) => { setText(text.replace(/@([^\s@]*)$/, '@' + n + ' ')); input.current?.focus(); };
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 4000));
    setText('');
    last.current = 0;
  };

  const secs = recStart ? Math.max(0, Math.floor((Date.now() - recStart) / 1000)) : 0;

  return (
    <div>
      {sugg.length > 0 && (
        <div className="sugg">{sugg.map(n => <span key={n} onClick={() => pick(n)}>@{n}</span>)}</div>
      )}
      {reply && (
        <div className="replying">↩️ Réponse à <b>{reply.u}</b> <span onClick={onCancelReply}>✕</span></div>
      )}
      {recStart ? (
        <div className="composer rec">
          <span className="t">🔴 Enregistrement… {fmt(secs)}</span>
          <button type="button" className="mini ghost" onClick={() => stopRec(false)}>✕</button>
          <button type="button" className="mini" onClick={() => stopRec(true)}>➤</button>
        </div>
      ) : (
        <form onSubmit={submit} className="composer">
          <label className="attach">📎
            <input type="file" hidden onChange={e => {
              const f = e.target.files[0];
              e.target.value = '';
              if (f) onFile(f);
            }} />
          </label>
          <input ref={input} value={text} onChange={change} placeholder={`Écrire dans ${label}`} />
          {text.trim()
            ? <button className="mini">➤</button>
            : <button type="button" className="mini ghost" onClick={startRec}>🎤</button>}
        </form>
      )}
    </div>
  );
}
