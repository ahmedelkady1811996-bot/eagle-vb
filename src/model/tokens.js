import { currentDoc } from '../core/store.js';
import { emit } from '../core/bus.js';

/** Design tokens for the project — colors, type, radius, spacing. */



export const DEFAULT_TOKENS = {
  color: {
    primary: '#6366f1',
    secondary: '#0f172a',
    accent: '#22d3ee',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    surface: '#ffffff',
    surface2: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
  },
  font: {
    sans: 'Inter, system-ui, sans-serif',
    display: 'Inter, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  radius: { sm: 6, md: 10, lg: 16, xl: 24, full: 999 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, '2xl': 64 },
  shadow: {
    sm: '0 1px 2px rgba(15,23,42,.06)',
    md: '0 8px 24px -8px rgba(15,23,42,.18)',
    lg: '0 24px 48px -16px rgba(15,23,42,.28)',
  },
};

export function ensureTokens(doc) {
  const d = doc || currentDoc();
  if (!d.tokens || typeof d.tokens !== 'object') {
    d.tokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS));
  } else {
    d.tokens.color = Object.assign({}, DEFAULT_TOKENS.color, d.tokens.color || {});
    d.tokens.font = Object.assign({}, DEFAULT_TOKENS.font, d.tokens.font || {});
    d.tokens.radius = Object.assign({}, DEFAULT_TOKENS.radius, d.tokens.radius || {});
    d.tokens.space = Object.assign({}, DEFAULT_TOKENS.space, d.tokens.space || {});
    d.tokens.shadow = Object.assign({}, DEFAULT_TOKENS.shadow, d.tokens.shadow || {});
  }
  return d.tokens;
}

export function tokensToCss(tokens) {
  const t = tokens || ensureTokens();
  const lines = [];
  const push = (k, v) => { if (v != null && v !== '') lines.push('--' + k + ':' + v); };
  const c = t.color || {};
  Object.keys(c).forEach((k) => push('color-' + k, c[k]));
  const f = t.font || {};
  Object.keys(f).forEach((k) => push('font-' + k, f[k]));
  const r = t.radius || {};
  Object.keys(r).forEach((k) => push('radius-' + k, (typeof r[k] === 'number' ? r[k] + 'px' : r[k])));
  const s = t.space || {};
  Object.keys(s).forEach((k) => push('space-' + k, (typeof s[k] === 'number' ? s[k] + 'px' : s[k])));
  const sh = t.shadow || {};
  Object.keys(sh).forEach((k) => push('shadow-' + k, sh[k]));
  return lines.join(';');
}

export function applyTokensToDom(root) {
  const el = root || document.getElementById('canvas');
  if (!el) return;
  const css = tokensToCss(ensureTokens());
  el.setAttribute('style', ((el.getAttribute('style') || '').replace(/--color-primary:[^;]*;?/g, '') + ';' + css).replace(/^;/, ''));
  // Also set as CSS variables on the element
  const t = ensureTokens();
  const set = (name, val) => { if (val != null) el.style.setProperty(name, String(val)); };
  Object.keys(t.color || {}).forEach((k) => set('--color-' + k, t.color[k]));
  Object.keys(t.font || {}).forEach((k) => set('--font-' + k, t.font[k]));
  Object.keys(t.radius || {}).forEach((k) => {
    const v = t.radius[k];
    set('--radius-' + k, typeof v === 'number' ? v + 'px' : v);
  });
  Object.keys(t.space || {}).forEach((k) => {
    const v = t.space[k];
    set('--space-' + k, typeof v === 'number' ? v + 'px' : v);
  });
  Object.keys(t.shadow || {}).forEach((k) => set('--shadow-' + k, t.shadow[k]));
}

export function setToken(path, value) {
  const t = ensureTokens();
  const [group, key] = String(path).split('.');
  if (!group || !key) return;
  t[group] = t[group] || {};
  t[group][key] = value;
  emit('doc');
  applyTokensToDom();
}
