import * as registry from './registry.js';
import { makeBlock, currentDoc } from '../core/store.js';
import { clone } from '../core/util.js';
import './blocks.core.js';
import './blocks.media.js';
import './blocks.forms.js';
import './blocks.cards.js';
import './blocks.nav.js';
import './blocks.data.js';
import './blocks.sections.js';
import './blocks.three.js';
import './blocks.frameworks.js';

export const get = registry.get;
export const search = registry.search;
export const byCategory = registry.byCategory;
export const categories = () => registry.CATEGORIES.slice();
export const list = () => registry.all();
export const all = () => registry.all();
export const count = () => registry.all().length;

export function createBlock(type, overrides) {
  const definition = registry.get(type);
  const base = definition
    ? { props: clone(definition.defaults.props || {}), style: clone(definition.defaults.style || {}) }
    : { props: {}, style: { display: 'flex', dir: 'column', gap: 12 } };
  const block = makeBlock(type, base.props, base.style);
  if (definition && definition.states) block.states = clone(definition.states);
  // Real nested children so each piece can be selected & styled alone
  if (definition && definition.defaults && Array.isArray(definition.defaults.children)) {
    block.children = definition.defaults.children.map((child) => {
      if (!child || !child.type) return null;
      const made = createBlock(child.type, {
        props: child.props ? clone(child.props) : undefined,
        style: child.style ? clone(child.style) : undefined,
        name: child.name || '',
      });
      if (child.props) Object.assign(made.props, clone(child.props));
      if (child.style) Object.assign(made.style, clone(child.style));
      if (child.name) made.name = child.name;
      if (Array.isArray(child.children) && child.children.length) {
        made.children = child.children.map((gc) => createBlock(gc.type, {
          props: gc.props, style: gc.style, name: gc.name,
        }));
      }
      return made;
    }).filter(Boolean);
  }
  if (overrides) {
    const kids = overrides.children;
    Object.assign(block, overrides);
    if (kids) block.children = kids;
  }
  return block;
}

export function defaultsOf(type) {
  const definition = registry.get(type);
  return definition ? clone(definition.defaults) : { props: {}, style: {} };
}

export function isContainer(type) {
  const definition = registry.get(type);
  return !!(definition && definition.container);
}

export function canHaveChildren(block) {
  if (!block) return false;
  const definition = registry.get(block.type);
  if (!definition) return true;
  return !!definition.container;
}

export function semanticTag(block) {
  const definition = registry.get(block.type);
  if (!definition) return 'div';
  const requested = block.props && block.props.tag;
  /* A framework block IS a custom element: <my-counter>. The tag comes from
     the block's own props so the author can rename it, and the framework host
     registers exactly this name. */
  if (definition.customTag) {
    const tag = String((block.props && block.props.tagName) || '').trim();
    return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag) ? tag : (definition.tag || 'div');
  }
  if (definition.tag === 'h1' && requested && /^h[1-6]$/.test(requested)) return requested;
  if ((definition.tag === 'h2' || definition.tag === 'h3') && requested && /^h[1-6]$/.test(requested)) return requested;
  return definition.tag;
}

export function findFreeSlot(doc, size) {
  const canvas = doc.canvas || {};
  const width = canvas.width || 1280;
  const gap = 24;
  const pad = 40;
  const occupied = [];
  for (const node of doc.children || []) {
    const s = node.style || {};
    if (s.pos !== 'absolute') continue;
    occupied.push({ x: Number(s.x) || 0, y: Number(s.y) || 0, w: Number(s.w) || 200, h: Number(s.h) || 120 });
  }
  for (let y = pad; y < 4000; y += gap + (size.h || 120)) {
    for (let x = pad; x < width - pad; x += gap + (size.w || 200)) {
      const hit = occupied.some((o) => !(x + (size.w || 200) <= o.x || x >= o.x + o.w || y + (size.h || 120) <= o.y || y >= o.y + o.h));
      if (!hit) return { x, y };
    }
  }
  return { x: pad, y: pad + occupied.length * 24 };
}

export function documentBlocks(doc) {
  return doc && Array.isArray(doc.children) ? doc.children : (currentDoc() || {}).children || [];
}