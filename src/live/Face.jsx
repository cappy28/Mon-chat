// Avatar « carré arrondi » + logo de l'appli
const hue = s => [...(s || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17)

export function Face({ name, av, st, big }) {
  return (
    <span className={'lv-face' + (big ? ' big' : '')} style={{ background: `hsl(${hue(name)} 60% 42%)` }}>
      {av ? <img src={av} alt="" /> : [...(name || '?')][0].toUpperCase()}
      {st && <i className={'lv-st ' + st} />}
    </span>
  )
}

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 28 9v14l-12 7L4 23V9z" fill="#ffb627" />
      <path d="M10 13h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-6l-4 3v-3h-2a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" fill="#14111b" />
      <circle cx="12.5" cy="17.5" r="1.3" fill="#ffb627" />
      <circle cx="16" cy="17.5" r="1.3" fill="#ffb627" />
      <circle cx="19.5" cy="17.5" r="1.3" fill="#ffb627" />
    </svg>
  )
}
