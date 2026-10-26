import * as host from './host.js';
import { currentDoc, state, commitDoc, markClean, DOC_VERSION } from '../core/store.js';
import { emit } from '../core/bus.js';
import { all } from '../model/catalog.js';
import { clone, download, slug } from '../core/util.js';

const AUTOSAVE_KEY = 'eagle.autosave';
const AUTOSAVE_META = 'eagle.autosave.meta';
let autosaveTimer = null;

function emptyPageDoc(name) {
  return {
    version: DOC_VERSION,
    name: name || 'Untitled',
    canvas: { width: 1280, background: '#ffffff', mode: 'flow' },
    tokens: null,
    pageJs: '',
    assets: [],
    children: [],
  };
}

/** Sync the live document into state.pages before any export. */
export function ensurePagesSynced() {
  const cur = currentDoc();
  if (!cur) return;
  let page = (state.pages || []).find((p) => p.id === state.pageId);
  if (!page) {
    page = { id: state.pageId || 'page1', name: cur.name || 'Page 1', doc: cur };
    state.pages = state.pages && state.pages.length ? state.pages.slice() : [];
    if (!state.pages.find((p) => p.id === page.id)) state.pages.push(page);
  } else {
    page.doc = cur;
    page.name = cur.name || page.name;
  }
  // Drop null docs
  state.pages = (state.pages || []).map((p) => {
    if (!p.doc) p.doc = p.id === state.pageId ? cur : emptyPageDoc(p.name);
    return p;
  });
}

export function serialize() {
  ensurePagesSynced();
  const doc = currentDoc();
  const pages = (state.pages || []).map((p) => {
    const pageDoc = p.id === state.pageId ? doc : (p.doc || emptyPageDoc(p.name));
    return {
      id: p.id,
      name: p.name || pageDoc.name || 'Page',
      doc: {
        version: DOC_VERSION,
        name: pageDoc.name || p.name || 'Page',
        canvas: clone(pageDoc.canvas || { width: 1280, background: '#ffffff', mode: 'flow' }),
        tokens: clone(pageDoc.tokens),
        pageJs: pageDoc.pageJs || '',
        assets: clone(pageDoc.assets || []),
        projectFiles: clone(pageDoc.projectFiles || []),
        pageHtml: pageDoc.pageHtml || '',
        children: clone(pageDoc.children || []),
        seo: clone(pageDoc.seo || null),
        brand: clone(pageDoc.brand || null),
      },
    };
  });

  // Always include every page — even when only one exists
  return {
    version: DOC_VERSION,
    kind: 'eagle-project',
    name: doc.name || (pages[0] && pages[0].name) || 'Untitled',
    savedAt: new Date().toISOString(),
    pageId: state.pageId,
    // Current page at root for backward compatibility
    canvas: clone(doc.canvas),
    tokens: clone(doc.tokens),
    pageJs: doc.pageJs || '',
    assets: clone(doc.assets || []),
    projectFiles: clone(doc.projectFiles || []),
    pageHtml: doc.pageHtml || '',
    children: clone(doc.children || []),
    seo: clone(doc.seo || null),
    brand: clone(doc.brand || null),
    components: clone(doc.components || []),
    pages: pages,
  };
}

export function deserialize(payload) {
  if (!payload) return null;
  const data = payload.doc || payload;
  if (!Array.isArray(data.children)) {
    if (Array.isArray(payload.blocks)) {
      return {
        version: DOC_VERSION,
        name: payload.name || 'Untitled',
        canvas: Object.assign({ width: 1280, background: '#ffffff', mode: 'flow' }, payload.canvas),
        tokens: null,
        pageJs: '',
        assets: [],
        children: clone(payload.blocks),
      };
    }
    return null;
  }
  return {
    version: data.version || DOC_VERSION,
    name: data.name || 'Untitled',
    canvas: Object.assign({ width: 1280, background: '#ffffff', mode: 'flow' }, data.canvas),
    tokens: data.tokens || null,
    pageJs: data.pageJs || '',
    assets: data.assets || [],
    projectFiles: data.projectFiles || [],
    pageHtml: data.pageHtml || '',
    children: data.children,
    seo: data.seo || null,
    brand: data.brand || null,
  };
}

export function loadPayload(payload) {
  if (!payload) return false;
  // Multi-page project (always prefer pages array when present)
  if (Array.isArray(payload.pages) && payload.pages.length) {
    state.pages = payload.pages.map((p, i) => ({
      id: p.id || ('page' + (i + 1)),
      name: p.name || ('Page ' + (i + 1)),
      doc: deserialize(p.doc || p) || emptyPageDoc(p.name),
    })).filter((p) => p.doc);
    if (!state.pages.length) return false;
    const prefer = payload.pageId && state.pages.find((p) => p.id === payload.pageId);
    const first = prefer || state.pages[0];
    state.pageId = first.id;
    state.doc = first.doc;
    // Project-level components (shared across pages)
    if (Array.isArray(payload.components)) {
      state.doc.components = clone(payload.components);
    }
    state.selection = new Set();
    markClean();
    emit('doc');
    emit('selection');
    emit('view');
    return true;
  }
  const doc = deserialize(payload);
  if (!doc) return false;
  state.pages = [{ id: 'page1', name: doc.name || 'Page 1', doc }];
  state.pageId = 'page1';
  if (Array.isArray(payload.components)) doc.components = clone(payload.components);
  commitDoc(doc);
  state.selection = new Set();
  markClean();
  emit('doc');
  emit('selection');
  emit('view');
  return true;
}

export function fileName(ext) {
  const doc = currentDoc();
  return slug(doc.name || 'project') + (ext || '.eagle.json');
}

export function saveFile() {
  ensurePagesSynced();
  const json = JSON.stringify(serialize(), null, 2);
  return host.saveText(fileName('.eagle.json'), json).then((res) => {
    markClean();
    return res || { ok: true };
  });
}

export function loadFile() {
  return host.openFiles({ filter: 'json', multiple: false, title: 'Open project (.eagle.json)' }).then((res) => {
    const files = res && (res.files || res);
    const file = Array.isArray(files) ? files[0] : files;
    if (!file || file.content == null || file.content === '') return false;
    try {
      const parsed = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;
      return loadPayload(parsed);
    } catch (err) {
      console.error('[loadFile]', err);
      return false;
    }
  });
}

export function saveAutosave() {
  try {
    ensurePagesSynced();
    const payload = serialize();
    const packed = JSON.stringify({ at: Date.now(), payload: payload });
    localStorage.setItem(AUTOSAVE_KEY, packed);
    localStorage.setItem(AUTOSAVE_META, JSON.stringify({
      at: Date.now(),
      pages: (payload.pages || []).length,
      name: payload.name,
    }));
  } catch (e) {
    // Quota exceeded — try stripping heavy data URLs from assets
    try {
      const light = serialize();
      if (light.assets) {
        light.assets = light.assets.map((a) => ({
          id: a.id, name: a.name, kind: a.kind, at: a.at,
          src: (a.src && a.src.length > 200000) ? '' : a.src,
        }));
      }
      for (const p of light.pages || []) {
        if (p.doc && p.doc.assets) {
          p.doc.assets = (p.doc.assets || []).map((a) => ({
            id: a.id, name: a.name, kind: a.kind, at: a.at,
            src: (a.src && a.src.length > 200000) ? '' : a.src,
          }));
        }
      }
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ at: Date.now(), payload: light, trimmed: true }));
    } catch (e2) {
      console.warn('[autosave] storage full', e2);
    }
  }
}

/** Debounced continuous autosave (≈ every 1.5s after edits, plus heartbeat). */
export function startAutosaveLoop() {
  if (autosaveTimer) return;
  autosaveTimer = setInterval(() => {
    try {
      if (state.dirty) saveAutosave();
    } catch (e) { void e; }
  }, 1500);
  // Also save right before the tab closes
  window.addEventListener('beforeunload', () => {
    try { saveAutosave(); } catch (e) { void e; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try { saveAutosave(); } catch (e) { void e; }
    }
  });
}

export function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.payload ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_META);
  } catch (e) {
    void 0;
  }
}

export function downloadJson() {
  ensurePagesSynced();
  download(fileName('.eagle.json'), JSON.stringify(serialize(), null, 2), 'application/json');
}

export function stats() {
  const list = all();
  return { types: list.length };
}

export function switchPage(pageId) {
  if (!pageId || pageId === state.pageId) return false;
  ensurePagesSynced();
  const next = state.pages.find((p) => p.id === pageId);
  if (!next || !next.doc) return false;
  state.pageId = next.id;
  state.doc = next.doc;
  state.selection = new Set();
  markClean();
  emit('doc');
  emit('selection');
  emit('view');
  return true;
}

export function renamePage(pageId, name) {
  ensurePagesSynced();
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return false;
  page.name = String(name || '').trim() || page.name;
  if (page.id === state.pageId) {
    const cur = currentDoc();
    cur.name = page.name;
  }
  emit('doc');
  return true;
}

export function removePage(pageId) {
  ensurePagesSynced();
  if (state.pages.length <= 1) return false;
  const idx = state.pages.findIndex((p) => p.id === pageId);
  if (idx < 0) return false;
  state.pages.splice(idx, 1);
  if (state.pageId === pageId) {
    const fallback = state.pages[Math.max(0, idx - 1)];
    state.pageId = fallback.id;
    state.doc = fallback.doc;
    state.selection = new Set();
  }
  emit('doc');
  emit('selection');
  emit('view');
  return true;
}

void host;
