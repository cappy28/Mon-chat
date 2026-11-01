import { useEffect, useRef, useState } from 'react';
import { loadIdentity, importId } from './lib/identity.js';
import { applyTheme } from './lib/theme.js';
import { isDM } from './lib/util.js';
import { useChat } from './useChat.js';
import { Avatar } from './components/Bits.jsx';
import Message from './components/Message.jsx';
import Composer from './components/Composer.jsx';
import Voice from './components/Voice.jsx';
import Settings from './components/Settings.jsx';

applyTheme();

export default function App() {
  const [name, setName] = useState(localStorage.getItem('name'));
  const [ready, setReady] = useState(false);
  useEffect(() => { if (name) loadIdentity(name).then(() => setReady(true)); }, [name]);
  if (!name) return <Login onName={n => { localStorage.setItem('name', n); setName(n); }} />;
  if (!ready) return <div className="auth">Chargement…</div>;
  return <Chat name={name} />;
}

function Login({ onName }) {
  const [v, setV] = useState('');
  const clean = v.replace(/\|/g, '').trim().slice(0, 32);
  const imp = async () => {
    const code = prompt("Colle le code d'identité de ton autre appareil");
    if (!code) return;
    try { onName(await importId(code)); } catch { alert('Code invalide'); }
  };
  return (
    <form className="auth" onSubmit={e => { e.preventDefault(); clean && onName(clean); }}>
      <h1>MonChat</h1>
      <input placeholder="Ton pseudo" value={v} onChange={e => setV(e.target.value)} />
      <button>Entrer</button>
      <a onClick={imp}>J'ai déjà un compte sur un autre appareil</a>
    </form>
  );
}

function Chat({ name }) {
  const chat = useChat(name);
  const { recs, peers, voice, typing, avatars, have, prog } = chat;
  const [myAvatar, setMyAvatar] = useState(localStorage.getItem('avatar') || '');
  const [channel, setChannel] = useState('général');
  const [extra, setExtra] = useState([]);
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState(null);
  const [settings, setSettings] = useState(false);
  const [read, setRead] = useState(() => JSON.parse(localStorage.getItem('read') || '{}'));
  const [since] = useState(() => {
    const s = Number(localStorage.getItem('since')) || Date.now();
    localStorage.setItem('since', s);
    return s;
  });
  const bottom = useRef();
  chat.chanRef.current = channel;

  const now = () => Date.now();
  const go = (c) => { setChannel(c); setSel(null); setReply(null); };
  const send = (txt) => {
    chat.publish({ id: crypto.randomUUID(), c: channel, u: name, txt, re: reply?.id, t: now(), v: now() });
    setReply(null);
  };
  const sendFile = (f) => { chat.attach(f, channel, reply?.id); setReply(null); };

  const act = {
    react: (m, e) => {
      const id = `r:${m.id}:${e}:${name}`;
      const cur = recs.find(r => r.id === id);
      chat.publish({ id, k: 'r', m: m.id, c: m.c, e, u: name, on: !cur?.on, t: now(), v: now() });
    },
    reply: (m) => { setReply(m); setSel(null); },
    edit: (m) => {
      const txt = prompt('Modifier le message', m.txt)?.trim();
      if (txt && txt !== m.txt) chat.publish({ ...m, txt: txt.slice(0, 4000), ed: true, v: now() });
      setSel(null);
    },
    remove: (m) => {
      if (confirm('Supprimer ce message ?'))
        chat.publish({ id: m.id, c: m.c, u: m.u, t: m.t, del: true, v: now() });
      setSel(null);
    },
    jump: (id) => {
      const el = document.getElementById('m-' + id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    },
    get: chat.fetchFile,
    save: chat.saveFile,
  };

  const openDM = (other) => { const c = 'dm:' + [name, other].sort().join('|'); setExtra(x => [...x, c]); go(c); };
  const newDM = () => {
    const known = names.filter(n => n !== name);
    const n = prompt('MP avec qui ?' + (known.length ? '\n(' + known.join(', ') + ')' : ''))?.replace(/\|/g, '').trim();
    if (n && n !== name) openDM(n);
  };
  const newRoom = () => {
    const n = prompt('Nom du salon ?')?.replace(/\|/g, '').trim().toLowerCase().slice(0, 50);
    if (n && !n.startsWith('dm:')) { setExtra(x => [...x, n]); go(n); }
  };

  const av = (n) => (n === name ? myAvatar : avatars[n]);
  const label = (c) => isDM(c) ? '@ ' + (c.slice(3).split('|').find(x => x !== name) ?? name) : '# ' + c;

  // Données affichées
  const messages = recs.filter(r => !r.k && !r.del && r.c === channel);
  const byId = new Map(recs.map(r => [r.id, r]));
  const reacts = {};
  for (const r of recs) if (r.k === 'r' && r.on) ((reacts[r.m] ??= {})[r.e] ??= []).push(r.u);
  const unread = {};
  for (const r of recs)
    if (!r.k && !r.del && r.u !== name && r.t > (read[r.c] ?? since)) unread[r.c] = (unread[r.c] || 0) + 1;
  const allCh = [...new Set(['général', ...extra, ...recs.filter(r => !r.k).map(r => r.c)])].filter(Boolean);
  const rooms = allCh.filter(c => !isDM(c));
  const dms = allCh.filter(isDM);
  const online = [...new Set([name, ...Object.values(peers).map(p => p.n)])];
  const names = [...new Set([name, ...recs.filter(r => !r.k).map(r => r.u), ...online])].filter(Boolean);
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const typers = [...new Set(Object.entries(typing)
    .filter(([id, v]) => v.c === channel && peers[id]).map(([id]) => peers[id].n))].filter(n => n !== name);
  const typingText = !typers.length ? ''
    : typers.length === 1 ? `${typers[0]} est en train d'écrire…`
    : typers.length <= 3 ? `${typers.join(', ')} écrivent…` : 'Plusieurs personnes écrivent…';

  // Marquer le salon ouvert comme lu
  useEffect(() => {
    const mark = () => {
      if (document.hidden) return;
      const last = messages[messages.length - 1]?.t || 0;
      setRead(rd => {
        const nx = { ...rd, [channel]: Math.max(Date.now(), last) };
        localStorage.setItem('read', JSON.stringify(nx));
        return nx;
      });
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [channel, messages.length]);

  useEffect(() => { document.title = totalUnread ? `(${totalUnread}) MonChat` : 'MonChat'; }, [totalUnread]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, channel]);

  const item = (c) => (
    <div key={c} className={'ch' + (c === channel ? ' active' : '') + (unread[c] ? ' unread' : '')} onClick={() => go(c)}>
      <span>{label(c)}</span>{unread[c] > 0 && c !== channel && <span className="badge">{unread[c]}</span>}
    </div>
  );

  return (
    <div className="layout">
      <aside className="channels">
        <div className="me">
          <Avatar n={name} src={myAvatar} size={36} /> <b>{name}</b>
          <span className="gear" onClick={() => setSettings(true)}>⚙️</span>
        </div>
        <h3>Salons</h3>
        {rooms.map(item)}
        <button onClick={newRoom}>+ Salon</button>
        <h3>Messages privés</h3>
        {dms.map(item)}
        <button onClick={newDM}>✉️ Nouveau MP</button>
        <Voice name={name} av={av} peers={peers} voice={voice} onVoice={chat.setMyVoice} />
      </aside>
      <main>
        <header>{label(channel)}</header>
        <div className="messages">
          {messages.map(m => (
            <Message key={m.id} m={m} me={name} av={av} names={names} act={act}
              sel={sel === m.id} onSel={() => setSel(sel === m.id ? null : m.id)}
              reacts={reacts[m.id]} parent={m.re ? byId.get(m.re) : undefined}
              have={!!m.file && have.has(m.file.fid)} prog={m.file ? prog[m.file.fid] : undefined} />
          ))}
          <div ref={bottom} />
        </div>
        <div className="typing">{typingText}</div>
        <Composer key={channel} label={label(channel)} names={names} me={name} reply={reply}
          onCancelReply={() => setReply(null)} onSend={send} onFile={sendFile}
          onTyping={() => chat.typingIn(channel)} />
      </main>
      <aside className="online">
        <h3>En ligne — {online.length}</h3>
        {online.map(n => (
          <div key={n} className="user" title={n !== name ? 'Envoyer un MP' : ''} onClick={() => n !== name && openDM(n)}>
            <Avatar n={n} src={av(n)} size={28} /> {n}
          </div>
        ))}
      </aside>
      {settings && (
        <Settings name={name} myAvatar={myAvatar} onClose={() => setSettings(false)}
          onAvatar={a => { setMyAvatar(a); chat.rehello(); }} />
      )}
    </div>
  );
    }
  
