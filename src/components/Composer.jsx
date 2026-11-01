import { useRef, useState } from 'react';

export default function Composer({ label, names, me, reply, onCancelReply, onSend, onFile, onTyping }) {
  const [text, setText] = useState('');
  const last = useRef(0);
  const input = useRef();

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

  return (
    <div>
      {sugg.length > 0 && (
        <div className="sugg">{sugg.map(n => <span key={n} onClick={() => pick(n)}>@{n}</span>)}</div>
      )}
      {reply && (
        <div className="replying">↩️ Réponse à <b>{reply.u}</b> <span onClick={onCancelReply}>✕</span></div>
      )}
      <form onSubmit={submit} className="composer">
        <label className="attach">📎
          <input type="file" hidden onChange={e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (f) onFile(f);
          }} />
        </label>
        <input ref={input} value={text} onChange={change} placeholder={`Écrire dans ${label}`} />
      </form>
    </div>
  );
           }
    
