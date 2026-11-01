import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Le mot de passe chiffre la connexion : c'est votre "code d'invitation"
export const CONFIG = { appId: 'monchat-potes-2026', password: import.meta.env.VITE_ROOM_PASSWORD || 'change-moi' };
export const EMOJIS = ['👍', '😂', '❤️', '🔥', '😮', '😢'];
export const MAX_FILE = 100e6;                  // 100 Mo
export const native = Capacitor.isNativePlatform();

export const isDM = (c) => typeof c === 'string' && c.startsWith('dm:');
export const dmOk = (c, n) => !isDM(c) || c.slice(3).split('|').includes(n);
export const fmtSize = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + ' Mo' : Math.ceil(b / 1e3) + ' Ko');
export const colorOf = (n = '') => `hsl(${([...n].reduce((h, c) => h + c.charCodeAt(0), 0) * 47) % 360} 50% 45%)`;
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Le texte contient-il @pseudo ?
export const mentions = (txt, n) => !!txt && new RegExp('@' + esc(n) + '(?![\\w-])', 'i').test(txt);

// Réduit une image (max px, JPEG)
export const compress = (file, max = 1280, q = 0.75) => new Promise((ok, ko) => {
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

let actx;
export const beep = () => {
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

export const notify = async (title, body) => {
  if (localStorage.getItem('status') === 'dnd') return;   // Ne pas déranger
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
export const saveBlob = async (blob, filename) => {
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
  
