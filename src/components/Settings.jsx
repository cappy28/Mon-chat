import { useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { THEMES, ACCENTS, applyTheme } from '../lib/theme.js';
import { exportId, importId, getPins, getConflicts, forgetPin } from '../lib/identity.js';
import { compress, beep, native } from '../lib/util.js';
import { Avatar } from './Bits.jsx';

export default function Settings({ name, myAvatar, onAvatar, onClose }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'sombre');
  const [accent, setAccent] = useState(localStorage.getItem('accent') || '#5865f2');
  const [, refresh] = useState(0);
  const conflicts = getConflicts();
  const others = getPins().filter(n => n !== name.toLowerCase());

  const pick = (t, a) => {
    localStorage.setItem('theme', t);
    localStorage.setItem('accent', a);
    setTheme(t); setAccent(a);
    applyTheme();
  };

  const changeAvatar = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const a = await compress(f, 128, 0.8);
      localStorage.setItem('avatar', a);
      onAvatar(a);
    } catch { alert('Image illisible'); }
  };

  const askNotif = async () => {
    try {
      if (native) await LocalNotifications.requestPermissions();
      else await Notification.requestPermission();
      beep();
    } catch { alert('Notifications non disponibles ici'); }
  };

  const copyId = async () => {
    const code = await exportId(name);
    try {
      await navigator.clipboard.writeText(code);
      alert('Code copié ! Colle-le sur ton autre appareil. Ne le donne à personne.');
    } catch { prompt('Copie ce code (ne le donne à personne) :', code); }
  };

  const imp = async () => {
    const code = prompt("Colle le code d'identité");
    if (!code) return;
    try { await importId(code); location.reload(); } catch { alert('Code invalide'); }
  };

  const forget = (n) => {
    if (confirm(`Oublier la clé de ${n} ? Sa prochaine connexion sera acceptée comme nouvelle.`)) {
      forgetPin(n);
      refresh(x => x + 1);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>⚙️ Réglages</h2>
        <div className="me"><Avatar n={name} src={myAvatar} size={48} /> <b>{name}</b></div>
        <label className="btn">👤 Changer la photo
          <input type="file" accept="image/*" hidden onChange={changeAvatar} /></label>
        <button onClick={askNotif}>🔔 Activer les notifications</button>

        <h3>Thème</h3>
        <div className="themes">
          {Object.keys(THEMES).map(t => (
            <span key={t} className={t === theme ? 'on' : ''} onClick={() => pick(t, accent)}
              style={{ background: THEMES[t].bg, color: THEMES[t].text }}>{t}</span>
          ))}
        </div>
        <h3>Couleur</h3>
        <div className="accents">
          {ACCENTS.map(a => (
            <span key={a} className={a === accent ? 'on' : ''} style={{ background: a }} onClick={() => pick(theme, a)} />
          ))}
          <input type="color" value={accent} onChange={e => pick(theme, e.target.value)} />
        </div>

        <h3>Identité</h3>
        <p className="hint">Pour utiliser ton compte sur un autre appareil, copie ton code ici, puis
          importe-le sur l'autre appareil. Ne donne ce code à personne : il permet d'écrire à ta place.</p>
        <button onClick={copyId}>🔑 Copier mon code d'identité</button>
        <button onClick={imp}>📥 Importer un code</button>
        {conflicts.length > 0 && (
          <p className="warn">⚠️ Connexion refusée (clé différente) pour : {conflicts.join(', ')}.
            Si c'est vraiment ton pote sur un nouvel appareil, oublie sa clé ci-dessous.</p>
        )}
        {others.length > 0 && <h3>Clés connues</h3>}
        {others.map(n => (
          <div key={n} className="pin">{n} <span onClick={() => forget(n)}>Oublier</span></div>
        ))}
        <button onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
  }
      
