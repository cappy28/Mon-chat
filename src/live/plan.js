// Résume la structure de l'appli (pour refaire le design sans casser)
export function plan() {
  const root = document.getElementById('root')
  const lines = []
  const cls = el => (typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [])
  const walk = (el, d) => {
    if (d > 6 || lines.length > 80) return
    const kids = [...el.children]
    const c = cls(el).slice(0, 3).join('.')
    if (c || d < 2) lines.push(' '.repeat(d) + el.tagName.toLowerCase() + (c ? '.' + c : '') + (kids.length > 1 ? ' x' + kids.length : ''))
    const seen = new Set()
    for (const k of kids) {
      const key = k.tagName + k.className
      if (seen.has(key)) continue
      seen.add(key)
      walk(k, d + 1)
    }
  }
  if (root) walk(root, 0)
  const all = new Set()
  root?.querySelectorAll('[class]').forEach(e => cls(e).forEach(c => all.add(c)))
  return `PLAN ${innerWidth}px\n${lines.join('\n')}\nCLASSES: ${[...all].join(' ')}`
  }
        
