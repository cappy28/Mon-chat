// Présence + profils + sonnerie des appels (salle Trystero « live »)
import { useEffect, useRef, useState } from 'react'
import { joinRoom } from 'trystero'
import { CONFIG } from '../lib/util.js'
import { myProfile, clean } from './profile.js'

export function useLive(me) {
  const [people, setPeople] = useState({}) // id réseau -> { n, av, st, bio, game, pron, ban }
  const api = useRef({})

  useEffect(() => {
    if (!me) return
    const room = joinRoom(CONFIG, 'live')
    const [sendHere, getHere] = room.makeAction('here')
    const [sendRing, getRing] = room.makeAction('ring')
    const mine = () => ({ n: me, av: localStorage.avatar || '', st: localStorage.status || 'on', ...myProfile() })
    let last = JSON.stringify(mine())

    sendHere(mine())
    room.onPeerJoin(id => sendHere(mine(), id))
    room.onPeerLeave(id => setPeople(p => { const q = { ...p }; delete q[id]; return q }))
    getHere((d, id) => {
      if (!d || typeof d.n !== 'string') return
      const av = typeof d.av === 'string' && d.av.startsWith('data:image/') && d.av.length < 400000 ? d.av : ''
      const st = ['on', 'idle', 'dnd'].includes(d.st) ? d.st : 'on'
      setPeople(p => ({ ...p, [id]: { n: d.n.slice(0, 40), av, st, ...clean(d) } }))
    })
    getRing((d, id) => api.current.onRing?.(d, id))
    api.current.sendRing = d => sendRing(d)

    // Photo, statut ou profil modifié : les autres sont prévenus
    const t = setInterval(() => {
      const now = JSON.stringify(mine())
      if (now !== last) { last = now; sendHere(mine()) }
    }, 3000)

    return () => {
      clearInterval(t)
      api.current.sendRing = null
      room.leave()
      setPeople({})
    }
  }, [me])

  return { people, api }
                          }
