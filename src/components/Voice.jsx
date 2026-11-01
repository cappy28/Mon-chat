import { useRef, useState } from 'react';
import { joinRoom } from 'trystero';
import { CONFIG } from '../lib/util.js';
import { Avatar } from './Bits.jsx';

const canShare = !!navigator.mediaDevices?.getDisplayMedia;

export default function Voice({ name, av, peers, voice, onVoice }) {
  const [room, setRoom] = useState(null);            // salon vocal actuel (null = pas en vocal)
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cam, setCam] = useState(null);              // flux de ma caméra (aperçu)
  const [remote, setRemote] = useState({});          // streamId -> { stream, peer }
  const [speaking, setSpeaking] = useState(new Set());
  const [open, setOpen] = useState(null);            // pseudo dont on règle le volume
  const [vols, setVols] = useState(() => JSON.parse(localStorage.getItem('vols') || '{}'));
  const [extra, setExtra] = useState(() => JSON.parse(localStorage.getItem('vrooms') || '[]'));
  const r = useRef({});
  const busy = useRef(false);

  const setVol = (n, v) => {
    const nx = { ...vols, [n]: v };
    setVols(nx);
    localStorage.setItem('vols', JSON.stringify(nx));
  };

  const report = () => onVoice({
    on: !!r.current.room, room: r.current.rn, muted: !!r.current.muted, cam: !!r.current.cam });

  // Analyse du volume d'un flux audio (pour le cercle vert)
  const watch = (key, stream) => {
    try {
      const an = r.current.ctx.createAnalyser();
      an.fftSize = 512;
      r.current.ctx.createMediaStreamSource(stream).connect(an);
      r.current.an[key] = an;
    } catch {}
  };

  const join = async (rn) => {
    if (busy.current || r.current.rn === rn) return;
    busy.current = true;
    let mic;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { busy.current = false; return alert('Micro refusé ou introuvable'); }
    if (r.current.room) leave();
    const ctx = new AudioContext();
    ctx.resume();
    r.current = { mic, ctx, an: {}, rn };
    watch('me', mic);
    const tr = joinRoom(CONFIG, 'vocal:' + rn);
    const [sendOff, getOff] = tr.makeAction('off');
    tr.onPeerJoin(id => {
      tr.addStream(mic, id);
      if (r.current.screen) tr.addStream(r.current.screen, id);
      if (r.current.cam) tr.addStream(r.current.cam, id);
    });
    tr.onPeerStream((stream, peer) => {
      if (!stream.getVideoTracks().length) watch(peer, stream);
      setRemote(p => ({ ...p, [stream.id]: { stream, peer } }));
    });
    tr.onPeerLeave(peer => {
      if (r.current.an) delete r.current.an[peer];
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
    Object.assign(r.current, { room: tr, sendOff, timer });
    setRoom(rn); setMuted(false);
    busy.current = false;
    report();
  };

  const leave = () => {
    stopVideo('screen');
    stopVideo('cam');
    clearInterval(r.current.timer);
    r.current.mic?.getTracks().forEach(t => t.stop());
    r.current.room?.leave();
    r.current.ctx?.close();
    r.current = {};
    setRemote({}); setSpeaking(new Set()); setRoom(null); setMuted(false);
    report();
  };

  const toggleMute = () => {
    const track = r.current.mic?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    r.current.muted = !track.enabled;
    setMuted(r.current.muted);
    report();
  };

  // kind = 'screen' (partage d'écran) ou 'cam' (caméra)
  const startVideo = async (kind) => {
    try {
      const s = kind === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (!r.current.room) return s.getTracks().forEach(t => t.stop());
      r.current[kind] = s;
      r.current.room.addStream(s);
      s.getVideoTracks()[0].onended = () => stopVideo(kind);
      if (kind === 'screen') setSharing(true); else setCam(s);
      report();
    } catch { if (kind === 'cam') alert('Caméra refusée ou introuvable'); }
  };

  function stopVideo(kind) {
    const s = r.current[kind];
    if (!s) return;
    r.current.room?.removeStream(s);
    r.current.sendOff?.(s.id);
    s.getTracks().forEach(t => t.stop());
    r.current[kind] = null;
    if (kind === 'screen') setSharing(false); else setCam(null);
    report();
  }

  const addRoom = () => {
    const n = prompt('Nom du salon vocal ?')?.trim().slice(0, 30);
    if (!n) return;
    const nx = [...new Set([...extra, n])];
    setExtra(nx);
    localStorage.setItem('vrooms', JSON.stringify(nx));
  };

  const live = Object.entries(voice).filter(([id, s]) =>
    s?.on && typeof s.room === 'string' && s.room.length <= 30 && peers[id]);
  const rooms = [...new Set(['Général', ...extra, ...live.map(([, s]) => s.room), ...(room ? [room] : [])])];
  const inRoom = (rn) => [
    ...(room === rn ? [['me', name, muted, !!cam]] : []),
    ...live.filter(([, s]) => s.room === rn).map(([id, s]) => [id, peers[id].n, s.muted, s.cam]),
  ];

  return (
    <div className="voice">
      <h3>🔊 Vocal</h3>
      {rooms.map(rn => (
        <div key={rn} className="vroom">
          <div className={'ch' + (rn === room ? ' active' : '')} onClick={() => join(rn)}>🔊 {rn}</div>
          {inRoom(rn).map(([id, n, mu, cm]) => (
            <div key={id}>
              <div className="vm" onClick={() => id !== 'me' && setOpen(open === n ? null : n)}>
                <Avatar n={n} src={av(n)} size={24} talk={!mu && speaking.has(id)} /> {n} {mu && '🔇'} {cm && '📷'}
                {id !== 'me' && (vols[n] ?? 100) !== 100 && <small>{vols[n]} %</small>}
              </div>
              {open === n && id !== 'me' && (
                <input type="range" className="vol" min="0" max="100" value={vols[n] ?? 100}
                  onChange={e => setVol(n, +e.target.value)} />
              )}
            </div>
          ))}
        </div>
      ))}
      <button onClick={addRoom}>+ Salon vocal</button>
      {room && <>
        <button onClick={toggleMute}>{muted ? '🔇 Réactiver le micro' : '🎙️ Couper le micro'}</button>
        <button onClick={() => (cam ? stopVideo('cam') : startVideo('cam'))}>{cam ? '📷 Couper la caméra' : '📷 Caméra'}</button>
        {canShare && <button onClick={() => (sharing ? stopVideo('screen') : startVideo('screen'))}>
          {sharing ? "⏹️ Arrêter le partage" : "🖥️ Partager l'écran"}</button>}
        <button onClick={leave}>📞 Quitter</button>
      </>}
      {Object.entries(remote).map(([sid, { stream, peer }]) => {
        const n = peers[peer]?.n;
        const vol = (vols[n] ?? 100) / 100;
        const bind = (el) => {
          if (!el) return;
          if (el.srcObject !== stream) el.srcObject = stream;
          el.volume = vol;
        };
        return stream.getVideoTracks().length
          ? <figure key={sid} className="vid">
              <video autoPlay playsInline onClick={e => e.target.requestFullscreen?.()} ref={bind} />
              <figcaption>{n}</figcaption>
            </figure>
          : <audio key={sid} autoPlay ref={bind} />;
      })}
      {cam && (
        <figure className="vid">
          <video className="self" autoPlay playsInline muted
            ref={el => { if (el && el.srcObject !== cam) el.srcObject = cam; }} />
          <figcaption>Toi</figcaption>
        </figure>
      )}
    </div>
  );
}
