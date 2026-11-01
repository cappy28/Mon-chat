import { get, set } from 'idb-keyval';

// Chaque appareil a une paire de clés. Tout ce qu'on envoie est signé :
// personne ne peut se faire passer pour quelqu'un d'autre.
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };
const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// JSON "stable" (clés triées) : les mêmes données donnent toujours la même signature
const canon = (v) =>
  Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object'
    ? '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
        .map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);

let me = null;                 // { pub, priv }
let pins = {};                 // pseudo (minuscules) -> clé publique
const conflicts = new Set();   // pseudos refusés car clé différente
const cache = new Map();

export async function loadIdentity(name) {
  let id = await get('identity');
  if (!id) {
    const kp = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
    id = {
      priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
      pub: toB64(await crypto.subtle.exportKey('raw', kp.publicKey)),
    };
    await set('identity', id);
  }
  me = { pub: id.pub, priv: await crypto.subtle.importKey('jwk', id.priv, ALG, false, ['sign']) };
  pins = (await get('pins')) || {};
  pins[name.toLowerCase()] = me.pub;   // sur mon appareil, mon pseudo = ma clé
  set('pins', pins);
}

export async function sign(obj) {
  const body = { ...obj, pk: me.pub };
  delete body.sig;
  const s = await crypto.subtle.sign(SIG, me.priv, enc.encode(canon(body)));
  return { ...body, sig: toB64(s) };
}

// Signature valide ET clé qui correspond au pseudo ?
export async function verify(obj, who) {
  if (typeof who !== 'string' || typeof obj?.sig !== 'string' || typeof obj.pk !== 'string') return false;
  try {
    let key = cache.get(obj.pk);
    if (!key) {
      key = await crypto.subtle.importKey('raw', fromB64(obj.pk), ALG, false, ['verify']);
      cache.set(obj.pk, key);
    }
    const { sig, ...body } = obj;
    if (!(await crypto.subtle.verify(SIG, key, fromB64(sig), enc.encode(canon(body))))) return false;
  } catch { return false; }
  const k = who.toLowerCase();
  if (!pins[k]) { pins[k] = obj.pk; set('pins', pins); }   // 1re rencontre : on retient sa clé
  if (pins[k] !== obj.pk) { conflicts.add(k); return false; }
  return true;
}

export const getPins = () => Object.keys(pins);
export const getConflicts = () => [...conflicts];
export const forgetPin = (n) => { delete pins[n]; conflicts.delete(n); set('pins', pins); };

// Code pour utiliser le même compte sur un autre appareil (SECRET !)
export const exportId = async (name) =>
  btoa(encodeURIComponent(JSON.stringify({ n: name, ...(await get('identity')) })));

export async function importId(code) {
  const { n, priv, pub } = JSON.parse(decodeURIComponent(atob(code.trim())));
  if (typeof n !== 'string' || typeof pub !== 'string') throw new Error('Code invalide');
  await crypto.subtle.importKey('jwk', priv, ALG, false, ['sign']);   // vérifie la clé
  await set('identity', { priv, pub });
  localStorage.setItem('name', n);
  return n;
             }
    
