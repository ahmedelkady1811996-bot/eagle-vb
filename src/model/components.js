import * as ops from './ops.js';
import { currentDoc, state, find, findAll } from '../core/store.js';
import { clone } from '../core/util.js';
import { emit } from '../core/bus.js';

/**
 * Project components (masters) + instances.
 * Masters live on state.doc.components (and are synced into every page save via serialize).
 * Instances are normal blocks with props.__componentId pointing at a master.
 */





function uid(prefix) {
  return (prefix || 'c') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function reidTree(block) {
  block.id = uid('b');
  if (Array.isArray(block.children)) {
    for (const c of block.children) reidTree(c);
  }
  return block;
}

export function listComponents() {
  const doc = currentDoc();
  return (doc.components || []).slice();
}

export function getComponent(id) {
  return (currentDoc().components || []).find((c) => c.id === id) || null;
}

export function createFromSelection(block, name) {
  if (!block) return null;
  const doc = currentDoc();
  doc.components = doc.components || [];
  const master = {
    id: uid('cmp'),
    name: name || block.name || block.type || 'Component',
    createdAt: new Date().toISOString(),
    root: clone(block),
  };
  // Strip instance markers from master
  delete master.root.props?.__componentId;
  delete master.root.props?.__instance;
  reidTree(master.root);
  master.root.props = master.root.props || {};
  master.root.props.__isMaster = true;

  ops.setProp; // ensure module link
  doc.components.unshift(master);

  // Convert selection into an instance of the new master
  block.props = block.props || {};
  block.props.__componentId = master.id;
  block.props.__instance = true;
  block.name = master.name;

  emit('doc');
  emit('components');
  return master;
}

export function insertInstance(componentId, parentId) {
  const master = getComponent(componentId);
  if (!master) return null;
  const copy = reidTree(clone(master.root));
  copy.props = copy.props || {};
  copy.props.__componentId = master.id;
  copy.props.__instance = true;
  delete copy.props.__isMaster;
  copy.name = master.name;
  // Use ops.addBlock-like insert via existing flow: push through emit by mutating
  const doc = currentDoc();
  const parent = parentId ? find(doc, parentId) : null;
  if (parent) {
    parent.children = parent.children || [];
    parent.children.push(copy);
  } else {
    doc.children = doc.children || [];
    doc.children.push(copy);
  }
  state.selection = new Set([copy.id]);
  emit('doc');
  emit('selection');
  return copy;
}

/** Push master definition into every instance on all pages. */
export function syncInstances(componentId) {
  const master = getComponent(componentId);
  if (!master) return 0;
  let count = 0;
  const docs = [];
  if (state.pages && state.pages.length) {
    for (const p of state.pages) if (p.doc) docs.push(p.doc);
  }
  docs.push(currentDoc());
  const seen = new Set();
  for (const d of docs) {
    if (seen.has(d)) continue;
    seen.add(d);
    for (const entry of findAll(d)) {
      const b = entry.block;
      if (!b.props || b.props.__componentId !== componentId) continue;
      // Preserve instance id and replace structure from master
      const id = b.id;
      const name = b.name;
      const style = Object.assign({}, master.root.style, b.style || {});
      const next = reidTree(clone(master.root));
      next.id = id;
      next.name = name;
      next.style = style;
      next.props = Object.assign({}, next.props, { __componentId: componentId, __instance: true });
      // Replace fields on existing object so parent refs stay valid
      Object.keys(b).forEach((k) => { if (!(k in next) && k !== 'id') delete b[k]; });
      Object.assign(b, next);
      b.id = id;
      count += 1;
    }
  }
  emit('doc');
  return count;
}

export function detachInstance(block) {
  if (!block || !block.props) return false;
  delete block.props.__componentId;
  delete block.props.__instance;
  emit('doc');
  return true;
}

export function renameComponent(id, name) {
  const c = getComponent(id);
  if (!c) return false;
  c.name = String(name || c.name).trim() || c.name;
  emit('components');
  emit('doc');
  return true;
}

export function deleteComponent(id) {
  const doc = currentDoc();
  doc.components = (doc.components || []).filter((c) => c.id !== id);
  // Detach remaining instances
  for (const entry of findAll(doc)) {
    if (entry.block.props && entry.block.props.__componentId === id) {
      delete entry.block.props.__componentId;
      delete entry.block.props.__instance;
    }
  }
  emit('components');
  emit('doc');
  return true;
}
