import { useEffect, useRef, useState } from 'react';
import { joinRoom } from 'trystero';
import { get, set, keys } from 'idb-keyval';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Le mot de passe chiffre la connexion : c'est votre "code d'invitation"
const CONFIG = { appId: 'monchat-potes-2026', password: import.meta.env.VITE_ROOM_PASSWORD || 'change-moi' };
const EMOJIS = ['👍', '😂', '❤️', '🔥', '😮', '😢'];
const MAX_FILE = 100e6;                  // 100 Mo
const native = Capacitor.isNativePlatform();

// ---------- Petits outils ----------
const isDM = (c) => typeof c === 'string' && c.startsWith('dm:');
const dmOk = (c, n) => !isDM(c) || c.slice(3).split('|').includes(n);   // ce pseudo a-t-il le droit de voir ?
const fmtSize = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + ' Mo' : Math.ceil(b / 1e3) + ' Ko');
const colorOf = (n = '') => `hsl(${([...n].reduce((h, c) => h + c.charCodeAt(0), 0) * 47) % 360} 50% 45%)`;

// Réduit une image (max px, JPEG)
const compress = (file, max = 1280, q = 0.75) => new Promise((ok, ko) => {
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * s);
    cv.height = Math.round(img.height * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(img.src);
    ok(cv.toDataURL('image/jpeg', q));
  };
  img.onerror = ko;
  img.src = URL.createObjectURL(file);
});

// Petit "ding"
let actx;
const beep = () => {
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + 0.25);
  } catch {}
};

const notify = async (title, body) => {
  beep();
  if (!document.hidden) return;
  try {
    if (native) {
      await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2e9), title, body }] });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {}
};

// Enregistrer un fichier (PC : téléchargement / Android : menu de partage)
const saveBlob = async (blob, filename) => {
  if (native) {
    const data = await new Promise((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1]);
      fr.readAsDataURL(blob);
    });
    const { uri } = await Filesystem.writeFile({
      path: filename.replace(/[^\w.\-]/g, '_'), data, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
};

// ---------- Composants ----------
function Avatar({ n, src, size = 32, talk }) {
  const cls = 'av' + (talk ? ' talk' : '');
  const st = { width: size, height: size, fontSize: size * 0.45 };
  return src
    ? <img className={cls} src={src} style={st} alt="" />
    : <div className={cls} style={{ ...st, background: colorOf(n) }}>{n?.[0]?.toUpperCase()}</div>;
}

function FileCard({ f, have, prog, onGet, onSave }) {
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

export default function App() {
  const [name, setName] = useState(localStorage.getItem('name'));
  if (!name) return <Login onName={n => { localStorage.setItem('name', n); setName(n); }} />;
  return <Chat name={name} />;
}

function Login({ onName }) {
  const [v, setV] = useState('');
  const clean = v.replace(/\|/g, '').trim().slice(0, 32);
  return (
    <form className="auth" onSubmit={e => { e.preventDefault(); clean && onName(clean); }}>
      <h1>MonChat</h1>
      <input placeholder="Ton pseudo" value={v} onChange={e => setV(e.target.value)} />
      <button>Entrer</button>
    </form>
  );
}

function Chat({ name }) {
  const [recs, setRecs] = useState([]);
  const [peers, setPeers] = useState({});            // peerId -> { n, a }
  const [voice, setVoice] = useState({});            // peerId -> { on, muted }
  const [avatars, setAvatars] = useState({});        // pseudo -> photo
  const [myAvatar, setMyAvatar] = useState(localStorage.getItem('avatar') || '');
  const [channel, setChannel] = useState('général');
  const [extra, setExtra] = useState([]);
  const [text, setText] = useState('');
  const [sel, setSel] = useState(null);
  const [have, setHave] = useState(new Set());       // fichiers présents sur cet appareil
  const [prog, setProg] = useState({});              // téléchargements en cours
  const [read, setRead] = useState(() => JSON.parse(localStorage.getItem('read') || '{}'));
  const store = useRef([]);
  const peersRef = useRef({});
  const haveRef = useRef(new Set());
  const progRef = useRef({});
  const chanRef = useRef(channel);
  const myVoice = useRef({ on: false });
  const net = useRef({});
  const bottom = useRef();
  const since = useRef(null);
  if (since.current === null) {
    since.current = Number(localStorage.getItem('since')) || Date.now();
    localStorage.setItem('since', since.current);
  }
  chanRef.current = channel;

  // Garde toujours la version la plus récente de chaque enregistrement. Renvoie les nouveaux.
  const merge = (incoming) => {
    const map = new Map(store.current.map(r => [r.id, r]));
    const added = [];
    let changed = false;
    for (const r of incoming) {
      if (!r?.id || !dmOk(r.c, name)) continue;
      const old = map.get(r.id);
      if (old && (old.u !== r.u || (r.v || 0) <= (old.v || 0))) continue; // seul l'auteur peut modifier
      if (!old) added.push(r);
      map.set(r.id, r);
      changed = true;
    }
    if (changed) {
      const all = [...map.values()].sort((a, b) => a.t - b.t).slice(-3000);
      store.current = all;
      setRecs(all);
      set('recs', all);
    }
    return added;
  };

  const setPeer = (id, val) => {
    const nx = { ...peersRef.current };
    if (val) nx[id] = val; else delete nx[id];
    peersRef.current = nx;
    setPeers(nx);
  };
  const addHave = (fid) => { haveRef.current = new Set(haveRef.current).add(fid); setHave(haveRef.current); };
  const setP = (fid, val) => {
    const nx = { ...progRef.current };
    if (val == null) delete nx[fid]; else nx[fid] = val;
    progRef.current = nx;
    setProg(nx);
  };
  const saveAvatar = (n, a) => setAvatars(prev => {
    if (!a || prev[n] === a) return prev;
    const nx = { ...prev, [n]: a };
    set('avatars', nx);
    return nx;
  });
  // MP : seulement les appareils des 2 personnes. Salon : tout le monde (null).
  const targetsFor = (c) => isDM(c)
    ? Object.entries(peersRef.current).filter(([, p]) => dmOk(c, p.n)).map(([id]) => id)
    : null;
  const sendTo = (fn, data, c, meta) => {
    const t = targetsFor(c);
    if (!t) fn(data, null, meta); else if (t.length) fn(data, t, meta);
  };

  // Chargement local
  useEffect(() => {
    get('recs').then(saved =>
      merge(saved ?? JSON.parse(localStorage.getItem('msgs') || '[]').map(m => ({ ...m, v: m.t }))));
    get('avatars').then(a => a && setAvatars(prev => ({ ...a, ...prev })));
    keys().then(ks => {
      const local = ks.filter(k => typeof k === 'string' && k.startsWith('f:')).map(k => k.slice(2));
      haveRef.current = new Set([...local, ...haveRef.current]);
      setHave(haveRef.current);
    });
  }, []);

  // Réseau
  useEffect(() => {
    const room = joinRoom(CONFIG, 'serveur');
    const [sendRec, getRec] = room.makeAction('rec');
    const [sendHist, getHist] = room.makeAction('hist');
    const [sendHello, getHello] = room.makeAction('hello');
    const [sendVoice, getVoice] = room.makeAction('voice');
    const [sendFile, getFile, onFileProg] = room.makeAction('file');
    const [sendReq, getReq] = room.makeAction('freq');
    const me = () => ({ n: name, a: localStorage.getItem('avatar') || '' });

    getRec(r => {
      for (const m of merge([r])) {
        if (m.k || m.del || m.u === name) continue;
        if (m.c === chanRef.current && !document.hidden) continue;
        const where = isDM(m.c) ? 'MP' : '#' + m.c;
        notify(`${m.u} (${where})`, m.txt || (m.img ? '🖼️ Image' : '📎 ' + (m.file?.name || 'Fichier')));
      }
    });
    getHist(list => Array.isArray(list) && merge(list));
    getHello((d, id) => {
      const p = typeof d === 'string' ? { n: d } : d;
      if (typeof p?.n !== 'string') return;
      const isNew = !peersRef.current[id];
      setPeer(id, { n: p.n.slice(0, 32), a: p.a || '' });
      if (p.a) saveAvatar(p.n, p.a);
      // Historique filtré : on n'envoie jamais les MP des autres
      if (isNew) sendHist(store.current.filter(r => dmOk(r.c, p.n)).slice(-500), id);
    });
    getVoice((s, id) => setVoice(v => ({ ...v, [id]: s })));
    getFile(async (data, id, meta) => {
      const fid = meta?.fid;
      if (typeof fid !== 'string' || fid.length > 64 || haveRef.current.has(fid)) return;
      await set('f:' + fid, new Blob([data]));
      addHave(fid);
      setP(fid, null);
    });
    onFileProg((pct, id, meta) => meta?.fid && !haveRef.current.has(meta.fid) && setP(meta.fid, pct));
    getReq(async (fid, id) => {
      const rec = store.current.find(r => r.file?.fid === fid);
      if (!rec || !dmOk(rec.c, peersRef.current[id]?.n)) return;
      const b = await get('f:' + fid);
      if (b) sendFile(await b.arrayBuffer(), id, { fid });
    });
    room.onPeerJoin(id => { sendHello(me(), id); sendVoice(myVoice.current, id); });
    room.onPeerLeave(id => {
      setPeer(id, null);
      setVoice(v => { const c = { ...v }; delete c[id]; return c; });
    });
    Object.assign(net.current, { sendRec, sendHello, sendVoice, sendFile, sendReq, me });
    return () => room.leave();
  }, []);

  const now = () => Date.now();
  const publish = (r) => { merge([r]); sendTo(net.current.sendRec, r, r.c); };

  const send = (e) => {
    e.preventDefault();
    const txt = text.trim().slice(0, 4000);
    if (!txt) return;
    publish({ id: crypto.randomUUID(), c: channel, u: name, txt, t: now(), v: now() });
    setText('');
  };

  const attach = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const base = { id: crypto.randomUUID(), c: channel, u: name, txt: '', t: now(), v: now() };
    if (/^image\/(png|jpe?g|webp|bmp)$/.test(file.type)) {
      try { return publish({ ...base, img: await compress(file) }); } catch {}
    }
    if (file.size > MAX_FILE) return alert('Fichier trop gros (100 Mo maximum)');
    const fid = crypto.randomUUID();
    await set('f:' + fid, file);
    addHave(fid);
    publish({ ...base, file: { fid, name: file.name.slice(0, 120), size: file.size, type: file.type } });
    // Les petits fichiers partent tout de suite ; les gros sont envoyés à la demande
    if (file.size <= 10e6) sendTo(net.current.sendFile, await file.arrayBuffer(), channel, { fid });
  };

  const fetchFile = (f) => {
    if (haveRef.current.has(f.fid) || progRef.current[f.fid] != null) return;
    setP(f.fid, 0);
    net.current.sendReq?.(f.fid);
    setTimeout(() => {
      if (!haveRef.current.has(f.fid) && !progRef.current[f.fid]) {
        setP(f.fid, null);
        alert("Personne en ligne n'a ce fichier pour l'instant. Réessaie plus tard.");
      }
    }, 15000);
  };

  const saveFile = async (f) => {
    const b = await get('f:' + f.fid);
    if (b) saveBlob(new Blob([b], { type: f.type }), f.name).catch(() => alert('Enregistrement impossible'));
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
    publish({ id, k: 'r', m: m.id, c: m.c, e, u: name, on: !cur?.on, t: now(), v: now() });
  };

  const openDM = (other) => {
    const c = 'dm:' + [name, other].sort().join('|');
    setExtra(x => [...x, c]);
    setChannel(c);
  };

  const newDM = () => {
    const known = [...new Set([...recs.filter(r => !r.k).map(r => r.u), ...Object.values(peers).map(p => p.n)])]
      .filter(n => n && n !== name);
    const n = prompt('MP avec qui ?' + (known.length ? '\n(' + known.join(', ') + ')' : ''))?.replace(/\|/g, '').trim();
    if (n && n !== name) openDM(n);
  };

  const changeAvatar = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const a = await compress(f, 128, 0.8);
      localStorage.setItem('avatar', a);
      setMyAvatar(a);
      net.current.sendHello?.(net.current.me());
    } catch { alert('Image illisible'); }
  };

  const askNotif = async () => {
    try {
      if (native) await LocalNotifications.requestPermissions();
      else await Notification.requestPermission();
      beep();
    } catch { alert('Notifications non disponibles ici'); }
  };

  const onVoice = (s) => { myVoice.current = s; net.current.sendVoice?.(s); };
  const av = (n) => (n === name ? myAvatar : avatars[n]);
  const label = (c) => isDM(c) ? '@ ' + (c.slice(3).split('|').find(x => x !== name) ?? name) : '# ' + c;

  // Données affichées
  const messages = recs.filter(r => !r.k && !r.del && r.c === channel);
  const reacts = {};
  for (const r of recs) if (r.k === 'r' && r.on) ((reacts[r.m] ??= {})[r.e] ??= []).push(r.u);
  const unread = {};
  for (const r of recs)
    if (!r.k && !r.del && r.u !== name && r.t > (read[r.c] ?? since.current)) unread[r.c] = (unread[r.c] || 0) + 1;
  const allCh = [...new Set(['général', ...extra, ...recs.filter(r => !r.k).map(r => r.c)])].filter(Boolean);
  const rooms = allCh.filter(c => !isDM(c));
  const dms = allCh.filter(isDM);
  const online = [...new Set([name, ...Object.values(peers).map(p => p.n)])];
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

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
    <div key={c} className={'ch' + (c === channel ? ' active' : '') + (unread[c] ? ' unread' : '')}
      onClick={() => setChannel(c)}>
      <span>{label(c)}</span>{unread[c] > 0 && c !== channel && <span className="badge">{unread[c]}</span>}
    </div>
  );

  return (
    <div className="layout">
      <aside className="channels">
        <div className="me"><Avatar n={name} src={myAvatar} size={36} /> <b>{name}</b></div>
        <h3>Salons</h3>
        {rooms.map(item)}
        <button onClick={() => { const n = prompt('Nom du salon ?')?.replace(/\|/g, '').trim().toLowerCase();
          if (n && !n.startsWith('dm:')) { setExtra(x => [...x, n.slice(0, 50)]); setChannel(n.slice(0, 50)); } }}>+ Salon</button>
        <h3>Messages privés</h3>
        {dms.map(item)}
        <button onClick={newDM}>✉️ Nouveau MP</button>
        <Voice name={name} av={av} peers={peers} voice={voice} onVoice={onVoice} />
        <h3>Réglages</h3>
        <label className="btn">👤 Photo de profil
          <input type="file" accept="image/*" hidden onChange={changeAvatar} /></label>
        <button onClick={askNotif}>🔔 Activer les notifications</button>
      </aside>
      <main>
        <header>{label(channel)}</header>
        <div className="messages">
          {messages.map(m => (
            <div key={m.id} className={'msg' + (sel === m.id ? ' sel' : '')}
              onClick={() => setSel(sel === m.id ? null : m.id)}>
              <Avatar n={m.u} src={av(m.u)} />
              <div className="body">
                <b>{m.u}</b> <small>{new Date(m.t).toLocaleString()}{m.ed && ' (modifié)'}</small>
                {m.txt && <p>{m.txt}</p>}
                {m.img && <img src={m.img} className="pic" alt=""
                  onClick={e => { e.stopPropagation(); e.target.requestFullscreen?.(); }} />}
                {m.file && <FileCard f={m.file} have={have.has(m.file.fid)} prog={prog[m.file.fid]}
                  onGet={() => fetchFile(m.file)} onSave={() => saveFile(m.file)} />}
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
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <form onSubmit={send} className="composer">
          <label className="attach">📎<input type="file" hidden onChange={attach} /></label>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={`Écrire dans ${label(channel)}`} />
        </form>
      </main>
      <aside className="online">
        <h3>En ligne — {online.length}</h3>
        {online.map(n => (
          <div key={n} className="user" title={n !== name ? 'Envoyer un MP' : ''}
            onClick={() => n !== name && openDM(n)}>
            <Avatar n={n} src={av(n)} size={28} /> {n}
          </div>
        ))}
      </aside>
    </div>
  );
}

function Voice({ name, av, peers, voice, onVoice }) {
  const [on, setOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remote, setRemote] = useState({});          // streamId -> { stream, peer }
  const [speaking, setSpeaking] = useState(new Set());
  const r = useRef({});

  // Analyse du volume d'un flux audio (pour le cercle vert)
  const watch = (key, stream) => {
    try {
      const an = r.current.ctx.createAnalyser();
      an.fftSize = 512;
      r.current.ctx.createMediaStreamSource(stream).connect(an);
      r.current.an[key] = an;
    } catch {}
  };

  const join = async () => {
    let mic;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return alert('Micro refusé ou introuvable'); }
    const ctx = new AudioContext();
    ctx.resume();
    r.current = { mic, ctx, an: {} };
    watch('me', mic);
    const room = joinRoom(CONFIG, 'vocal');
    const [sendOff, getOff] = room.makeAction('off');
    room.onPeerJoin(id => {
      room.addStream(mic, id);
      if (r.current.screen) room.addStream(r.current.screen, id);
    });
    room.onPeerStream((stream, peer) => {
      if (!stream.getVideoTracks().length) watch(peer, stream);
      setRemote(p => ({ ...p, [stream.id]: { stream, peer } }));
    });
    room.onPeerLeave(peer => {
      delete r.current.an[peer];
      setRemote(p => Object.fromEntries(Object.entries(p).filter(([, v]) => v.peer !== peer)));
    });
    getOff(sid => setRemote(p => { const c = { ...p }; delete c[sid]; return c; }));
    const buf = new Uint8Array(512);
    const timer = setInterval(() => {
      const talking = [];
      for (const [k, an] of Object.entries(r.current.an || {})) {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += (buf[i] - 128) ** 2;
        if (Math.sqrt(s / buf.length) > 4) talking.push(k);
      }
      const key = talking.sort().join();
      if (key !== r.current.last) { r.current.last = key; setSpeaking(new Set(talking)); }
    }, 150);
    Object.assign(r.current, { room, sendOff, timer });
    setOn(true); setMuted(false);
    onVoice({ on: true, muted: false });
  };

  const leave = () => {
    stopShare();
    clearInterval(r.current.timer);
    r.current.mic?.getTracks().forEach(t => t.stop());
    r.current.room?.leave();
    r.current.ctx?.close();
    r.current = {};
    setRemote({}); setSpeaking(new Set()); setOn(false);
    onVoice({ on: false });
  };

  const toggleMute = () => {
    const track = r.current.mic.getAudioTracks()[0];
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
    onVoice({ on: true, muted: !track.enabled });
  };

  const share = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      r.current.screen = screen;
      r.current.room.addStream(screen);
      screen.getVideoTracks()[0].onended = stopShare;
      setSharing(true);
    } catch {}
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

  const members = [
    ...(on ? [['me', name, muted]] : []),
    ...Object.entries(voice).filter(([id, s]) => s?.on && peers[id]).map(([id, s]) => [id, peers[id].n, s.muted]),
  ];

  return (
    <div className="voice">
      <h3>🔊 Vocal</h3>
      {members.map(([id, n, mu]) => (
        <div key={id} className="vm">
          <Avatar n={n} src={av(n)} size={24} talk={!mu && speaking.has(id)} /> {n} {mu && '🔇'}
        </div>
      ))}
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
