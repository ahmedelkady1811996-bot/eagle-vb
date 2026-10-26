import * as host from './host.js';
import { currentDoc, state, find, detach, insertAt, begin, commit, markDirty } from '../core/store.js';
import { emit } from '../core/bus.js';
import { clone, download, slug } from '../core/util.js';
import { get as getDef, createBlock, canHaveChildren } from '../model/catalog.js';
import { htmlToBlocks, blocksToHtml, htmlAssets } from './htmlimport.js';

const LIB_KEY = 'vb.library';
const CLIP_KEY = 'vb.clipboard';

export function readLibrary() {
  try {
    return JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function writeLibrary(list) {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(list));
  } catch (e) {
    void 0;
  }
}

export function library() {
  return readLibrary();
}

export function saveToLibrary(blocks, name) {
  const list = readLibrary();
  const entry = {
    id: 'lib' + Date.now().toString(36),
    name: name || ('Block ' + (list.length + 1)),
    type: blocks.length === 1 ? blocks[0].type : 'frame',
    created: new Date().toISOString(),
    blocks: clone(blocks),
  };
  list.unshift(entry);
  writeLibrary(list);
  emit('library');
  return entry;
}

export function deleteFromLibrary(id) {
  writeLibrary(readLibrary().filter((e) => e.id !== id));
  emit('library');
}

export function renameLibraryEntry(id, name) {
  const list = readLibrary();
  const entry = list.find((e) => e.id === id);
  if (entry) {
    entry.name = name;
    writeLibrary(list);
    emit('library');
  }
}

export function instantiate(entryId, doc) {
  const entry = readLibrary().find((e) => e.id === entryId);
  if (!entry) return [];
  const source = clone(entry.blocks);
  reid(source);
  const target = doc || currentDoc();
  const created = [];
  begin('Insert ' + entry.name);
  for (const block of source) {
    insertAt(target, null, block, (target.children || []).length);
    created.push(block.id);
  }
  markDirty();
  commit();
  emit('doc');
  state.selection = new Set(created);
  emit('selection');
  return created;
}

/* ---------- selection export ---------- */

export function selectionPayload(ids) {
  const doc = currentDoc();
  const list = (ids || Array.from(state.selection)).filter((id) => find(doc, id));
  if (!list.length) return null;
  return {
    kind: 'vb-selection',
    version: 2,
    name: list.length === 1 ? (getDef(find(doc, list[0]).type) || {}).label : 'Selection',
    savedAt: new Date().toISOString(),
    blocks: clone(list.map((id) => find(doc, id))),
  };
}

export function exportSelection() {
  const payload = selectionPayload();
  if (!payload) return null;
  const json = JSON.stringify(payload, null, 2);
  const name = slug(payload.name) + '.vbblock.json';
  const saved = host.saveText(name, json);
  if (!saved) download(name, json, 'application/json');
  return name;
}

export function exportSelectionHtml() {
  const payload = selectionPayload();
  if (!payload) return null;
  const doc = currentDoc();
  const html = blocksToHtml(payload.blocks.map((b) => find(doc, b.id) || b), doc);
  const name = slug(payload.name) + '.html';
  const saved = host.saveText(name, html);
  if (!saved) download(name, html, 'text/html');
  return name;
}

/* ---------- clipboard across projects ---------- */

export function copySelection() {
  const payload = selectionPayload();
  if (!payload) return null;
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(payload));
  } catch (e) {
    void 0;
  }
  return payload;
}

export function readClipboard() {
  try {
    const raw = localStorage.getItem(CLIP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function pasteClipboard(targetParentId) {
  const payload = readClipboard();
  if (!payload || !Array.isArray(payload.blocks) || !payload.blocks.length) return [];
  const doc = currentDoc();
  const blocks = clone(payload.blocks);
  reid(blocks);
  const created = [];
  begin('Paste');
  const parent = targetParentId ? find(doc, targetParentId) : null;
  const host_ = parent && canHaveChildren(parent) ? parent : null;
  for (const block of blocks) {
    const list = host_ ? host_.children : doc.children;
    list.push(block);
    created.push(block.id);
  }
  markDirty();
  commit();
  emit('doc');
  state.selection = new Set(created);
  emit('selection');
  return created;
}

/* ---------- file based import ---------- */

const MODEL_EXT = /\.(glb|gltf|obj|stl|fbx|mtl)$/i;

async function importFromFiles(opts) {
  const o = opts || {};
  const result = await host.openFiles({
    filter: o.filter || 'all',
    multiple: o.multiple !== false,
    title: o.title || 'Import',
  });
  let files = (result && (result.files || result)) || [];
  if (!files.length) files = await pickLocalFiles(o);
  return importFiles(files, o.intent);
}

function pickLocalFiles(o) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = o.multiple !== false;
    const filter = o.filter || 'all';
    if (filter === 'html') input.accept = '.html,.htm,text/html';
    else if (filter === 'json') input.accept = '.json,.vbblock.json,application/json';
    let settled = false;
    const finish = (files) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.addEventListener('change', () => {
      const list = Array.from(input.files || []);
      if (!list.length) return finish([]);
      Promise.all(list.map((file) => new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res({ name: file.name, content: String(reader.result || '') });
        reader.onerror = () => res({ name: file.name, content: '' });
        reader.readAsText(file);
      }))).then(finish);
    });
    window.addEventListener('focus', () => setTimeout(() => finish([]), 400), { once: true });
    input.click();
  });
}

async function importFiles(files, intent) {
  const added = [];
  for (const file of files) {
    const name = file.name || file.path || '';
    if (intent === 'html' || /\.html?$/i.test(name)) {
      if (file.content == null) continue;
      const blocks = htmlToBlocks(file.content, { sourceName: name });
      appendBlocks(blocks);
      added.push({ name, count: blocks.length });
    } else if (intent === 'block' || /\.vbblock\.json$/i.test(name)) {
      if (file.content == null) continue;
      try {
        const payload = JSON.parse(file.content);
        const list = payload.blocks || (Array.isArray(payload) ? payload : []);
        appendBlocks(list.map((b) => revive(b)));
        added.push({ name, count: list.length });
      } catch (err) {
        void 0;
      }
    } else if (intent === 'model' || MODEL_EXT.test(name)) {
      continue;
    } else if (/\.json$/i.test(name)) {
      if (file.content == null) continue;
      try {
        const payload = JSON.parse(file.content);
        if (payload && Array.isArray(payload.children)) return importFiles(files, 'project');
        if (payload && Array.isArray(payload.blocks)) {
          appendBlocks(payload.blocks.map((b) => revive(b)));
          added.push({ name, count: payload.blocks.length });
        }
      } catch (err) {
        void 0;
      }
    } else if (file.base64 || /^data:/.test(String(file.content || ''))) {
      continue;
    }
  }
  emit('doc');
  return added;
}

function revive(raw) {
  const block = createBlock(raw.type);
  block.name = raw.name || '';
  Object.assign(block.props, raw.props || {});
  Object.assign(block.style, raw.style || {});
  block.states = raw.states || { hover: {}, focus: {} };
  block.a11y = raw.a11y || null;
  block.locked = !!raw.locked;
  block.children = (raw.children || []).map(revive);
  return block;
}

export function appendBlocks(blocks, parentId) {
  if (!blocks || !blocks.length) return [];
  const doc = currentDoc();
  begin('Import blocks');
  for (const block of blocks) {
    insertAt(doc, parentId || null, block, (doc.children || []).length);
  }
  markDirty();
  commit();
  emit('doc');
  return blocks;
}

export function importHtmlString(html, options) {
  const blocks = htmlToBlocks(html, options || {});
  return appendBlocks(blocks);
}

/** The <head> a page needs to reproduce its own design (styles, fonts, Tailwind). */


export function openProjectFile() {
  return importFromFiles({ filter: 'json', intent: 'auto', title: 'Import project or blocks' });
}

/* ---------- helpers ---------- */

export function reid(node) {
  node.id = 'b' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  for (const child of node.children || []) reid(child);
}

export function detachBlocks(ids) {
  const doc = currentDoc();
  begin('Detach');
  for (const id of ids) detach(doc, id);
  markDirty();
  commit();
  emit('doc');
}

export { importFromFiles, importFiles, htmlAssets };
