/* ============================================================================
   Visual Builder â€” Electron main process (packaged app: resources/app/main.js)
   The app is loaded by Electron from resources/app, so we never rely on an
   app-directory argument. We serve over http so the scene's relative
   IMAGES/ and vendor/ references resolve exactly like they do in the IDE.
   ========================================================================== */
'use strict';
const { app, BrowserWindow, ipcMain, dialog, clipboard, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

const fs0 = require('fs');
const APP_DIR = (fs0.existsSync(path.join(__dirname, 'visualbuilder.html')) ? __dirname : path.join(__dirname, '..'));
const SCENE = path.join(APP_DIR, 'visualbuilder.html');
const DEFAULT_PORT = 45777;

let win = null;
let projectRoot = null;
let port = DEFAULT_PORT;

/* â”€â”€ argv: --project <dir> --open <file> --port <n> â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function argVal(name, dflt) {
  const i = process.argv.indexOf(name);
  return (i >= 0 && process.argv[i + 1]) ? process.argv[i + 1] : dflt;
}
projectRoot = argVal('--project', process.cwd());
const openFile = argVal('--open', null);
port = parseInt(argVal('--port', DEFAULT_PORT), 10) || DEFAULT_PORT;

/* Dev hook: EAGLE_VB_DEBUG_PORT=<n> opens the Chromium remote-debugging port so
   the live app can be inspected over CDP (the same hook the Arduino simulator
   exposes). Pushing the switch into process.argv does NOT work — Chromium has
   already parsed the command line by the time this script runs — so it goes
   through app.commandLine, which is applied before any window is created. */
if (process.env.EAGLE_VB_DEBUG_PORT) {
  const dbg = parseInt(process.env.EAGLE_VB_DEBUG_PORT, 10);
  if (dbg > 0 && dbg < 65536) {
    app.commandLine.appendSwitch('remote-debugging-port', String(dbg));
    app.commandLine.appendSwitch('remote-allow-origins', '*');
  }
}

/* â”€â”€ static server so relative asset paths resolve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* Content types for everything the builder serves. The four tool folders that
   sit NEXT TO the page (Theme Editor, QuickPalettes, html-tools-master,
   css-button-generator) bring their own fonts (.woff2), module scripts
   (.mjs/.cjs), TypeScript sources (.ts) and markdown/toml/shell files. A font
   served as application/octet-stream is REFUSED by the browser, so the map
   has to know about them - not just about the page's own assets. */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.ts': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.toml': 'text/plain; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8', '.ejs': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm', '.map': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json'
};

function startServer(cb) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(url.parse(req.url).pathname || '/');
    if (p === '/' || p === '') p = '/visualbuilder.html';
    const file = path.join(APP_DIR, p.replace(/^\/+/, ''));
    if (file.indexOf(APP_DIR) !== 0) { res.writeHead(403); return res.end('forbidden'); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found: ' + p); }
      const ext = path.extname(file).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  const onError = () => {
    /* fixed port busy -> ephemeral, never fail to launch */
    srv.listen(0, '127.0.0.1', () => cb('http://127.0.0.1:' + srv.address().port + '/'));
  };
  srv.on('error', onError);
  srv.listen(port, '127.0.0.1', () => cb('http://127.0.0.1:' + srv.address().port + '/'));
}



/* â”€â”€ window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function loadAppIcon() {
  /* The runtime exe is a hard link to EagleAI.exe, so the embedded exe icon
     cannot be changed per app. Setting the BrowserWindow icon is what actually
     controls the title bar and the taskbar, so use the same eagle asset. */
  try {
    const ico = path.join(APP_DIR, 'build', 'icon.ico');
    const png = path.join(APP_DIR, 'build', 'icon.png');
    if (fs.existsSync(ico)) return nativeImage.createFromPath(ico);
    if (fs.existsSync(png)) return nativeImage.createFromPath(png);
  } catch (e) { /* fall through */ }
  return null;
}

/* The window is created hidden and shown on ready-to-show. That is correct for
   avoiding a white flash, but it is also a deadlock trap: any NATIVE dialog
   (alert/confirm/prompt arrive here as sendSync) raised before the window is
   visible waits for a user who cannot see a window that does not exist yet,
   and ready-to-show can never fire while the modal is up. showWindow() is
   therefore idempotent and is called from ready-to-show, from did-finish-load,
   from a timer, and immediately before every native dialog - so the renderer
   can never park on a dialog nobody can reach. */
let windowShown = false;
function showWindow() {
  if (!win || windowShown) return;
  windowShown = true;
  try { win.show(); } catch (e) { /* already gone */ }
}

function createWindow(entry) {
  const icon = loadAppIcon();
  win = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 1100, minHeight: 700,
    backgroundColor: '#0f1115',
    title: 'Visual Builder',
    icon: icon || undefined,
    show: false,
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.loadURL(entry);
  win.once('ready-to-show', () => {
    showWindow();
    if (icon) { try { win.setIcon(icon); } catch (e) {} }
    if (openFile) { try { win.webContents.send('vb:open', openFile); } catch (e) {} }
  });
  /* Belt and braces: whatever happens to ready-to-show, the window is up by the
     time the load finishes (or 3s at the latest), so nothing can block on it. */
  win.webContents.on('did-finish-load', showWindow);
  setTimeout(showWindow, 3000);
  win.on('closed', () => { win = null; windowShown = false; app.quit(); });
}

/* â”€â”€ live sync with the IDE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Two ways a rebuild reaches this window, both cheap and dependency free:
     1. the IDE touches <app>/.vb-reload after an npm build / run
     2. we also watch the project's build output folders ourselves, so a build
        started from ANY terminal (IDE or not) is picked up too.            */
const RELOAD_MARKER = path.join(APP_DIR, '.vb-reload');
let lastMarker = 0;
let lastOutputs = {};

function readMarker() {
  try {
    const st = fs.statSync(RELOAD_MARKER);
    if (st.mtimeMs > lastMarker) { lastMarker = st.mtimeMs; return st.mtimeMs; }
  } catch (e) { /* no marker yet */ }
  return 0;
}

function outputFolders() {
  if (!projectRoot) return [];
  return ['dist', 'build', 'public', 'www', 'out', '.next']
    .map(d => path.join(projectRoot, d))
    .filter(d => { try { return fs.statSync(d).isDirectory(); } catch (e) { return false; } });
}

function newestOutputStamp() {
  let newest = 0;
  const dirs = outputFolders();
  for (let i = 0; i < dirs.length; i++) {
    try {
      const st = fs.statSync(dirs[i]);
      if (st.mtimeMs > newest) newest = st.mtimeMs;
    } catch (e) { /* gone */ }
  }
  return newest;
}

function reload(reason) {
  if (!win || win.isDestroyed()) return false;
  try {
    win.webContents.send('vb:built', { reason: reason, at: Date.now() });
    win.webContents.reload();
    return true;
  } catch (e) { return false; }
}

function startSyncWatch() {
  /* poll every second: robust across platforms and cheap (two stat calls) */
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    if (readMarker()) { reload('ide-build'); return; }
    const stamp = newestOutputStamp();
    if (stamp && stamp !== lastOutputs.__v) {
      if (lastOutputs.__v !== undefined) reload('output-changed');
      lastOutputs.__v = stamp;
    }
  }, 1000);
}

/* â”€â”€ IPC: the two-way bridge with the page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
ipcMain.handle('vb:info', () => ({
  projectRoot, port, electron: true,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
  appDir: APP_DIR
}));

ipcMain.handle('vb:gpu', async () => {
  try {
    const r = await win.webContents.executeJavaScript(
      '(function(){try{var c=document.createElement("canvas");return !!c.getContext("webgl2");}catch(e){return false;}})()');
    return { webgl: !!r };
  } catch (e) { return { webgl: false }; }
});

ipcMain.handle('vb:readFile', (_e, file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch (err) { return null; }
});

ipcMain.handle('vb:saveFile', async (_e, file, content) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.basename(file || 'index.html') });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, content, 'utf8');
  return r.filePath;
});

ipcMain.handle('vb:listDir', (_e, dir) => {
  try {
    return fs.readdirSync(dir || projectRoot || '.', { withFileTypes: true })
      .map(d => ({ name: d.name, dir: d.isDirectory() }));
  } catch (e) { return []; }
});

ipcMain.handle('vb:project', () => projectRoot);

/* The page may still be parsing when ready-to-show fires, so the file handed
   over on the command line is collected by the page itself once it boots. */
ipcMain.handle('vb:takeOpen', () => openFile || null);
ipcMain.handle('vb:alert', async (_e, msg) => {
  const text = String(msg == null ? '' : msg);
  await dialog.showMessageBox(win, {
    type: 'info',
    message: text,
    /* Electron wraps and grows the box, but it caps the detail pane, so put
       anything long there where it scrolls instead of truncating it. */
    detail: text.length > 260 ? text : '',
    buttons: ['OK'],
    defaultId: 0,
    noLink: true
  });
  return true;
});
ipcMain.handle('vb:clipboard', (_e, text) => { clipboard.writeText(String(text || '')); return true; });

/* page -> main -> IDE */
ipcMain.on('vb:requestOpen', (_e, file) => {
  const relay = process.env.EAGLE_VB_RELAY;
  if (relay) {
    try {
      http.get(relay + '/__vb/open?path=' + encodeURIComponent(file), () => {});
    } catch (err) {}
  }
});

/* â”€â”€ menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   The scene ships its own full menu bar (File / Edit / Arrange / View /
   Design / Tools) rendered in HTML.  Electron's native menu duplicated it
   with a second File+View pair that competed with the real one, so it is
   removed entirely.  The few things it used to carry (dev tools, reload,
   full screen) stay reachable from the keyboard.                        */
function buildMenu() {
  Menu.setApplicationMenu(null);
}

function installKeyboardFallbacks() {
  if (!win || win.webContents.__vbKeys) return;
  win.webContents.__vbKeys = true;
  win.webContents.on('before-input-event', (ev, input) => {
    if (!input || !input.key) return;
    const k = input.key.toLowerCase();
    const mod = input.control || input.meta;
    if (input.type === 'keyDown') {
      if (k === 'f12' || (mod && input.shift && k === 'i')) {
        ev.preventDefault();
        win.webContents.toggleDevTools();
      } else if (mod && k === 'r') {
        ev.preventDefault();
        win.webContents.reload();
      } else if (input.alt && input.key === 'Enter') {
        ev.preventDefault();
        win.setFullScreen(!win.isFullScreen());
      }
    }
  });
}

/* â”€â”€ diagnostics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   The text-prompt path blocks this process, so console output can be the
   difference between "it works" and "it silently returns null". Always on,
   one short line per dialog. */
const VB_LOG = path.join(require('os').tmpdir(), 'eagle-vb-main.log');
function vblog(msg) {
  try { fs.appendFileSync(VB_LOG, new Date().toISOString() + ' ' + msg + '\n'); } catch (e) {}
}

/* â”€â”€ native, SYNCHRONOUS dialogs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   The scene is legacy code: ~200 call sites use prompt()/alert()/confirm()
   as *synchronous* functions.  Electron removed the renderer-side JS
   implementations of those three, which is why every one of those buttons
   silently did nothing.  The only way to give them real behaviour without
   rewriting 200 call sites is to block the renderer on a native dialog and
   hand the answer back, which is exactly what sendSync + showMessageBoxSync
   does.  A renderer blocked here is idle, not hung: it resumes the instant
   the user answers.                                                        */
ipcMain.on('vb:dlg', (ev, req) => {
  req = req || {};
  vblog('dlg ' + (req && req.type));
const type = req.type === 'confirm' ? 'question'
    : req.type === 'error' ? 'error'
    : req.type === 'warning' ? 'warning' : 'info';
  try {
    /* Never open a modal against a window the user cannot see - see showWindow(). */
    showWindow();
    if (req.type === 'alert') {
      dialog.showMessageBoxSync(win, {
        type: 'info',
        message: String(req.message || ''),
        detail: String(req.detail || ''),
        buttons: ['OK']
      });
      ev.returnValue = true;
      return;
    }
    if (req.type === 'confirm') {
      const r = dialog.showMessageBoxSync(win, {
        type: type,
        message: String(req.message || ''),
        detail: String(req.detail || ''),
        buttons: [String(req.ok || 'OK'), String(req.cancel || 'Cancel')],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      ev.returnValue = (r === 0);
      return;
    }
    /* prompt: Electron has no native text input dialog, so build one in a
       frameless child window and read the value back synchronously.       */
    const value = promptDialogSync(String(req.message || ''), String(req.defaultValue || ''));
    ev.returnValue = value;
  } catch (e) {
    vblog('dlg ERROR ' + (e && e.stack ? e.stack : e));
    ev.returnValue = req.type === 'confirm' ? false : null;
  }
});

function Silent(e) { /* keep the renderer unblocked no matter what */ }

/* A real modal TEXT INPUT for the ~190 legacy prompt() call sites.

   Two hard constraints shape this. The renderer is parked in sendSync, so
   THIS event loop is not running while the user answers - an ipc message from
   any child would sit in the queue until the answer is already needed. And
   Chromium creates renderer processes on this same thread, so a BrowserWindow
   opened here never gets a renderer and stays blank (verified: the window
   appeared and never fired did-finish-load).

   What does work is another PROCESS with its own message pump. Windows ships
   a real text box in that shape, so prompt() is driven by a small PowerShell
   helper. Two details make it feel right:

     - the helper is started ONCE at boot and kept warm. Spawning PowerShell
       per prompt cost 1-2s of dead UI before the box even appeared, which is
       exactly the "the interface hangs" report;
     - the form is parented over the builder window and kept topmost, so it
       cannot open behind the app.

   Requests go down the helper's stdin and answers come back on its stdout.
   fs.readSync on a pipe is a true blocking read that does NOT need the event
   loop, which is precisely what a parked handler requires. */
const PROMPT_HELPER_PS = function (dir) {
  return [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$dir = ' + psQuote(dir),
    '$req = Join-Path $dir "req.json"',
    '$res = Join-Path $dir "res.json"',
    '$rdy = Join-Path $dir "ready.txt"',
    '$f = New-Object System.Windows.Forms.Form',
    '$f.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable',
    '$f.StartPosition   = [System.Windows.Forms.FormStartPosition]::Manual',
    '$f.MaximizeBox = $false',
    '$f.MinimizeBox = $false',
    '$f.ShowInTaskbar = $false',
    '$f.TopMost = $true',
    '$f.ClientSize = New-Object System.Drawing.Size(560,220)',
    '$f.MinimumSize = New-Object System.Drawing.Size(560,220)',
    '$f.BackColor = [System.Drawing.Color]::FromArgb(23,26,33)',
  "$f.Text = 'Visual Builder'",
    /* Was a fixed 440x46 Label with AutoEllipsis, which silently cut any
       message to its first line or two and showed an ellipsis. A read-only
       multiline box scrolls, and the form grows with the message. */
    '$lbl = New-Object System.Windows.Forms.TextBox',
    '$lbl.Multiline = $true',
    '$lbl.ReadOnly = $true',
    '$lbl.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical',
    '$lbl.BackColor = [System.Drawing.Color]::FromArgb(28,32,42)',
    '$lbl.ForeColor = [System.Drawing.Color]::FromArgb(232,234,240)',
    '$lbl.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle',
    '$lbl.Location = New-Object System.Drawing.Point(14,12)',
    '$lbl.Size = New-Object System.Drawing.Size(532,84)',
    '$f.Controls.Add($lbl)',
    '$tb = New-Object System.Windows.Forms.TextBox',
    '$tb.Location = New-Object System.Drawing.Point(14,108)',
    '$tb.Size = New-Object System.Drawing.Size(532,24)',
    '$tb.BackColor = [System.Drawing.Color]::FromArgb(16,19,26)',
    '$tb.ForeColor = [System.Drawing.Color]::FromArgb(232,234,240)',
    '$f.Controls.Add($tb)',
    'function Btn($t,$x,$dlg){ $b = New-Object System.Windows.Forms.Button; $b.Text=$t; $b.Location=New-Object System.Drawing.Point($x,146); $b.Size=New-Object System.Drawing.Size(82,28); $b.FlatStyle=[System.Windows.Forms.FlatStyle]::Flat; $b.ForeColor=[System.Drawing.Color]::FromArgb(232,234,240); $b.BackColor=[System.Drawing.Color]::FromArgb(35,40,56); $b.DialogResult=$dlg; $f.Controls.Add($b); return $b }',
    '$ok = Btn "OK" 380 ([System.Windows.Forms.DialogResult]::OK)',
    '$script:cancelled = $true',
    '$ok.Add_Click({ $script:cancelled = $false })',
    '$cancel = Btn "Cancel" 464 ([System.Windows.Forms.DialogResult]::Cancel)',
    '$cancel.Add_Click({ $script:cancelled = $true })',
    '$f.AcceptButton = $ok',
    '$f.CancelButton = $cancel',
    '[System.IO.File]::WriteAllText($rdy, "READY")',
    'while ($true) {',
    '  Start-Sleep -Milliseconds 30',
    '  if (-not [System.IO.File]::Exists($req)) { continue }',
    '  $raw = $null',
    '  try { $raw = [System.IO.File]::ReadAllText($req); [System.IO.File]::Delete($req) } catch { continue }',
    '  if ([string]::IsNullOrWhiteSpace($raw)) { continue }',
    '  try { $q = $raw | ConvertFrom-Json } catch { continue }',
    '  $msg = [string]$q.msg',
    '  $lines = ($msg -split "`r?`n").Count',
    '  $msgH = [Math]::Min(300, [Math]::Max(60, 20 + ($lines * 17)))',
    '  $lbl.Size = New-Object System.Drawing.Size(532, $msgH)',
    '  $tb.Top = 12 + $msgH + 12',
    '  $f.ClientSize = New-Object System.Drawing.Size(560, ($tb.Top + 24 + 44))',
    '  $f.MinimumSize = New-Object System.Drawing.Size(560, ($tb.Top + 24 + 44))',
    '  foreach ($bb in $f.Controls) { if ($bb -is [System.Windows.Forms.Button]) { $bb.Top = $tb.Top + 24 + 10 } }',
    '  $lbl.Text = $msg',
    '  $lbl.SelectionStart = 0; $lbl.SelectionLength = 0',
    '  $tb.Text = [string]$q.def',
    '  if ($null -ne $q.x) { $f.Left = [int]$q.x }',
    '  if ($null -ne $q.y) { $f.Top = [int]$q.y }',
    '  $f.TopMost = $true',
    '$f.Add_Shown({ $tb.Focus(); $tb.SelectAll() })',
    '  $script:cancelled = $true',
    '  [void]$f.ShowDialog()',
    '  $cancelled = [bool]$script:cancelled',
    '  $payload = @{ v = [string]$tb.Text; c = $cancelled } | ConvertTo-Json -Compress',
    '  try { [System.IO.File]::WriteAllText($res, $payload) } catch { }',
    '}'
  ].join('; ');
};

function psQuote(s) {
  return "'" + String(s == null ? '' : s).replace(/'/g, "''") + "'";
}

let promptHelper = null;   /* { dir, proc } once it has written ready.txt */

function parkFor(ms) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  try { Atomics.wait(sab, 0, 0, ms); } catch (e) { /* spin fallback */ }
}

function startPromptHelper() {
  if (promptHelper) return promptHelper;
  let dir = null;
  try {
    dir = path.join(require('os').tmpdir(), 'eagle-vb-prompt-' + process.pid + '-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    vblog('prompt helper dir failed: ' + e);
    return null;
  }
  let proc = null;
  try {
    const encoded = Buffer.from(PROMPT_HELPER_PS(dir), 'utf16le').toString('base64');
    proc = require('child_process').spawn('powershell.exe', [
      '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden', '-EncodedCommand', encoded
    ], { windowsHide: true, stdio: 'ignore' });
  } catch (e) {
    vblog('prompt helper could not start: ' + e);
    return null;
  }
  proc.on('error', () => { promptHelper = null; });
  proc.on('exit', () => { promptHelper = null; });

  /* Wait for ready.txt. This runs at boot with nothing else pending, so a
     blocking poll here costs nothing the user can see. */
  const readyFile = path.join(dir, 'ready.txt');
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { if (fs.existsSync(readyFile)) { promptHelper = { dir: dir, proc: proc }; vblog('prompt helper ready, pid ' + proc.pid); return promptHelper; } }
    catch (e) {}
    parkFor(50);
  }
  vblog('prompt helper never became ready');
  try { proc.kill(); } catch (e) {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  promptHelper = null;
  return null;
}

/* Centre the box on the builder window so it cannot land behind the app. */
function promptPosition() {
  try {
    const b = win.getBounds();
    return {
      x: Math.round(b.x + (b.width - 470) / 2),
      y: Math.round(b.y + Math.max(40, (b.height - 152) / 2 - 80))
    };
  } catch (e) {
    return { x: 300, y: 240 };
  }
}

/* Files, not pipes, carry the answer. fs.readFileSync / fs.existsSync work
   with the event loop parked; a child_process stdout handle does not, because
   its 'data' event can never be delivered while this handler is blocking. */
function promptDialogSync(message, defaultValue) {
  const h = promptHelper;
  if (!h) {
    /* Not warm. Do NOT stall the app waiting for it - a button that quietly
       takes its suggested value beats an interface that freezes. */
    vblog('prompt helper not ready, using the default');
    return fallbackPrompt(message, defaultValue);
  }
  const req = path.join(h.dir, 'req.json');
  const res = path.join(h.dir, 'res.json');
  const pos = promptPosition();
  try {
    try { fs.unlinkSync(res); } catch (e) {}
    fs.writeFileSync(req, JSON.stringify({
      msg: String(message == null ? '' : message),
      def: String(defaultValue == null ? '' : defaultValue),
      x: pos.x, y: pos.y
    }), 'utf8');
  } catch (e) {
    vblog('prompt write failed: ' + e);
    return fallbackPrompt(message, defaultValue);
  }
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    let raw = null;
    try { raw = fs.readFileSync(res, 'utf8'); } catch (e) {}
    if (raw != null) {
      try { fs.unlinkSync(res); } catch (e) {}
      try {
        const r = JSON.parse(raw);
        vblog('prompt answered ' + JSON.stringify(r.v) + (r.c ? ' (cancelled)' : ''));
        return r.c ? null : String(r.v == null ? '' : r.v);
      } catch (e) {
        return fallbackPrompt(message, defaultValue);
      }
    }
    parkFor(20);
  }
  vblog('prompt timed out');
  return fallbackPrompt(message, defaultValue);
}

/* If the text box cannot run at all, still unblock the caller: a native OK /
   Cancel, where OK accepts the suggested value. A dead prompt is what the
   user had before; a mis-named component they can rename is not. */
function fallbackPrompt(message, defaultValue) {
  try {
    const r = dialog.showMessageBoxSync(win || undefined, {
      type: 'question',
      message: String(message || 'Value'),
      detail: 'Use "' + String(defaultValue || '') + '" ?',
      buttons: ['Use "' + String(defaultValue || '') + '"', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    return r === 0 ? String(defaultValue == null ? '' : defaultValue) : null;
  } catch (e) {
    return defaultValue == null ? null : String(defaultValue);
  }
}

/* â”€â”€ native file / folder pickers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   The scene's whole file layer was written against a Java bridge that does
   not exist here, so Open / Load / Open folder / +Files all dead-ended in
   an alert.  These give the page the same operations natively.            */
const TEXT_EXT = /\.(html?|css|js|mjs|json|svg|txt|md|xml|yml|yaml|webmanifest|webmanifest\.json|csv|ts|tsx|jsx|vue|svelte|astro|scss|less)$/i;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FOLDER_FILES = 800;

function filtersFor(kind) {
  switch (kind) {
    case 'image': return [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'] }];
    case 'video': return [{ name: 'Video', extensions: ['mp4', 'webm', 'ogv', 'mov', 'mkv'] }];
    case 'audio': return [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] }];
    case 'model': return [{ name: '3D Models', extensions: ['glb', 'gltf', 'obj', 'stl', 'fbx'] }];
    case 'json': return [{ name: 'Project', extensions: ['json', 'vbp'] }];
    case 'html': return [{ name: 'HTML', extensions: ['html', 'htm'] }];
    default: return [
      { name: 'All files', extensions: ['*'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'] },
      { name: 'Video / Audio', extensions: ['mp4', 'webm', 'mp3', 'wav', 'ogg', 'm4a'] },
      { name: '3D Models', extensions: ['glb', 'gltf', 'obj', 'stl', 'fbx'] },
      { name: 'Documents', extensions: ['html', 'htm', 'css', 'js', 'json', 'txt', 'md', 'svg'] }
    ];
  }
}

ipcMain.handle('vb:openFiles', async (_e, opts) => {
  opts = opts || {};
  try {
    const r = await dialog.showOpenDialog(win || undefined, {
      title: opts.title || 'Choose files',
      defaultPath: opts.dir || projectRoot || undefined,
      properties: opts.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: filtersFor(opts.filter)
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return null;
    return readFilesDeep(r.filePaths);
  } catch (e) { return null; }
});

ipcMain.handle('vb:openFolder', async (_e, opts) => {
  opts = opts || {};
  try {
    const r = await dialog.showOpenDialog(win || undefined, {
      title: opts.title || 'Choose project folder',
      defaultPath: opts.dir || projectRoot || undefined,
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return null;
    const dir = r.filePaths[0];
    return { name: path.basename(dir), path: dir, files: readFolder(dir) };
  } catch (e) { return null; }
});

function readFilesDeep(paths) {
  const out = [];
  const push = (p) => {
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        for (const child of readDirSafe(p)) push(path.join(p, child));
        return;
      }
      if (st.size > MAX_FILE_BYTES) {
        out.push({ path: p, name: path.basename(p), size: st.size, skipped: true, content: '' });
        return;
      }
      const buf = fs.readFileSync(p);
      const isText = TEXT_EXT.test(p) || st.size < 512 * 1024;
      out.push({
        path: p,
        name: path.basename(p),
        size: st.size,
        mtime: st.mtimeMs,
        binary: !isText,
        content: isText ? buf.toString('utf8') : '',
        base64: isText ? '' : buf.toString('base64')
      });
    } catch (e) { /* unreadable file: skip silently, the UI shows what arrived */ }
  };
  for (const p of paths) push(p);
  return out;
}

function readDirSafe(dir) {
  try { return fs.readdirSync(dir); } catch (e) { return []; }
}

function readFolder(dir, depth) {
  depth = depth || 0;
  const out = [];
  if (depth > 6) return out;
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return out; }
  for (const name of names) {
    if (out.length >= MAX_FOLDER_FILES) break;
    if (name === 'node_modules' || name === '.git' || name === '.next'
      || name === 'dist' || name === 'build' || name === '.cache') continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch (e) { continue; }
    if (st.isDirectory()) {
      for (const f of readFolder(full, depth + 1)) out.push(f);
    } else if (!name.startsWith('.')) {
      try {
        const isText = TEXT_EXT.test(name) || st.size < 512 * 1024;
        const buf = st.size > MAX_FILE_BYTES ? null : fs.readFileSync(full);
        out.push({
          /* relative: this is what the Project & Pages panel lists and what
             loadHtmlAsNewPage labels the page with */
          path: path.relative(dir, full) || name,
          abs: full,
          name: name,
          size: st.size,
          mtime: st.mtimeMs,
          binary: !isText,
          content: buf && isText ? buf.toString('utf8') : '',
          base64: buf && !isText ? buf.toString('base64') : ''
        });
      } catch (e) { /* ignore */ }
    }
  }
  return out;
}

ipcMain.handle('vb:readFileText', (_e, p) => {
  try { return { ok: true, content: fs.readFileSync(p, 'utf8') }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});

ipcMain.handle('vb:writeFileText', (_e, p, content) => {
  try {
    const parent = path.dirname(p);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(p, String(content == null ? '' : content), 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});

ipcMain.handle('vb:saveText', async (_e, name, content) => {
  try {
    const r = await dialog.showSaveDialog(win || undefined, {
      title: 'Save file',
      defaultPath: name || 'index.html'
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, String(content == null ? '' : content), 'utf8');
    return r.filePath;
  } catch (e) { return null; }
});

/* Binary (ZIP exports, 3D models) must not go through a utf8 write. */
ipcMain.handle('vb:saveBytes', async (_e, name, base64) => {
  try {
    const r = await dialog.showSaveDialog(win || undefined, {
      title: 'Save file',
      defaultPath: name || 'download.bin'
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, Buffer.from(String(base64 || ''), 'base64'));
    return r.filePath;
  } catch (e) { return null; }
});

/* Live preview of the exported page in its own window. */
ipcMain.handle('vb:preview', (_e, html) => {
  try {
    const dir = path.join(require('os').tmpdir(), 'eagle-vb-preview');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'preview.html');
    fs.writeFileSync(file, String(html || ''), 'utf8');
    const p = new BrowserWindow({
      width: 1280, height: 860, backgroundColor: '#ffffff',
      title: 'Preview',
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    p.loadURL('file:///' + file.replace(/\\/g, '/'));
    return true;
  } catch (e) { return false; }
});

ipcMain.handle('vb:openExternal', async (_e, url) => {
  try {
    if (/^(https?|file):/i.test(String(url))) { await shell.openExternal(String(url)); return true; }
  } catch (e) { /* ignore */ }
  return false;
});

/* "Open the selection as its own project" spawns a second builder window on
   a generated project folder.  Single instance would steal focus back, so the
   new process is launched detached and told which file to open on boot. */
ipcMain.handle('vb:launchChild', async (_e, opts) => {
  opts = opts || {};
  try {
    const dir = opts.dir;
    if (!dir) return { ok: false, error: 'no dir' };
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (opts.file && opts.content != null) {
      fs.writeFileSync(path.join(dir, opts.file), String(opts.content), 'utf8');
    }
    const args = [dir];
    if (projectRoot) args.push('--project', projectRoot);
    if (opts.file) args.push('--open', path.join(dir, opts.file));
    const child = require('child_process').spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      cwd: dir
    });
    child.unref();
    return { ok: true, dir: dir, file: opts.file ? path.join(dir, opts.file) : null };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});

ipcMain.handle('vb:appDir', () => APP_DIR);

if (!fs.existsSync(SCENE)) {
  dialog.showErrorBox('Eagle Visual Builder',
      'Builder entry not found:\n' + SCENE);
  app.quit();
} else {
  app.on('ready', () => {
    startServer((entry) => {
      createWindow(entry);
      buildMenu();
      installKeyboardFallbacks();
      startSyncWatch();
      /* Warm the prompt helper now, while nothing is waiting on it. Starting
         PowerShell lazily cost 1-2s of frozen UI on the first dialog, which is
         what users were reporting as "the interface hangs". */
      setTimeout(() => { try { startPromptHelper(); } catch (e) { vblog('helper warmup: ' + e); } }, 300);
    });
  });
}
app.on('window-all-closed', () => app.quit());
