import { useEffect, useRef, useState } from 'react';
import { joinRoom, selfId } from 'trystero';
import { get, set, keys } from 'idb-keyval';
import { CONFIG, MAX_FILE, isDM, dmOk, notify, mentions, compress, saveBlob } from './lib/util.js';
import { sign, verify } from './lib/identity.js';

const drop = (o, k) => { const c = { ...o }; delete c[k]; return c; };

export function useChat(name) {
  const [recs, setRecs] = useState([]);
  const [peers, setPeers] = useState({});         // peerId -> { n, a } (identité vérifiée)
  const [voice, setVoice] = useState({});         // peerId -> { on, muted }
  const [typing, setTyping] = useState({});       // peerId -> { c, t }
  const [avatars, setAvatars] = useState({});     // pseudo -> photo
  const [have, setHave] = useState(new Set());    // fichiers présents sur cet appareil
  const [prog, setProg] = useState({});           // téléchargements en cours
  const store = useRef([]);
  const peersRef = useRef({});
  const haveRef = useRef(new Set());
  const progRef = useRef({});
  const chanRef = useRef('général');
  const myVoice = useRef({ on: false });
  const net = useRef({});

  // Garde la version la plus récente de chaque enregistrement. Renvoie les nouveaux.
  const merge = (incoming) => {
    const map = new Map(store.current.map(r => [r.id, r]));
    const added = [];
    let changed = false;
    for (const r of incoming) {
      if (!r?.id) continue;
      const old = map.get(r.id);
      if (old && (old.u !== r.u || (r.v || 0) <= (old.v || 0))) continue;   // seul l'auteur peut modifier
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

  // Ne garde que ce qui est correctement signé par son auteur
  const checked = async (list) => {
    const known = new Map(store.current.map(x => [x.id, x]));
    const ok = [];
    for (const r of list) {
      if (!r?.id || typeof r.u !== 'string' || !dmOk(r.c, name) || !dmOk(r.c, r.u)) continue;
      const old = known.get(r.id);
      if (old && (r.v || 0) <= (old.v || 0)) continue;          // déjà à jour
      if (await verify(r, r.u)) ok.push(r);
    }
    return ok;
  };

  const setPeer = (id, val) => {
    peersRef.current = val ? { ...peersRef.current, [id]: val } : drop(peersRef.current, id);
    setPeers(peersRef.current);
  };
  const addHave = (fid) => { haveRef.current = new Set(haveRef.current).add(fid); setHave(haveRef.current); };
  const setP = (fid, val) => {
    progRef.current = val == null ? drop(progRef.current, fid) : { ...progRef.current, [fid]: val };
    setProg(progRef.current);
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
    if (!t) fn?.(data, null, meta); else if (t.length) fn?.(data, t, meta);
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

  // "En train d'écrire" disparaît après 4 s
  useEffect(() => {
    const t = setInterval(() => setTyping(ty => {
      const live = Object.entries(ty).filter(([, v]) => Date.now() - v.t < 4000);
      return live.length === Object.keys(ty).length ? ty : Object.fromEntries(live);
    }), 1000);
    return () => clearInterval(t);
  }, []);

  // Réseau
  useEffect(() => {
    const room = joinRoom(CONFIG, 'serveur');
    const [sendRec, getRec] = room.makeAction('rec');
    const [sendHist, getHist] = room.makeAction('hist');
    const [sendChal, getChal] = room.makeAction('chal');
    const [sendHello, getHello] = room.makeAction('hello');
    const [sendVoice, getVoice] = room.makeAction('voice');
    const [sendTyping, getTyping] = room.makeAction('typing');
    const [sendFile, getFile, onFileProg] = room.makeAction('file');
    const [sendReq, getReq] = room.makeAction('freq');
    const asked = {};    // peerId -> défi qu'on lui a envoyé
    const theirs = {};   // peerId -> défi qu'il nous a envoyé
    const hello = async (id) => sendHello(await sign({
      n: name, a: localStorage.getItem('avatar') || '', nonce: theirs[id], to: id }), id);

    getRec(async (r, id) => {
      setTyping(t => drop(t, id));
      for (const m of merge(await checked([r]))) {
        if (m.k || m.del || m.u === name) continue;
        const ping = mentions(m.txt, name);
        if (!ping && m.c === chanRef.current && !document.hidden) continue;
        const where = isDM(m.c) ? 'MP' : '#' + m.c;
        notify(`${ping ? '🔔 ' : ''}${m.u} (${where})`,
          m.txt || (m.img ? '🖼️ Image' : '📎 ' + (m.file?.name || 'Fichier')));
      }
    });
    getHist(async (list) => Array.isArray(list) && merge(await checked(list.slice(-500))));
    getChal((nonce, id) => {
      if (typeof nonce !== 'string' || nonce.length > 64) return;
      theirs[id] = nonce;
      hello(id);
    });
    getHello(async (d, id) => {
      if (!d || d.nonce !== asked[id] || d.to !== selfId || typeof d.n !== 'string' || d.n.length > 32) return;
      if (!(await verify(d, d.n))) return;
      const isNew = !peersRef.current[id];
      const a = typeof d.a === 'string' && d.a.length < 60000 ? d.a : '';
      setPeer(id, { n: d.n, a });
      if (a) saveAvatar(d.n, a);
      // Historique : seulement les messages signés, jamais les MP des autres
      if (isNew) sendHist(store.current.filter(r => r.sig && dmOk(r.c, d.n)).slice(-500), id);
    });
    getVoice((s, id) => setVoice(v => ({ ...v, [id]: s })));
    getTyping((c, id) => {
      if (!peersRef.current[id] || typeof c !== 'string' || !dmOk(c, name)) return;
      setTyping(t => ({ ...t, [id]: { c, t: Date.now() } }));
    });
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
    room.onPeerJoin(id => {
      asked[id] = crypto.randomUUID();
      sendChal(asked[id], id);
      sendVoice(myVoice.current, id);
    });
    room.onPeerLeave(id => {
      delete asked[id]; delete theirs[id];
      setPeer(id, null);
      setVoice(v => drop(v, id));
      setTyping(t => drop(t, id));
    });
    Object.assign(net.current, { sendRec, sendVoice, sendTyping, sendFile, sendReq,
      rehello: () => Object.keys(theirs).forEach(hello) });
    return () => room.leave();
  }, []);

  const publish = async (r) => {
    const s = await sign(r);
    merge([s]);
    sendTo(net.current.sendRec, s, s.c);
  };

  const attach = async (file, c, re) => {
    const base = { id: crypto.randomUUID(), c, u: name, txt: '', re, t: Date.now(), v: Date.now() };
    if (/^image\/(png|jpe?g|webp|bmp)$/.test(file.type)) {
      try { return await publish({ ...base, img: await compress(file) }); } catch {}
    }
    if (file.size > MAX_FILE) return alert('Fichier trop gros (100 Mo maximum)');
    const fid = crypto.randomUUID();
    await set('f:' + fid, file);
    addHave(fid);
    await publish({ ...base, file: { fid, name: file.name.slice(0, 120), size: file.size, type: file.type } });
    if (file.size <= 10e6) sendTo(net.current.sendFile, await file.arrayBuffer(), c, { fid });
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

  return {
    recs, peers, voice, typing, avatars, have, prog, chanRef,
    publish, attach, fetchFile, saveFile,
    typingIn: (c) => sendTo(net.current.sendTyping, c, c),
    setMyVoice: (s) => { myVoice.current = s; net.current.sendVoice?.(s); },
    rehello: () => net.current.rehello?.(),
  };
                                                                       }
      
