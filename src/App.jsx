import { useEffect, useRef, useState } from 'react';
import { joinRoom } from 'trystero';

// Le mot de passe chiffre la connexion : c'est votre "code d'invitation"
const CONFIG = { appId: 'monchat-potes-2026', password: import.meta.env.VITE_ROOM_PASSWORD || 'change-moi' };
const load = () => JSON.parse(localStorage.getItem('msgs') || '[]');

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
  const [msgs, setMsgs] = useState(load);
  const [peers, setPeers] = useState({});           // peerId -> pseudo
  const [channel, setChannel] = useState('général');
  const [extra, setExtra] = useState([]);
  const [text, setText] = useState('');
  const net = useRef({});
  const bottom = useRef();

  // Fusionne les messages reçus sans doublons, puis sauvegarde
  const merge = (incoming) => setMsgs(prev => {
    const ids = new Set(prev.map(m => m.id));
    const added = incoming.filter(m => m?.id && !ids.has(m.id));
    if (!added.length) return prev;
    const all = [...prev, ...added].sort((a, b) => a.t - b.t).slice(-2000);
    localStorage.setItem('msgs', JSON.stringify(all));
    return all;
  });

  useEffect(() => {
    const room = joinRoom(CONFIG, 'serveur');
    const [sendMsg, getMsg] = room.makeAction('msg');
    const [sendHist, getHist] = room.makeAction('hist');
    const [sendHello, getHello] = room.makeAction('hello');
    getMsg(m => merge([m]));
    getHist(list => merge(list));                      // synchro de l'historique
    getHello((n, id) => setPeers(p => ({ ...p, [id]: n })));
    room.onPeerJoin(id => { sendHello(name, id); sendHist(load().slice(-500), id); });
    room.onPeerLeave(id => setPeers(p => { const c = { ...p }; delete c[id]; return c; }));
    net.current.sendMsg = sendMsg;
    return () => room.leave();
  }, []);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, channel]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const m = { id: crypto.randomUUID(), c: channel, u: name, txt: text.trim().slice(0, 4000), t: Date.now() };
    merge([m]);
    net.current.sendMsg(m);
    setText('');
  };

  const channels = [...new Set(['général', ...extra, ...msgs.map(m => m.c)])];
  const online = [name, ...Object.values(peers)];

  return (
    <div className="layout">
      <aside className="channels">
        <h3>Salons</h3>
        {channels.map(c => (
          <div key={c} className={c === channel ? 'active' : ''} onClick={() => setChannel(c)}># {c}</div>
        ))}
        <button onClick={() => { const n = prompt('Nom du salon ?')?.trim().toLowerCase();
          if (n) { setExtra(x => [...x, n]); setChannel(n); } }}>+ Salon</button>
        <Voice />
      </aside>
      <main>
        <header># {channel}</header>
        <div className="messages">
          {msgs.filter(m => m.c === channel).map(m => (
            <div key={m.id} className="msg">
              <b>{m.u}</b> <small>{new Date(m.t).toLocaleString()}</small>
              <p>{m.txt}</p>
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <form onSubmit={send}>
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
    screen.getVideoTracks()[0].onended = stopShare;   // bouton "Arrêter" du navigateur
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
                                      
