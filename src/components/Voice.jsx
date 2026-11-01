import { useRef, useState } from 'react';
import { joinRoom } from 'trystero';
import { CONFIG } from '../lib/util.js';
import { Avatar } from './Bits.jsx';

export default function Voice({ name, av, peers, voice, onVoice }) {
  const [on, setOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [remote, setRemote] = useState({});          // streamId -> { stream, peer }
  const [speaking, setSpeaking] = useState(new Set());
  const [open, setOpen] = useState(null);            // pseudo dont on règle le volume
  const [vols, setVols] = useState(() => JSON.parse(localStorage.getItem('vols') || '{}'));
  const r = useRef({});

  const setVol = (n, v) => {
    const nx = { ...vols, [n]: v };
    setVols(nx);
    localStorage.setItem('vols', JSON.stringify(nx));
  };

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
        <div key={id}>
          <div className="vm" onClick={() => id !== 'me' && setOpen(open === n ? null : n)}>
            <Avatar n={n} src={av(n)} size={24} talk={!mu && speaking.has(id)} /> {n} {mu && '🔇'}
            {id !== 'me' && (vols[n] ?? 100) !== 100 && <small>{vols[n]} %</small>}
          </div>
          {open === n && id !== 'me' && (
            <input type="range" className="vol" min="0" max="100" value={vols[n] ?? 100}
              onChange={e => setVol(n, +e.target.value)} />
          )}
        </div>
      ))}
      {!on ? <button onClick={join}>Rejoindre le vocal</button> : <>
        <button onClick={toggleMute}>{muted ? '🔇 Réactiver le micro' : '🎙️ Couper le micro'}</button>
        <button onClick={sharing ? stopShare : share}>{sharing ? "⏹️ Arrêter le partage" : "🖥️ Partager l'écran"}</button>
        <button onClick={leave}>📞 Quitter</button>
      </>}
      {Object.entries(remote).map(([sid, { stream, peer }]) => {
        const vol = (vols[peers[peer]?.n] ?? 100) / 100;
        const bind = (el) => {
          if (!el) return;
          if (el.srcObject !== stream) el.srcObject = stream;
          el.volume = vol;
        };
        return stream.getVideoTracks().length
          ? <video key={sid} autoPlay playsInline onClick={e => e.target.requestFullscreen?.()} ref={bind} />
          : <audio key={sid} autoPlay ref={bind} />;
      })}
    </div>
  );
          }
      
