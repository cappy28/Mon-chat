import { useState } from 'react';
import { esc } from './util.js';

function Spoiler({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={'spoiler' + (open ? ' open' : '')}
      onClick={e => { if (!open) { e.stopPropagation(); setOpen(true); } }}>{children}</span>
  );
}

// Règles, dans l'ordre de priorité
const BASE = [
  ['code', /```(?:[a-z]*\n)?([\s\S]+?)```/],
  ['icode', /`([^`\n]+)`/],
  ['link', /https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/],
  ['spoil', /\|\|([\s\S]+?)\|\|/],
  ['bold', /\*\*([\s\S]+?)\*\*/],
  ['under', /__([\s\S]+?)__/],
  ['strike', /~~([\s\S]+?)~~/],
  ['ital', /\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])/],
];

function parse(txt, rules, me, key) {
  const out = [];
  let rest = txt, i = 0;
  while (rest) {
    let best = null;
    for (const [type, re] of rules) {
      const m = re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { type, m };
    }
    if (!best) { out.push(rest); break; }
    const { type, m } = best;
    if (m.index) out.push(rest.slice(0, m.index));
    const inner = m[1] ?? m[2] ?? m[0];
    const k = key + '-' + i++;
    const sub = () => parse(inner, rules, me, k);
    switch (type) {
      case 'code': out.push(<pre key={k} className="code">{inner}</pre>); break;
      case 'icode': out.push(<code key={k}>{inner}</code>); break;
      case 'link': out.push(<a key={k} href={m[0]} target="_blank" rel="noreferrer"
        onClick={e => e.stopPropagation()}>{m[0]}</a>); break;
      case 'spoil': out.push(<Spoiler key={k}>{sub()}</Spoiler>); break;
      case 'bold': out.push(<b key={k}>{sub()}</b>); break;
      case 'under': out.push(<u key={k}>{sub()}</u>); break;
      case 'strike': out.push(<s key={k}>{sub()}</s>); break;
      case 'ital': out.push(<i key={k}>{sub()}</i>); break;
      case 'ment': out.push(<span key={k} className={'mention' +
        (m[0].slice(1).toLowerCase() === me.toLowerCase() ? ' me' : '')}>{m[0]}</span>); break;
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function renderMd(txt, names = [], me = '') {
  const alt = [...names].sort((a, b) => b.length - a.length).map(esc).join('|');
  const rules = alt ? [...BASE, ['ment', new RegExp(`@(?:${alt})(?![\\w-])`, 'i')]] : BASE;
  return parse(txt, rules, me, 'k');
      }
          
