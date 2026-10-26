/* ============================================================================
   Visual Builder — Electron preload
   Exposes a small, safe bridge to the page. The page never touches Node.

   alert/confirm/prompt are SYNCHRONOUS (sendSync). The scene is legacy code
   with ~190 prompt()/alert()/confirm() call sites; Electron removed the
   renderer-side implementations of all three, so every one of those buttons
   used to do nothing at all.
   ========================================================================== */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vbDesktop', {
  /* environment */
  isElectron: true,
  info: () => ipcRenderer.invoke('vb:info'),
  gpu: () => ipcRenderer.invoke('vb:gpu'),
  project: () => ipcRenderer.invoke('vb:project'),
  appDir: () => ipcRenderer.invoke('vb:appDir'),
  takeOpen: () => ipcRenderer.invoke('vb:takeOpen'),

  /* ── native synchronous dialogs ─────────────────────────────────────── */
  alert: (m) => { ipcRenderer.sendSync('vb:dlg', { type: 'alert', message: String(m == null ? '' : m) }); return true; },
  confirm: (m, ok, cancel) => !!ipcRenderer.sendSync('vb:dlg', {
    type: 'confirm', message: String(m == null ? '' : m), ok: ok || 'OK', cancel: cancel || 'Cancel'
  }),
  prompt: (m, d) => ipcRenderer.sendSync('vb:dlg', {
    type: 'prompt', message: String(m == null ? '' : m), defaultValue: d == null ? '' : String(d)
  }),

  /* ── files ─────────────────────────────────────────────────────────── */
  readFile: (p) => ipcRenderer.invoke('vb:readFile', p),
  readText: (p) => ipcRenderer.invoke('vb:readFileText', p),
  writeText: (p, c) => ipcRenderer.invoke('vb:writeFileText', p, c),
  saveFile: (p, c) => ipcRenderer.invoke('vb:saveFile', p, c),
  saveText: (name, c) => ipcRenderer.invoke('vb:saveText', name, c),
  saveBytes: (name, b64) => ipcRenderer.invoke('vb:saveBytes', name, b64),
  preview: (html) => ipcRenderer.invoke('vb:preview', html),
  listDir: (d) => ipcRenderer.invoke('vb:listDir', d),
  openFiles: (opts) => ipcRenderer.invoke('vb:openFiles', opts || {}),
  openFolder: (opts) => ipcRenderer.invoke('vb:openFolder', opts || {}),
  openExternal: (u) => ipcRenderer.invoke('vb:openExternal', u),
  launchChild: (opts) => ipcRenderer.invoke('vb:launchChild', opts || {}),

  /* native conveniences */
  message: (m) => ipcRenderer.invoke('vb:alert', m),
  clipboard: (t) => ipcRenderer.invoke('vb:clipboard', t),

  /* page -> main -> IDE */
  requestOpen: (p) => ipcRenderer.send('vb:requestOpen', p),

  /* main -> page */
  onOpen: (cb) => ipcRenderer.on('vb:open', (_e, file) => cb(file)),
  onReload: (cb) => ipcRenderer.on('vb:reload', () => cb())
});

/* Capability report the dock can read to decide what to enable.
   In the JavaFX WebView there is no vbDesktop, so the dock degrades. */
window.__VB_RUNTIME__ = {
  electron: true,
  webgl: (function () {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
  })(),
  engine: (function () {
    var m = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
    return m ? 'chromium ' + m[1] : 'unknown';
  })()
};