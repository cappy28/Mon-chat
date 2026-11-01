// Micro (+ anti-bruit), niveau de voix, sonneries, notifications
import { Capacitor } from '@capacitor/core'

let ctx
export function actx() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export async function openMic() {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const stopRaw = () => raw.getTracks().forEach(t => t.stop())
  if (localStorage.ns !== '1') return { stream: raw, stop: stopRaw }
  try {
    const { antiBruit } = await import('./antibruit.js')
    const nb = await antiBruit(actx(), raw)
    return { stream: nb.stream, stop: () => { nb.stop(); stopRaw() } }
  } catch (e) {
    console.warn('Anti-bruit indisponible :', e)
    return { stream: raw, stop: stopRaw }
  }
}

// Appelle cb(true/false) quand quelqu'un se met à parler / s'arrête
export function watchLevel(stream, cb) {
  try {
    const c = actx()
    const src = c.createMediaStreamSource(stream)
    const an = c.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    const buf = new Uint8Array(an.fftSize)
    let last = false
    let quiet = 0
    const iv = setInterval(() => {
      an.getByteTimeDomainData(buf)
      let s = 0
      for (const v of buf) s += (v - 128) ** 2
      const loud = Math.sqrt(s / buf.length) > 5
      quiet = loud ? 0 : quiet + 1
      const now = loud || (last && quiet < 3)
      if (now !== last) cb((last = now))
    }, 120)
    return () => { clearInterval(iv); src.disconnect() }
  } catch {
    return () => {}
  }
}

// Sonneries synthétisées (100 % originales, aucun droit d'auteur)
let ringIv = null
function bip(freqs, gap) {
  const c = actx()
  const t = c.currentTime
  freqs.forEach((f, i) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t + i * gap)
    g.gain.exponentialRampToValueAtTime(0.2, t + i * gap + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * gap + gap * 0.9)
    o.connect(g).connect(c.destination)
    o.start(t + i * gap)
    o.stop(t + i * gap + gap)
  })
}

// out = false : appel entrant ; out = true : « tuuut » côté appelant
export function ringStart(out) {
  if (ringIv || (!out && localStorage.status === 'dnd')) return
  const play = () => {
    try { out ? bip([425], 1) : bip([880, 660, 880, 660], 0.18) } catch {}
    if (!out) navigator.vibrate?.([250, 120, 250])
  }
  play()
  ringIv = setInterval(play, out ? 3000 : 1600)
}

export function ringStop() {
  clearInterval(ringIv)
  ringIv = null
  navigator.vibrate?.(0)
}

export async function notif(title, body) {
  if (localStorage.status === 'dnd') return
  try {
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 2e9, title, body }] })
    } else if (window.Notification?.permission === 'granted' && document.hidden) {
      new Notification(title, { body })
    }
  } catch {}
}
