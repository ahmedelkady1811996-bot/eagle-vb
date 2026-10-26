import * as project from '../io/project.js';
import { on } from '../core/bus.js';
import { currentDoc, commitDoc, state } from '../core/store.js';

/*
 * WORKSPACE  (single user, local first)
 * =====================================
 * The collaborative-editing surface, used the way one person actually works:
 *
 *  - Every change is autosaved to THIS browser, so a crash or a closed tab
 *    never costs work.
 *  - Named snapshots are kept side by side, and any of them can be restored.
 *  - An activity log records what happened and when.
 *  - The same document can still be shared with others (the BroadcastChannel
 *    and WebRTC paths in studio.js), but nothing here requires a second
 *    person: a single user gets the safety net on their own.
 *
 * Everything lives in localStorage. There is no server, no account and no
 * network round trip.
 */





const KEY_AUTOSAVE = 'vb.workspace.autosave';
const KEY_DRAFT = 'vb.workspace.draft';
const KEY_SNAPSHOTS = 'vb.workspace.snapshots';
const KEY_ACTIVITY = 'vb.workspace.activity';

const AUTOSAVE_MS = 1200;
const MAX_SNAPSHOTS = 40;
const MAX_ACTIVITY = 200;

let timer = null;
let started = false;
let saving = false;

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    /* Quota exceeded — the draft is best-effort, never fatal. */
    console.warn('[workspace] could not write ' + key, e);
    return false;
  }
}

function docJson() {
  try {
    return project.serialize();
  } catch (e) {
    return JSON.parse(JSON.stringify(currentDoc()));
  }
}

/* ------------------------------------------------------------------ */
/* Autosave                                                            */
/* ------------------------------------------------------------------ */

export function autosaveOn() {
  return localStorage.getItem(KEY_AUTOSAVE) !== '0';
}

export function setAutosave(on_) {
  localStorage.setItem(KEY_AUTOSAVE, on_ ? '1' : '0');
  if (on_) save();
}

export function save() {
  if (saving) return false;
  saving = true;
  try {
    const ok = writeJson(KEY_DRAFT, { at: Date.now(), doc: docJson() });
    if (ok) bumpSaves();
    return ok;
  } finally {
    saving = false;
  }
}

let saves = 0;

function bumpSaves() {
  const meta = readJson('vb.workspace.meta', {});
  meta.saves = (meta.saves || 0) + 1;
  meta.lastSave = Date.now();
  writeJson('vb.workspace.meta', meta);
  saves = meta.saves;
}

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

export function log(text) {
  const entries = readJson(KEY_ACTIVITY, []);
  entries.unshift({ at: Date.now(), text: String(text || '').slice(0, 240) });
  while (entries.length > MAX_ACTIVITY) entries.pop();
  writeJson(KEY_ACTIVITY, entries);
  return entries;
}

export function activity(limit) {
  const entries = readJson(KEY_ACTIVITY, []);
  return typeof limit === 'number' ? entries.slice(0, limit) : entries;
}

export function clearActivity() {
  writeJson(KEY_ACTIVITY, []);
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

export function snapshots() {
  return readJson(KEY_SNAPSHOTS, []);
}

export function snapshot(name) {
  const list = snapshots();
  const entry = {
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name || 'Snapshot').slice(0, 60),
    at: Date.now(),
    doc: docJson(),
  };
  list.unshift(entry);
  while (list.length > MAX_SNAPSHOTS) list.pop();
  writeJson(KEY_SNAPSHOTS, list);
  log('Snapshot "' + entry.name + '" created');
  return entry;
}

export function removeSnapshot(id) {
  const list = snapshots().filter((s) => s.id !== id);
  writeJson(KEY_SNAPSHOTS, list);
  log('Snapshot removed');
  return list;
}

export function restore(id) {
  const entry = snapshots().find((s) => s.id === id);
  if (!entry) return false;
  try {
    const payload = entry.doc;
    if (payload && Array.isArray(payload.pages) && payload.pages.length) {
      project.loadPayload(payload);
    } else if (payload && Array.isArray(payload.children)) {
      commitDoc(payload);
    } else {
      return false;
    }
    log('Restored snapshot "' + entry.name + '"');
    save();
    return true;
  } catch (e) {
    console.warn('[workspace] restore failed', e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Draft (the autosaved copy)                                          */
/* ------------------------------------------------------------------ */

export function hasDraft() {
  const d = readJson(KEY_DRAFT, null);
  return !!(d && d.doc);
}

export function draftInfo() {
  const d = readJson(KEY_DRAFT, null);
  if (!d || !d.doc) return null;
  return { at: d.at, pages: (d.doc.pages || []).length };
}

/** Restore the autosaved draft. Returns false when there is none. */
export function restoreDraft() {
  const d = readJson(KEY_DRAFT, null);
  if (!d || !d.doc) return false;
  try {
    if (Array.isArray(d.doc.pages) && d.doc.pages.length) project.loadPayload(d.doc);
    else commitDoc(d.doc);
    log('Restored the autosaved draft');
    return true;
  } catch (e) {
    console.warn('[workspace] draft restore failed', e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export function status() {
  const meta = readJson('vb.workspace.meta', {});
  const list = snapshots();
  const bytes = (() => {
    try {
      return Math.round((localStorage.getItem(KEY_DRAFT) || '').length / 1024) + ' KB';
    } catch (e) {
      return '—';
    }
  })();
  const last = meta.lastSave || 0;
  return {
    saves: meta.saves || 0,
    snapshots: list.length,
    lastSave: last,
    lastSaveLabel: last ? new Date(last).toLocaleTimeString() : '',
    bytes,
    autosave: autosaveOn(),
  };
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

/**
 * Start autosaving. Safe to call more than once.
 */
export function init() {
  if (started) return;
  started = true;

  on('doc', () => {
    if (!autosaveOn()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      save();
    }, AUTOSAVE_MS);
  });

  /* A tab that is closed cannot finish a pending write, so flush on the way
     out. localStorage writes are synchronous, so this really does land. */
  window.addEventListener('beforeunload', () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (autosaveOn()) save();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && autosaveOn()) save();
  });
}

export function isStarted() {
  return started;
}
