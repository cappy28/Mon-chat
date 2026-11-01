// Chef d'orchestre : présence, sonnerie, appels (monté à côté de l'appli)
import { useEffect, useRef, useState } from 'react'
import { useLive } from './useLive.js'
import { notif } from './media.js'
import Dock from './Dock.jsx'
import Ring from './Ring.jsx'
import Stage from './Stage.jsx'
import './live.css'
import './live2.css'

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export default function Live() {
  const [me, setMe] = useState(localStorage.name || '')
  const [call, setCall] = useState(null)
  const [inc, setInc] = useState(null)
  const [min, setMin] = useState(false)
  const [info, setInfo] = useState('')
  const { people, api } = useLive(me)
  const S = useRef({})
  const gone = useRef(new Set()) // appels déjà refusés / manqués
  S.current = { me, call, inc }
  const send = d => api.current.sendRing?.(d)

  // Suit la connexion / le changement de pseudo
  useEffect(() => {
    const t = setInterval(() => setMe(localStorage.name || ''), 2000)
    return () => clearInterval(t)
  }, [])

  const hang = () => {
    const { call } = S.current
    if (call) send({ t: 'cancel', id: call.id })
    setCall(null)
    setMin(false)
  }

  useEffect(() => {
    api.current.onRing = d => {
      const { me, call, inc } = S.current
      if (!d || typeof d.id !== 'string' || gone.current.has(d.id)) return
      if (d.t === 'call' && Array.isArray(d.to) && d.to.includes(me) && d.from !== me) {
        if (call?.id === d.id || inc?.id === d.id) return
        if (call) return send({ t: 'no', id: d.id, from: me, busy: true })
        setInc({ id: d.id, from: String(d.from).slice(0, 40), to: d.to.map(String).slice(0, 8), video: !!d.video })
        notif('📞 ' + d.from, d.video ? 'Appel vidéo entrant' : 'Appel entrant')
      }
      if (d.t === 'cancel' && inc?.id === d.id) {
        gone.current.add(d.id)
        setInc(null)
        setInfo(`Appel manqué de ${inc.from}`)
      }
      if (d.t === 'no' && call?.id === d.id) {
        setCall(c => c && { ...c, ringTo: c.ringTo.filter(n => n !== d.from) })
        setInfo(`${String(d.from).slice(0, 40)} ${d.busy ? 'est déjà en appel' : 'a refusé'}`)
      }
      if (d.t === 'ok' && call?.id === d.id) joined()
    }
  })

  // Côté appelant : relance la sonnerie, abandonne après 35 s
  useEffect(() => {
    if (!call || call.answered) return
    if (!call.ringTo.length) { const t = setTimeout(hang, 1500); return () => clearTimeout(t) }
    const ring = () => send({ t: 'call', id: call.id, from: me, to: call.ringTo, video: call.video })
    const iv = setInterval(ring, 4000)
    const to = setTimeout(() => { setInfo('Pas de réponse'); hang() }, 35000)
    return () => { clearInterval(iv); clearTimeout(to) }
  }, [call?.id, call?.answered, call?.ringTo.length])

  // Côté appelé : appel manqué au bout de 40 s
  useEffect(() => {
    if (!inc) return
    const t = setTimeout(() => { gone.current.add(inc.id); setInc(null); setInfo(`Appel manqué de ${inc.from}`) }, 40000)
    return () => clearTimeout(t)
  }, [inc?.id])

  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(''), 3500)
    return () => clearTimeout(t)
  }, [info])

  const start = (names, video) => {
    const id = rid()
    setCall({ id, with: names, ringTo: names, video, cam: video, answered: false, since: Date.now() })
    send({ t: 'call', id, from: me, to: names, video })
  }
  const joined = () => setCall(c => c && (c.answered ? c : { ...c, answered: true, since: Date.now() }))
  const accept = cam => {
    gone.current.add(inc.id)
    send({ t: 'ok', id: inc.id, from: me })
    setCall({ id: inc.id, with: [inc.from, ...inc.to.filter(n => n !== me)], ringTo: [],
      video: inc.video, cam, answered: true, since: Date.now() })
    setInc(null)
  }
  const refuse = () => { gone.current.add(inc.id); send({ t: 'no', id: inc.id, from: me }); setInc(null) }
  const add = name => {
    send({ t: 'call', id: call.id, from: me, to: [name], video: call.video })
    setCall(c => ({ ...c, with: [...new Set([...c.with, name])] }))
  }

  if (!me) return null
  const avOf = n => Object.values(people).find(p => p.n === n)?.av
  return (
    <>
      {!call && <Dock me={me} people={people} onCall={start} />}
      {call && <Stage key={call.id} call={call} me={me} min={min} setMin={setMin}
        onHang={hang} onAdd={add} onJoin={joined} people={people} />}
      {inc && !call && <Ring inc={inc} av={avOf(inc.from)} onOk={accept} onNo={refuse} />}
      {info && <div className="lv-info">{info}</div>}
    </>
  )
         }
    
