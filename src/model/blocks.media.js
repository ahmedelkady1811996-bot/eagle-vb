import { def } from './registry.js';
import { Media } from './categories.js';
import { img, svgIcon } from '../render/helpers.js';
import { escapeHtml } from '../core/util.js';

def({
  type: 'image', cat: Media, label: 'Image', icon: 'image', tag: 'figure',
  keywords: 'photo picture img media',
  defaults: {
    props: { src: '', alt: 'Descriptive alt text', caption: '', fit: 'cover', radius: 14 },
    style: { w: '100%', h: 320, overflow: 'hidden', radius: 14 },
  },
  fields: [
    { k: 'src', l: 'Image', t: 'asset', accept: 'image' },
    { k: 'alt', l: 'Alt text', t: 'text' },
    { k: 'caption', l: 'Caption', t: 'text' },
    { k: 'fit', l: 'Fit', t: 'select', opts: ['cover', 'contain', 'fill', 'none'] },
  ],
  render: (p) => img(p.src, p.alt, 'vb-img')
    + (p.caption ? '<figcaption class="vb-caption">' + escapeHtml(p.caption) + '</figcaption>' : ''),
});

def({
  type: 'avatar', cat: Media, label: 'Avatar', icon: 'avatar', tag: 'span',
  keywords: 'profile user person picture',
  defaults: {
    props: { src: '', name: 'Alex Morgan', shape: 'circle', size: 64 },
    style: { display: 'inline-flex', justify: 'center', align: 'center', w: 64, h: 64, radius: 999, bg: '#e2e8f0', color: '#475569', fontWeight: 600, fontSize: 20, overflow: 'hidden', flexShrink: 0 },
  },
  fields: [
    { k: 'src', l: 'Photo', t: 'asset', accept: 'image' },
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'shape', l: 'Shape', t: 'select', opts: ['circle', 'square'] },
  ],
  render: (p) => p.src
    ? img(p.src, p.name, 'vb-avatar-img')
    : escapeHtml((p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')),
});

def({
  type: 'avatarGroup', cat: Media, label: 'Avatar group', icon: 'users', tag: 'div',
  keywords: 'team faces stack people',
  defaults: {
    props: { count: 4, label: '+12' },
    style: { display: 'flex', dir: 'row', align: 'center' },
  },
  fields: [{ k: 'count', l: 'Count', t: 'number' }, { k: 'label', l: 'Overflow label', t: 'text' }],
  render: (p) => {
    const n = Math.max(1, Math.min(12, Number(p.count) || 4));
    const tones = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    let out = '';
    for (let i = 0; i < n; i += 1) {
      out += '<span class="vb-avatar-sm" style="background:' + tones[i % tones.length] + '">' + String.fromCharCode(65 + i) + '</span>';
    }
    if (p.label) out += '<span class="vb-avatar-sm vb-avatar-more">' + escapeHtml(p.label) + '</span>';
    return out;
  },
});

def({
  type: 'icon', cat: Media, label: 'Icon', icon: 'icon', tag: 'span',
  keywords: 'symbol glyph pictogram',
  defaults: {
    props: { name: 'bolt', size: 24, stroke: '#6366f1', width: 2 },
    style: { display: 'inline-flex', justify: 'center', align: 'center' },
  },
  fields: [
    { k: 'name', l: 'Icon', t: 'icon' },
    { k: 'size', l: 'Size', t: 'number' },
    { k: 'stroke', l: 'Color', t: 'color' },
    { k: 'width', l: 'Stroke', t: 'number' },
  ],
  render: (p) => svgIcon(p.name, Number(p.size) || 24).replace('<svg class="vb-ico', '<svg style="color:' + (p.stroke || 'currentColor') + '" class="vb-ico'),
});

def({
  type: 'video', cat: Media, label: 'Video', icon: 'video', tag: 'video', container: false,
  keywords: 'mp4 player media clip',
  defaults: {
    props: { src: '', poster: '', autoplay: false, loop: true, muted: true, controls: true, ratio: '16 / 9' },
    style: { w: '100%', radius: 14, overflow: 'hidden', bg: '#0f172a' },
  },
  fields: [
    { k: 'src', l: 'Video file', t: 'asset', accept: 'video' },
    { k: 'poster', l: 'Poster', t: 'asset', accept: 'image' },
    { k: 'controls', l: 'Controls', t: 'check' },
    { k: 'loop', l: 'Loop', t: 'check' },
    { k: 'muted', l: 'Muted', t: 'check' },
  ],
  render: (p) => '<video' + (p.controls === false ? '' : ' controls')
    + (p.autoplay ? ' autoplay' : '') + (p.loop ? ' loop' : '') + (p.muted ? ' muted' : '')
    + ' playsinline style="display:block;width:100%;aspect-ratio:' + (p.ratio || '16 / 9') + '">'
    + '<source src="' + escapeHtml(p.src || '') + '">'
    + 'Your browser does not support video.</video>',
});

def({
  type: 'youtube', cat: Media, label: 'YouTube', icon: 'youtube', tag: 'div',
  keywords: 'embed iframe video channel',
  defaults: {
    props: { id: 'dQw4w9WgXcQ', ratio: '16 / 9', title: 'YouTube video' },
    style: { w: '100%', radius: 14, overflow: 'hidden' },
  },
  fields: [
    { k: 'id', l: 'Video ID', t: 'text' },
    { k: 'title', l: 'Title', t: 'text' },
  ],
  render: (p) => '<iframe src="https://www.youtube-nocookie.com/embed/' + escapeHtml(p.id || '')
    + '" title="' + escapeHtml(p.title || 'YouTube video') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="display:block;width:100%;aspect-ratio:' + (p.ratio || '16 / 9') + ';border:0"></iframe>',
});

def({
  type: 'audio', cat: Media, label: 'Audio', icon: 'music', tag: 'audio',
  keywords: 'sound player music track',
  defaults: {
    props: { src: '' },
    style: { w: '100%', radius: 12 },
  },
  fields: [{ k: 'src', l: 'Audio file', t: 'asset', accept: 'audio' }],
  render: (p) => '<audio controls src="' + escapeHtml(p.src || '') + '" style="width:100%"></audio>',
});

def({
  type: 'gallery', cat: Media, label: 'Gallery', icon: 'gallery', tag: 'div', container: true,
  keywords: 'grid photos masonry lightbox',
  defaults: {
    props: { name: 'Gallery', count: 6, columns: 3 },
    style: { display: 'grid', cols: 'repeat(3, 1fr)', colGap: 12, rowGap: 12, w: '100%' },
  },
  fields: [
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'count', l: 'Images', t: 'number' },
    { k: 'columns', l: 'Columns', t: 'number' },
  ],
  render: (p) => {
    const n = Math.max(1, Math.min(12, Number(p.count) || 6));
    const tones = ['#c7d2fe', '#bae6fd', '#bbf7d0', '#fde68a', '#fbcfe8', '#e9d5ff'];
    let out = '';
    for (let i = 0; i < n; i += 1) {
      out += '<div class="vb-tile" style="aspect-ratio:1;background:' + tones[i % tones.length] + '"></div>';
    }
    return out;
  },
});

def({
  type: 'logoCloud', cat: Media, label: 'Logo cloud', icon: 'comp', tag: 'div',
  keywords: 'brands trusted by partners clients',
  defaults: {
    props: { names: 'Northwind, Acme, Lumen, Vertex, Kite', tone: '#94a3b8' },
    style: { display: 'flex', dir: 'row', justify: 'center', align: 'center', gap: 40, wrap: true, pT: 20, pB: 20 },
  },
  fields: [
    { k: 'names', l: 'Brands', t: 'csv', item: 'brand', short: 'Brand' },
    { k: 'tone', l: 'Color', t: 'color' },
  ],
  render: (p) => String(p.names || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((n) => '<span class="vb-logo" style="color:' + (p.tone || '#94a3b8') + '">' + escapeHtml(n) + '</span>').join(''),
});


