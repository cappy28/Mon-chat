// Profil Ruche : bio, bannière, jeu en cours, pronoms
export const BANS = {
  miel: 'linear-gradient(135deg,#ffb627,#ff7a1a)',
  menthe: 'linear-gradient(135deg,#2fd690,#1a8f8f)',
  corail: 'linear-gradient(135deg,#ff4d5e,#ff9a3c)',
  nuit: 'linear-gradient(135deg,#3b2a6b,#14111b)',
  ciel: 'linear-gradient(135deg,#4fb3ff,#7b5cff)',
}
const okImg = b => typeof b === 'string' && b.length < 150000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b)
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '')

// Nettoie un profil (le mien ou celui reçu d'un pote)
export function clean(p = {}) {
  const ban = BANS[p.ban] || okImg(p.ban) ? p.ban : 'miel'
  return { bio: str(p.bio, 190), game: str(p.game, 60), pron: str(p.pron, 20), ban }
}

export function myProfile() {
  try { return clean(JSON.parse(localStorage.profil || '{}')) } catch { return clean() }
}

export function saveProfile(p) {
  localStorage.profil = JSON.stringify(clean(p))
}

export const banCss = b => BANS[b] || `center / cover no-repeat url("${b}")`

// Redimensionne une image en bannière 600×200 légère
export async function makeBanner(file) {
  const img = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = 600
  c.height = 200
  const r = Math.max(600 / img.width, 200 / img.height)
  const w = img.width * r
  const h = img.height * r
  c.getContext('2d').drawImage(img, (600 - w) / 2, (200 - h) / 2, w, h)
  return c.toDataURL('image/jpeg', 0.7)
  }
