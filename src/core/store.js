import { clone, uid } from './util.js';
import { emit } from './bus.js';

export const DOC_VERSION = 2;
export const HISTORY_LIMIT = 120;

function emptyDoc() {
  return {
    version: DOC_VERSION,
    name: 'Untitled',
    canvas: {
      width: 1280,
      background: '#ffffff',
      mode: 'flow',
      gap: 0,
      padX: 0,
      padY: 0,
    },
    children: [],
    tokens: null,
    assets: [],
    pages: [],
    pageJs: '',
  };
}

export const state = {
  doc: emptyDoc(),
  pageId: 'page1',
  pages: [{ id: 'page1', name: 'Page 1', doc: null }],
  selection: new Set(),
  hover: null,
  editing: null,
  clip: null,
  ui: {
    zoom: 1,
    panX: 0,
    panY: 0,
    fitZoom: 1,
    tool: 'select',
    tab: 'design',
    grid: true,
    snap: true,
    gridSize: 8,
    guides: true,
    rulers: true,
    outline: false,
    preview: false,
    /* Render the document the way the browser does (real page in an iframe)
       instead of as native blocks. OFF by default: the native canvas is where
       dragging, resizing, the selection box and flow/free live, and those must
       never be taken away to buy fidelity. The page's own stylesheet is scoped
       to the canvas instead (render/pagecss.js), so the canvas looks right too. */
    liveCanvas: false,
    mode: 'design',
    breakpoint: 'desktop',
    theme: 'dark',
    paletteQuery: '',
    paletteOpen: true,
    rightOpen: true,
    leftOpen: true,
  },
  dirty: false,
  savedAt: 0,
};

let history = [];
let future = [];
let txDepth = 0;
let txSnapshot = null;
let pendingLabel = '';

export function currentDoc() {
  const page = state.pages.find((p) => p.id === state.pageId);
  return page && page.doc ? page.doc : state.doc;
}

export function commitDoc(nextDoc) {
  state.doc = nextDoc;
  const page = state.pages.find((p) => p.id === state.pageId);
  if (page) page.doc = nextDoc;
  state.savedAt = Date.now();
  emit('doc');
}

export function markDirty() {
  if (state.dirty) return;
  state.dirty = true;
  emit('dirty');
}

export function markClean() {
  if (!state.dirty) return;
  state.dirty = false;
  emit('dirty');
}

/* ---------- history ---------- */

function signature() {
  const doc = currentDoc();
  return JSON.stringify([doc.children, doc.canvas, doc.tokens]);
}

function capture() {
  const doc = currentDoc();
  return JSON.stringify({
    doc,
    pageId: state.pageId,
    selection: Array.from(state.selection),
  });
}

function restore(raw) {
  const parsed = JSON.parse(raw);
  const page = state.pages.find((p) => p.id === parsed.pageId);
  if (page) {
    page.doc = parsed.doc;
    state.doc = parsed.doc;
  } else {
    state.doc = parsed.doc;
  }
  state.selection = new Set(parsed.selection.filter(alive));
  markDirty();
  emit('doc');
  emit('selection');
  emit('history');
}

function alive(id) {
  return !!find(currentDoc(), id);
}

function pushHistory(raw, label) {
  history.push({ raw, label: label || 'Edit' });
  if (history.length > HISTORY_LIMIT) history.shift();
  future.length = 0;
  markDirty();
  emit('history');
}

export function begin(label) {
  if (txDepth === 0) txSnapshot = capture();
  txDepth += 1;
  if (label) pendingLabel = label;
}

export function commit() {
  txDepth = Math.max(0, txDepth - 1);
  if (txDepth > 0 || txSnapshot == null) return;
  const next = capture();
  if (next !== txSnapshot) pushHistory(txSnapshot, pendingLabel);
  pendingLabel = '';
  txSnapshot = null;
}

export function cancel() {
  txDepth = 0;
  if (txSnapshot) restore(txSnapshot);
  txSnapshot = null;
}

export function transact(label, fn) {
  begin(label);
  try {
    return fn();
  } finally {
    commit();
  }
}

export function snapshot(label) {
  pushHistory(capture(), label || 'Edit');
}

export function canUndo() {
  return history.length > 0;
}

export function canRedo() {
  return future.length > 0;
}

export function undo() {
  if (!history.length) return false;
  const entry = history.pop();
  future.push({ raw: capture(), label: entry.label });
  restore(entry.raw);
  return true;
}

export function redo() {
  if (!future.length) return false;
  const entry = future.pop();
  history.push({ raw: capture(), label: entry.label });
  restore(entry.raw);
  return true;
}

export function historyState() {
  return { canUndo: canUndo(), canRedo: canRedo() };
}

export function historyDepth() {
  return history.length;
}

/* ---------- tree helpers ---------- */

export function makeBlock(type, props, style) {
  return {
    id: uid('b'),
    type,
    name: '',
    props: props ? clone(props) : {},
    style: style ? clone(style) : {},
    states: { hover: {}, focus: {} },
    children: [],
    locked: false,
    hidden: false,
  };
}

export function walk(node, fn, parent, depth) {
  const level = depth || 0;
  const list = node.children || [];
  for (let i = 0; i < list.length; i += 1) {
    const block = list[i];
    if (fn(block, parent || null, level, i) === false) continue;
    walk(block, fn, block, level + 1);
  }
}

export function find(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  let hit = null;
  walk(root, (b) => {
    if (hit) return false;
    if (b.id === id) {
      hit = b;
      return false;
    }
    return undefined;
  });
  return hit;
}

export function findAll(root) {
  const out = [];
  walk(root, (b, parent, depth) => {
    out.push({ block: b, parent, depth });
  });
  return out;
}

export function parentOf(root, id) {
  if (!root || !id) return null;
  // Top-level blocks live on the document root itself
  const tops = root.children || [];
  for (let i = 0; i < tops.length; i += 1) {
    if (tops[i].id === id) return root;
  }
  let result = null;
  walk(root, (b) => {
    if (result) return false;
    for (const child of b.children || []) {
      if (child.id === id) {
        result = b;
        return false;
      }
    }
    return undefined;
  });
  return result;
}

export function isDescendant(root, ancestorId, id) {
  const node = find(root, ancestorId);
  if (!node) return false;
  let hit = false;
  walk(node, (b) => {
    if (hit) return false;
    if (b.id === id) {
      hit = true;
      return false;
    }
    return undefined;
  });
  return hit;
}

export function ancestors(root, id) {
  const chain = [];
  let cursor = parentOf(root, id);
  while (cursor) {
    chain.unshift(cursor);
    cursor = parentOf(root, cursor.id);
  }
  return chain;
}

export function branchIds(root, id) {
  const node = find(root, id);
  if (!node) return [];
  return [node.id].concat(findAll(node).map((e) => e.block.id));
}

export function detach(root, id) {
  if (!root || !id) return false;
  // Fast path: top-level
  const tops = root.children || [];
  const topIdx = tops.findIndex((b) => b.id === id);
  if (topIdx >= 0) {
    tops.splice(topIdx, 1);
    return true;
  }
  const parent = parentOf(root, id);
  if (!parent || !parent.children) return false;
  const idx = parent.children.findIndex((b) => b.id === id);
  if (idx < 0) return false;
  parent.children.splice(idx, 1);
  return true;
}

export function insertAt(root, parentId, block, index) {
  const list = parentId ? (find(root, parentId) || {}).children : root.children;
  if (!list) return false;
  const at = index == null || index < 0 || index > list.length ? list.length : index;
  list.splice(at, 0, block);
  return true;
}

export function labelOf(block, def) {
  if (block.name) return block.name;
  const text = block.props && (block.props.text || block.props.title || block.props.label);
  if (text) return String(text).slice(0, 28);
  return (def && def.label) || block.type;
}

export function selectionBlocks() {
  const doc = currentDoc();
  return Array.from(state.selection)
    .map((id) => find(doc, id))
    .filter(Boolean);
}

export function primary() {
  const list = selectionBlocks();
  return list[0] || null;
}