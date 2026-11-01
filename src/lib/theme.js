export const THEMES = {
  sombre: { bg: '#313338', side: '#2b2d31', dark: '#1e1f22', hover: '#404249', input: '#383a40', text: '#dbdee1', muted: '#949ba4', line: '#1f2023' },
  amoled: { bg: '#000000', side: '#0b0b0d', dark: '#000000', hover: '#1f1f24', input: '#16161a', text: '#e6e6e6', muted: '#8a8a93', line: '#1a1a1f' },
  clair:  { bg: '#ffffff', side: '#f2f3f5', dark: '#e3e5e8', hover: '#e3e5e8', input: '#ebedef', text: '#2e3338', muted: '#5c5e66', line: '#d4d7dc' },
  nuit:   { bg: '#1e2233', side: '#181b29', dark: '#12141f', hover: '#2a2f45', input: '#262b40', text: '#d6dbf0', muted: '#8a90ad', line: '#12141f' },
};
export const ACCENTS = ['#5865f2', '#23a55a', '#f23f42', '#f0b232', '#eb459e', '#00a8fc'];

export function applyTheme() {
  const name = localStorage.getItem('theme');
  const t = THEMES[name] || THEMES.sombre;
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(t)) s.setProperty('--' + k, v);
  s.setProperty('--accent', localStorage.getItem('accent') || '#5865f2');
  s.colorScheme = name === 'clair' ? 'light' : 'dark';
  document.body.style.background = t.bg;   // remplace la couleur écrite dans index.html
  document.body.style.color = t.text;
}
