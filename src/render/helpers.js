import { escapeHtml } from '../core/util.js';

export function img(src, alt, cls) {
  if (!src) return '<div class="vb-img-ph' + (cls ? ' ' + cls : '') + '"><span>Image</span></div>';
  return '<img class="' + (cls || 'vb-img') + '" src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || '') + '">';
}

export function items(list, render) {
  const arr = Array.isArray(list) ? list : [];
  return arr.map(render).join('');
}

export function rows(list, render) {
  const arr = Array.isArray(list) ? list : [];
  return arr.map(render).join('');
}

export function splitLines(text) {
  return String(text == null ? '' : text).split(/\r?\n/);
}

export function paragraphs(text, cls) {
  return splitLines(text)
    .filter((l) => l.trim() !== '')
    .map((l) => '<p class="' + (cls || '') + '">' + escapeHtml(l) + '</p>')
    .join('');
}

export function slot(childrenHtml) {
  return '<div class="vb-slot" data-slot="1">' + (childrenHtml || '') + '</div>';
}

export function badge(text, tone) {
  const t = tone || 'neutral';
  return '<span class="vb-badge vb-badge--' + t + '">' + escapeHtml(text) + '</span>';
}

export function svgIcon(name, size, cls) {
  const paths = {
    star: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    heart: '<path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1L12 21.5l8.8-8.8a5 5 0 000-7.1z"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 013 5.2 2 2 0 015 3h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.9 10.9a16 16 0 006.2 6.2l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.7C7.4 20.4 4 17 4 12V6z"/><path d="M9 12l2 2 4-4"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    chat: '<path d="M21 12a8 8 0 01-8 8H7l-4 3 1-5a8 8 0 1117-6z"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>',
  };
  const body = paths[name] || paths.spark;
  return '<svg class="vb-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
}