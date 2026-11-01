// Moteur d'appel : micro, caméra/écran, soundboard (salle Trystero « appel:<id> »)
import { useEffect, useMemo, useRef, useState } from 'react'
import { joinRoom } from 'trystero'
import { CONFIG } from '../lib/util.js'
import { openMic, watchLevel } from './media.js'
import { play, okUrl } from './sounds.js'

const put = (set, k, v) => set(o => {
  const n = { ...o }
  if (v == null) delete n[k]
  else n[k] = v
  return n
})
const fresh = () => ({ muted: false, deaf: false, cam: false, scr: false, ptt: localStorage.ptt === '1', talking: false })

export function useCall(id, me, autoCam) {
  const [peers, setPeers] = useState({}) // id -> { n, av, muted, deaf, cam, scr }
  const [auds, setAuds] = useState({})   // id -> flux audio
  const [vids, setVids] = useState({})   // id -> flux vidéo
  const [talk, setTalk] = useState({})   // id ou 'me' -> parle
  const [st, setSt] = useState(fresh)
  const [vid, setVid] = useState(null)   // ma caméra / mon écran
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')
  const R = useRef({}).current

  const fns = useMemo(() => {
    const share = to => R.sendSt?.({ n: R.me, av: localStorage.avatar || '', ...R.st }, to)
    const change = o => {
      R.st = { ...R.st, ...o }
      const s = R.st
      const on = !s.muted && !s.deaf && (!s.ptt || s.talking)
      R.mic?.stream.getAudioTracks().forEach(t => (t.enabled = on))
      setSt(s)
      share()
    }
    const video = async kind => {
      const room = R.room
      if (!room) return
      const was = R.kind
      if (R.vid) {
        try { room.removeStream(R.vid) } catch {}
        R.vid.getTracks().forEach(t => t.stop())
        R.vid = R.kind = null
      }
      if (kind && kind !== was) {
        try {
          const s = kind === 'cam'
            ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } })
            : await navigator.mediaDevices.getDisplayMedia({ video: true })
          if (R.room !== room) return s.getTracks().forEach(t => t.stop())
          s.getVideoTracks()[0].onended = () => { if (R.vid === s) video(kind) }
          R.vid = s
          R.kind = kind
          room.addStream(s)
        } catch (e) {
          setErr('Vidéo impossible : ' + e.message)
        }
      }
      setVid(R.vid)
      change({ cam: R.kind === 'cam', scr: R.kind === 'scr' })
    }
    return {
      share, change, video,
      toggle: k => change({ [k]: !R.st[k] }),
      ptt: down => { if (R.st?.ptt && R.st.talking !== down) change({ talking: down }) },
      setPtt: on => { localStorage.ptt = on ? '1' : '0'; change({ ptt: on, talking: false }) },
      sound: s => {
        const now = Date.now()
        if (!okUrl(s?.u) || now - (R.lastSb || 0) < 1200) return
        R.lastSb = now
        const d = { u: s.u, n: String(s.n).slice(0, 40), by: R.me }
        if (!R.st.deaf) play(d.u)
        setToast(`🔊 ${d.by} : ${d.n}`)
        R.sendSb?.(d)
      },
    }
  }, [])

  useEffect(() => {
    let dead = false
    R.me = me
    R.st = fresh()
    R.w = {}
    const room = joinRoom(CONFIG, 'appel:' + id)
    const [sendSt, getSt] = room.makeAction('st')
    const [sendSb, getSb] = room.makeAction('sb')
    Object.assign(R, { room, sendSt, sendSb })
    const last = {}

    getSt((d, pid) => {
      if (d && typeof d.n === 'string') put(setPeers, pid, { ...d, n: d.n.slice(0, 40) })
    })
    getSb((d, pid) => {
      const now = Date.now()
      if (!d || !okUrl(d.u) || now - (last[pid] || 0) < 800) return
      last[pid] = now
      if (!R.st.deaf) play(d.u)
      setToast(`🔊 ${String(d.by).slice(0, 30)} : ${String(d.n).slice(0, 40)}`)
    })
    room.onPeerJoin(pid => {
      fns.share(pid)
      if (R.mic) room.addStream(R.mic.stream, pid)
      if (R.vid) room.addStream(R.vid, pid)
    })
    room.onPeerLeave(pid => [setPeers, setAuds, setVids, setTalk].forEach(f => put(f, pid)))
    room.onPeerStream((s, pid) => put(s.getVideoTracks().length ? setVids : setAuds, pid, s))

    openMic()
      .then(mic => {
        if (dead) return mic.stop()
        R.mic = mic
        room.addStream(mic.stream)
        R.unMe = watchLevel(mic.stream, v => put(setTalk, 'me', v || null))
        fns.change({})
        if (autoCam) fns.video('cam')
      })
      .catch(e => setErr('Micro inaccessible : ' + e.message))
    fns.share()

    return () => {
      dead = true
      R.unMe?.()
      Object.values(R.w).forEach(w => w.off())
      R.mic?.stop()
      R.vid?.getTracks().forEach(t => t.stop())
      room.leave()
      for (const k of Object.keys(R)) delete R[k]
    }
  }, [id, me])

  // Détecte qui parle chez les autres
  useEffect(() => {
    const w = R.w
    if (!w) return
    for (const pid in auds) {
      if (w[pid]?.s === auds[pid]) continue
      w[pid]?.off()
      w[pid] = { s: auds[pid], off: watchLevel(auds[pid], v => put(setTalk, pid, v || null)) }
    }
    for (const pid in w) if (!auds[pid]) { w[pid].off(); delete w[pid] }
  }, [auds])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  return { peers, auds, vids, talk, st, vid, toast, err, ...fns }
    }
      
