import { useEffect, useRef, useState } from 'react';
import { joinRoom } from 'trystero';
import { get, set } from 'idb-keyval';

// Le mot de passe chiffre la connexion : c'est votre "code d'invitation"
const CONFIG = { appId: 'monchat-potes-2026', password: import.meta.env.VITE_ROOM_PASSWORD || 'change-moi' };
const EMOJIS = ['👍', '😂', '❤️', '🔥', '😮', '😢'];

// Réduit les images (1280 px max, JPEG) pour qu'elles s'envoient vite
const compress = (file) => new Promise((ok, ko) => {
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, 1280 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * s);
    cv.height = Math.round(img.height * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(img.src);
    ok(cv.toDataURL('image/jpeg', 0.75));
  };
  img.onerror = ko;
  img.src = URL.createObjectURL(file);
});

export default function App() {
  const [name, setName] = useState(localStorage.getItem('name'));
  if (!name) return <Login onName={n => { localStorage.setItem('name', n); setName(n); }} />;
  return <Chat name={name} />;
}

function Login({ onName }) {
  const [v, setV] = useState('');
  return (
    <form className="auth" onSubmit={e => { e.preventDefault(); v.trim() && onName(v.trim()); }}>
      <h1>MonChat</h1>
      <input placeholder="Ton pseudo" value={v} onChange={e => setV(e.target.value)} />
      <button>Entrer</button>
    </form>
  );
}

function Chat({ name }) {
  const [recs, setRecs] = useState([]);
  const [peers, setPeers] = useState({});           // peerId -> pseudo
  const [channel, setChannel] = useState('général');
  const [extra, setExtra] = useState([]);
  const [text, setText] = useState('');
  const [sel, setSel] = useState(null);             // message sélectionné
  const store = useRef([]);
  const net = useRef({});
  const bottom = useRef();

  // Messages, modifs, suppressions et réactions sont des "enregistrements" avec une version v.
  // On garde toujours la plus récente : tout le monde finit avec la même chose.
  const merge = (incoming) => {
    const map = new Map(store.current.map(r => [r.id, r]));
    let changed = false;
    for (const r of incoming) {
      if (!r?.id) continue;
      const old = map.get(r.id);
      if (old && (old.u !== r.u || (r.v || 0) <= (old.v || 0))) continue; // seul l'auteur peut modifier
      map.set(r.id, r);
      changed = true;
    }
    if (!changed) return;
    const all = [...map.values()].sort((a, b) => a.t - b.t).slice(-3000);
    store.current = all;
    setRecs(all);
    set('recs', all);
  };

  // Chargement de l'historique (et récupération de l'ancien stockage)
  useEffect(() => {
    get('recs').then(saved =>
      merge(saved ?? JSON.parse(localStorage.getItem('msgs') || '[]').map(m => ({ ...m, v: m.t }))));
  }, []);

  useEffect(() => {
    const room = joinRoom(CONFIG, 'serveur');
    const [sendRec, getRec] = room.makeAction('rec');
    const [sendHist, getHist] = room.makeAction('hist');
    const [sendHello, getHello] = room.makeAction('hello');
    getRec(r => merge([r]));
    getHist(list => Array.isArray(list) && merge(list));
    getHello((n, id) => setPeers(p => ({ ...p, [id]: n })));
    room.onPeerJoin(id => { sendHello(name, id); sendHist(store.current.slice(-500), id); });
    room.onPeerLeave(id => setPeers(p => { const c = { ...p }; delete c[id]; return c; }));
    net.current.sendRec = sendRec;
    return () => room.leave();
  }, []);

  const publish = (r) => { merge([r]); net.current.sendRec?.(r); };
  const now = () => Date.now();

  const send = (e) => {
    e.preventDefault();
    const txt = text.trim().slice(0, 4000);
    if (!txt) return;
    publish({ id: crypto.randomUUID(), c: channel, u: name, txt, t: now(), v: now() });
    setText('');
  };

  const sendImage = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const img = await compress(file);
      publish({ id: crypto.randomUUID(), c: channel, u: name, txt: '', img, t: now(), v: now() });
    } catch { alert('Image illisible'); }
  };

  const edit = (m) => {
    const txt = prompt('Modifier le message', m.txt)?.trim();
    if (txt && txt !== m.txt) publish({ ...m, txt: txt.slice(0, 4000), ed: true, v: now() });
    setSel(null);
  };

  const remove = (m) => {
    if (confirm('Supprimer ce message ?'))
      publish({ id: m.id, c: m.c, u: m.u, t: m.t, del: true, v: now() });
    setSel(null);
  };

  const react = (m, e) => {
    const id = `r:${m.id}:${e}:${name}`;
    const cur = store.current.find(r => r.id === id);
    publish({ id, k: 'r', m: m.id, e, u: name, on: !cur?.on, t: now(), v: now() });
  };

  const messages = recs.filter(r => !r.k && !r.del && r.c === channel);
  const reacts = {};                                  // messageId -> { emoji: [pseudos] }
  for (const r of recs) if (r.k === 'r' && r.on) ((reacts[r.m] ??= {})[r.e] ??= []).push(r.u);
  const channels = [...new Set(['général', ...extra, ...recs.filter(r => !r.k).map(r => r.c)])];
  const online = [name, ...Object.values(peers)];

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, channel]);

  return (
    <div className="layout">
      <aside className="channels">
        <h3>Salons</h3>
        {channels.map(c => (
          <div key={c} className={'ch' + (c === channel ? ' active' : '')} onClick={() => setChannel(c)}># {c}</div>
        ))}
        <button onClick={() => { const n = prompt('Nom du salon ?')?.trim().toLowerCase();
          if (n) { setExtra(x => [...x, n]); setChannel(n); } }}>+ Salon</button>
        <Voice />
      </aside>
      <main>
        <header># {channel}</header>
        <div className="messages">
          {messages.map(m => (
            <div key={m.id} className={'msg' + (sel === m.id ? ' sel' : '')}
              onClick={() => setSel(sel === m.id ? null : m.id)}>
              <b>{m.u}</b> <small>{new Date(m.t).toLocaleString()}{m.ed && ' (modifié)'}</small>
              {m.txt && <p>{m.txt}</p>}
              {m.img && <img src={m.img} className="pic" alt=""
                onClick={e => { e.stopPropagation(); e.target.requestFullscreen?.(); }} />}
              {reacts[m.id] && (
                <div className="reacts">
                  {Object.entries(reacts[m.id]).map(([e, us]) => (
                    <span key={e} title={us.join(', ')} className={us.includes(name) ? 'mine' : ''}
                      onClick={ev => { ev.stopPropagation(); react(m, e); }}>{e} {us.length}</span>
                  ))}
                </div>
              )}
              {sel === m.id && (
                <div className="bar" onClick={e => e.stopPropagation()}>
                  {EMOJIS.map(e => <span key={e} onClick={() => react(m, e)}>{e}</span>)}
                  {m.u === name && <>
                    {m.txt && <span onClick={() => edit(m)}>✏️</span>}
                    <span onClick={() => remove(m)}>🗑️</span>
                  </>}
                </div>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <form onSubmit={send} className="composer">
          <label className="attach">🖼️<input type="file" accept="image/*" hidden onChange={sendImage} /></label>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={`Écrire dans #${channel}`} />
        </form>
      </main>
      <aside className="online">
        <h3>En ligne — {online.length}</h3>
        {online.map((u, i) => <div key={i}>🟢 {u}</div>)}
      </aside>
    </div>
  );
}

function Voice() {
  const [on, setOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remote, setRemote] = useState({});          // streamId -> { stream, peer }
  const r = useRef({});

  const join = async () => {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const room = joinRoom(CONFIG, 'vocal');
    const [sendOff, getOff] = room.makeAction('off');
    room.onPeerJoin(id => {
      room.addStream(mic, id);
      if (r.current.screen) room.addStream(r.current.screen, id);
    });
    room.onPeerStream((stream, peer) => setRemote(p => ({ ...p, [stream.id]: { stream, peer } })));
    room.onPeerLeave(peer => setRemote(p =>
      Object.fromEntries(Object.entries(p).filter(([, v]) => v.peer !== peer))));
    getOff(sid => setRemote(p => { const c = { ...p }; delete c[sid]; return c; }));
    r.current = { room, mic, sendOff };
    setOn(true);
  };

  const leave = () => {
    stopShare();
    r.current.mic?.getTracks().forEach(t => t.stop());
    r.current.room?.leave();
    setRemote({}); setOn(false);
  };

  const toggleMute = () => {
    const track = r.current.mic.getAudioTracks()[0];
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const share = async () => {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    r.current.screen = screen;
    r.current.room.addStream(screen);
    screen.getVideoTracks()[0].onended = stopShare;
    setSharing(true);
  };

  function stopShare() {
    const { screen, room, sendOff } = r.current;
    if (!screen) return;
    room.removeStream(screen);
    sendOff(screen.id);
    screen.getTracks().forEach(t => t.stop());
    r.current.screen = null;
    setSharing(false);
  }

  return (
    <div className="voice">
      <h3>🔊 Vocal</h3>
      {!on ? <button onClick={join}>Rejoindre le vocal</button> : <>
        <button onClick={toggleMute}>{muted ? '🔇 Réactiver le micro' : '🎙️ Couper le micro'}</button>
        <button onClick={sharing ? stopShare : share}>{sharing ? "⏹️ Arrêter le partage" : "🖥️ Partager l'écran"}</button>
        <button onClick={leave}>📞 Quitter</button>
      </>}
      {Object.entries(remote).map(([sid, { stream }]) =>
        stream.getVideoTracks().length
          ? <video key={sid} autoPlay playsInline onClick={e => e.target.requestFullscreen?.()}
              ref={el => el && (el.srcObject = stream)} />
          : <audio key={sid} autoPlay ref={el => el && (el.srcObject = stream)} />
      )}
    </div>
  );
}
  
