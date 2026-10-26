import * as components from '../model/components.js';
import * as ops from '../model/ops.js';
import { h, clear, $, icon } from '../core/dom.js';
import { state, currentDoc } from '../core/store.js';
import { emit } from '../core/bus.js';
import { categories, byCategory, search, all } from '../model/catalog.js';
import { clientToCanvas } from '../layout/coords.js';
import { canvas as canvasEl } from '../render/canvas.js';

const FAV_KEY = 'vb.favs';
const REC_KEY = 'vb.recents';

export let favs = [];
let recents = [];
let mode = 'blocks';

function load() {
  try {
    favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    recents = JSON.parse(localStorage.getItem(REC_KEY) || '[]');
  } catch (e) {
    favs = [];
    recents = [];
  }
}

function save() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    localStorage.setItem(REC_KEY, JSON.stringify(recents.slice(0, 24)));
  } catch (e) {
    void 0;
  }
}

export function isFav(type) {
  return favs.indexOf(type) >= 0;
}

function toggleFav(type) {
  favs = isFav(type) ? favs.filter((t) => t !== type) : favs.concat([type]);
  save();
  render();
}

function pushRecent(type) {
  recents = [type].concat(recents.filter((t) => t !== type));
  save();
}

const ICON_MAP = {
  frame: 'container', section: 'section', stack: 'row', grid: 'grid', columns: 'col', spacer: 'rectangle',
  divider: 'divider', heading: 'heading', subheading: 'subheading', paragraph: 'paragraph',
  label: 'label', quote: 'quote', code: 'code-block', list: 'list',
  button: 'button', link: 'link', iconButton: 'iconbutton', buttonGroup: 'layers', chip: 'badge',
  image: 'image', avatar: 'avatar', avatarGroup: 'users', icon: 'icon', video: 'video',
  youtube: 'youtube', audio: 'audio', gallery: 'gallery', logoCloud: 'comp',
  input: 'input', textarea: 'textarea', select: 'select', checkbox: 'checkbox', radio: 'radio',
  switch: 'toggle', form: 'form', searchBar: 'search',
  card: 'card', featureCard: 'feature', statCard: 'stat', testimonialCard: 'testimonial',
  pricingCard: 'pricing', productCard: 'box', teamCard: 'users', faqItem: 'question',
  timelineItem: 'timeline', alert: 'alert', progress: 'progress', counter: 'analyze', rating: 'star',
  navbar: 'navbar', footer: 'footer', breadcrumb: 'right', tabs: 'tabs', accordion: 'accordion',
  pagination: 'pages', stepper: 'check', sidebar: 'layers', table: 'table',
  menu: 'navbar', nav: 'navbar', header: 'navbar',
  chart: 'chart', htmlEmbed: 'code', donut: 'chart', sparkline: 'chart', avatarRow: 'users', map: 'map',
  clock: 'clock', countdown: 'clock', qr: 'qr',
  hero: 'hero', features: 'feature', ctaBanner: 'feature', statsRow: 'stat',
  logoCloudSection: 'comp', testimonialsSection: 'testimonial', pricingSection: 'pricing',
  faqSection: 'question', gallerySection: 'gallery', contactSection: 'contact',
  timelineSection: 'timeline', teamSection: 'users', newsletterSection: 'contact', sectionSpacer: 'divider',
  model3d: 'model3d', three_scene: 'scene3d',
  three_box: 'cube3d', three_sphere: 'blob', three_torus: 'ellipse', three_torusKnot: 'puzzle',
  three_cylinder: 'cube', three_cone: 'triangle', three_capsule: 'rectangle',
  three_icosahedron: 'shapes', three_ring: 'ellipse',
  container: 'container', group: 'group', html: 'code', embed: 'iframe',
  // Frameworks
  react: 'react', vue: 'vue', svelte: 'svelte', vanilla: 'vanilla',
  framework: 'cube', frameworkCreator: 'plus',
};

export function iconFor(type, def) {
  // Prefer the curated map (always points at real IMAGES/*.svg files).
  if (type && ICON_MAP[type]) return ICON_MAP[type] + '.svg';
  // Then explicit def.icon if it matches a known map key or common alias
  if (def && def.icon) {
    const name = String(def.icon).replace(/\.svg$/i, '');
    if (ICON_MAP[name]) return ICON_MAP[name] + '.svg';
    // only use raw name when it is a safe simple token — browser will 404 otherwise but we prefer map
    if (/^[a-z0-9_-]+$/i.test(name)) return name + '.svg';
  }
  if (type && type.indexOf('three_') === 0) return 'cube3d.svg';
  if (type && /^[a-z0-9_-]+$/i.test(type)) return type + '.svg';
  return 'shapes.svg';
}

function makeItem(def) {
  const thumb = h('span', { class: 'pitem__thumb' }, icon(iconFor(def.type, def)));
  const el = h('button', {
    class: 'pitem',
    type: 'button',
    title: def.label + '  ·  right-click to favourite',
    'data-type': def.type,
  }, [thumb, h('span', { class: 'pitem__label' }, def.label)]);

  el.addEventListener('click', () => {
    pushRecent(def.type);
    emit('palette:add', def.type);
  });

  el.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    toggleFav(def.type);
  });

  el.draggable = true;
  el.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/vb-type', def.type);
    ev.dataTransfer.effectAllowed = 'copy';
  });

  return el;
}

function section(host, title, list) {
  if (!list.length) return;
  host.appendChild(h('div', { class: 'cat' }, title));
  const grid = h('div', { class: 'pgrid' });
  for (const def of list) grid.appendChild(makeItem(def));
  host.appendChild(grid);
}

function renderList(host) {
  const query = state.ui.paletteQuery;

  if (query.trim()) {
    const hits = search(query);
    if (!hits || !hits.length) {
      host.appendChild(h('div', { class: 'pal-empty' }, 'No blocks match "' + query + '"'));
      return;
    }
    section(host, hits.length + ' result' + (hits.length === 1 ? '' : 's'), hits);
    return;
  }

  const catMap = byCategory();
  const ordered = categories().map((c) => ({ name: c.name, defs: catMap.get(c.name) || [] }))
    .filter((c) => c.defs.length);

  const favDefs = favs.map((t) => all().find((d) => d.type === t)).filter(Boolean);
  if (favDefs.length) section(host, 'Favourites', favDefs);

  const recentDefs = recents.map((t) => all().find((d) => d.type === t)).filter(Boolean);
  if (recentDefs.length) section(host, 'Recent', recentDefs);

  for (const c of ordered) section(host, c.name, c.defs);
}

function buildHead() {
  const input = h('input', {
    type: 'search',
    placeholder: 'Search 120+ blocks…',
    value: state.ui.paletteQuery,
    spellcheck: 'false',
  });
  input.addEventListener('input', () => {
    state.ui.paletteQuery = input.value;
    render();
    const again = document.querySelector('#palette input');
    if (again) {
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    }
  });

  const seg = h('div', { class: 'seg' }, [
    h('button', { type: 'button', class: mode === 'blocks' ? 'is-on' : '' }, 'Blocks'),
    h('button', { type: 'button', class: mode === 'sections' ? 'is-on' : '' }, 'Sections'),
  ]);
  seg.children[0].addEventListener('click', () => {
    mode = 'blocks';
    render();
  });
  seg.children[1].addEventListener('click', () => {
    mode = 'sections';
    render();
  });

  return h('div', { class: 'pal-head' }, [h('div', { class: 'search' }, icon('search', 15), input), seg]);
}

const SECTION_ONLY = new Set(['hero', 'features', 'ctaBanner', 'statsRow', 'logoCloudSection', 'testimonialsSection', 'pricingSection', 'faqSection', 'gallerySection', 'contactSection', 'timelineSection', 'teamSection', 'newsletterSection', 'navbar', 'footer']);

export function render() {
  const host = $('palette');
  if (!host) return;
  clear(host);
  host.appendChild(buildHead());

  const body = h('div', { class: 'pal-body' });
  if (mode === 'sections') {
    const catMap = byCategory();
    const sectionDefs = (catMap.get('Sections') || []).concat(catMap.get('Navigation') || []);
    if (state.ui.paletteQuery.trim()) renderList(body);
    else section(body, 'Page sections', sectionDefs);
  } else {
    renderList(body);
  }
  host.appendChild(body);
  void SECTION_ONLY;
}

export function installDropTarget() {
  const canvas = canvasEl();
  if (!canvas) return;

  canvas.addEventListener('dragover', (ev) => {
    if (!Array.from(ev.dataTransfer.types || []).includes('text/vb-type')) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    canvas.style.outline = '2px dashed var(--accent)';
    canvas.style.outlineOffset = '-6px';
  });

  canvas.addEventListener('dragleave', (ev) => {
    if (ev.target === canvas) canvas.style.outline = '';
  });

  canvas.addEventListener('drop', (ev) => {
    const type = ev.dataTransfer.getData('text/vb-type');
    if (!type) return;
    ev.preventDefault();
    canvas.style.outline = '';
    const p = clientToCanvas(ev.clientX, ev.clientY);
    const target = ev.target instanceof Element ? ev.target.closest('.vb-b') : null;
    const free = currentDoc().canvas && currentDoc().canvas.mode === 'free';
    ops.addBlock(type, {
      at: free ? { x: p.x - 90, y: p.y - 40 } : null,
      parentId: !free && target ? target.dataset.id : null,
    });
    pushRecent(type);
  });
}

export function init() {
  load();
  render();
  installDropTarget();
}

