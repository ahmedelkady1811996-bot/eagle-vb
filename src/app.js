import * as liveCanvas from './render/livecanvas.js';
import * as pageCss from './render/pagecss.js';
import * as coords from './layout/coords.js';
import { zoomBy, applyTransform, zoomReset } from './layout/coords.js';
import * as guides from './layout/guides.js';
import * as ops from './model/ops.js';
import * as components from './model/components.js';
import * as tokens from './model/tokens.js';
import * as mushaf from './ui/mushaf.js';
import * as interact from './ui/interact.js';
import * as palette from './ui/palette.js';
import * as inspector from './ui/inspector.js';
import * as layers from './ui/layers.js';
import * as shell from './ui/shell.js';
import * as menus from './ui/menus.js';
import * as widgets from './ui/widgets.js';
import { colorPopover, openPopover, closePopover } from './ui/widgets.js';
import * as panels from './ui/panels.js';
import * as studio from './ui/studio.js';
import * as devPanels from './ui/devpanels.js';
import * as workspace from './ui/workspace.js';
import * as project from './io/project.js';
import * as exporter from './io/exporter.js';
import * as host from './io/host.js';
import * as blocks from './io/blocks.js';
import * as three from './three/bridge.js';
import { $, h, clear } from './core/dom.js';
import { on, emit } from './core/bus.js';
import { state, currentDoc, undo, redo, snapshot, markClean, find, findAll, parentOf } from './core/store.js';
import { renderCanvas, updateBlockNode, canvas } from './render/canvas.js';
import { measureAll } from './layout/measure.js';
import { count as blockCount, get as getDef, isContainer } from './model/catalog.js';
import { initTheme, toggleTheme } from './ui/theme.js';
import { pickModelFile } from './three/loaders.js';
import { debounce } from './core/util.js';
import { NUR_FULL_HTML } from './starters/nur.js';
import { NUR_RUNTIME_JS } from './starters/nur-runtime.js';

function isThreeType(type) {
  return !!(type && (type.indexOf('three_') === 0 || type === 'model3d'));
}


const MENUS = [
  {
    label: 'File',
    items: [
      { id: 'file.new', label: 'New page', key: 'Ctrl+N' },
      { id: 'file.open', label: 'Open project…', key: 'Ctrl+O' },
      { id: 'file.save', label: 'Save project', key: 'Ctrl+S' },
      '-',
      { id: 'file.library', label: 'Block library…' },
      { id: 'file.settings', label: 'Page & builder settings…' },
      { id: 'file.assets', label: 'Assets library…' },
      '-',
      { id: 'file.export', label: 'Export code', key: 'Ctrl+E' },
      { id: 'file.zip', label: 'Download ZIP' },
      { id: 'file.preview', label: 'Open preview in browser' },
      '-',
      { id: 'file.clear', label: 'Clear canvas', danger: true },
    ],
  },
  {
    label: 'Edit',
    items: [
      { id: 'edit.undo', label: 'Undo', key: 'Ctrl+Z' },
      { id: 'edit.redo', label: 'Redo', key: 'Ctrl+Shift+Z' },
      '-',
      { id: 'edit.duplicate', label: 'Duplicate', key: 'Ctrl+D' },
      { id: 'edit.copy', label: 'Copy blocks', key: 'Ctrl+C' },
      { id: 'edit.paste', label: 'Paste blocks', key: 'Ctrl+V' },
      { id: 'edit.delete', label: 'Delete', key: 'Del' },
      '-',
      { id: 'edit.blockActions', label: 'Block actions…' },
      { id: 'edit.saveToLibrary', label: 'Save selection to library' },
      { id: 'edit.createComponent', label: 'Create component' },
      { id: 'edit.detachComponent', label: 'Detach component instance' },
      { id: 'edit.syncComponent', label: 'Sync component instances' },
      { id: 'edit.copyStyle', label: 'Copy style' },
      { id: 'edit.pasteStyle', label: 'Paste style' },
      '-',
      { id: 'edit.selectAll', label: 'Select all', key: 'Ctrl+A' },
      { id: 'edit.selectParent', label: 'Select parent' },
      { id: 'edit.selectChild', label: 'Select first child' },
      { id: 'edit.find', label: 'Find block', key: 'Ctrl+F' },
    ],
  },
  {
    label: 'Arrange',
    items: [
      { id: 'arr.front', label: 'Bring to front' },
      { id: 'arr.up', label: 'Bring forward', key: 'Ctrl+]' },
      { id: 'arr.down', label: 'Send backward', key: 'Ctrl+[' },
      { id: 'arr.back', label: 'Send to back' },
      '-',
      { id: 'arr.left', label: 'Align left' },
      { id: 'arr.cx', label: 'Align centre' },
      { id: 'arr.right', label: 'Align right' },
      { id: 'arr.top', label: 'Align top' },
      { id: 'arr.cy', label: 'Align middle' },
      { id: 'arr.bottom', label: 'Align bottom' },
      '-',
      { id: 'arr.distH', label: 'Distribute horizontally' },
      { id: 'arr.distV', label: 'Distribute vertically' },
      { id: 'arr.spaceH', label: 'Equal horizontal gaps' },
      { id: 'arr.spaceV', label: 'Equal vertical gaps' },
      '-',
      { id: 'arr.group', label: 'Group', key: 'Ctrl+G' },
      { id: 'arr.ungroup', label: 'Ungroup' },
      { id: 'arr.unnest', label: 'Move to page root' },
      { id: 'arr.nest', label: 'Nest in previous sibling' },
      '-',
      { id: 'arr.wrap', label: 'Wrap selection in container' },
    ],
  },
  {
    label: 'View',
    items: [
      { id: 'view.zoomIn', label: 'Zoom in', key: '+' },
      { id: 'view.zoomOut', label: 'Zoom out', key: '−' },
      { id: 'view.zoomReset', label: 'Zoom 100%', key: 'Ctrl+0' },
      { id: 'view.zoom50', label: 'Zoom 50%' },
      { id: 'view.zoom200', label: 'Zoom 200%' },
      { id: 'view.fit', label: 'Fit canvas', key: 'Ctrl+1' },
      { id: 'view.fitSel', label: 'Zoom to selection', key: 'Ctrl+2' },
      '-',
      { id: 'view.grid', label: 'Grid' },
      { id: 'view.snap', label: 'Snap' },
      { id: 'view.guides', label: 'Alignment guides' },
      { id: 'view.preview', label: 'Preview mode', key: 'Ctrl+P' },
      '-',
      { id: 'view.theme', label: 'Toggle theme' },
      { id: 'view.flow', label: 'Flow layout mode' },
      { id: 'view.free', label: 'Free layout mode' },
      '-',
      { id: 'view.help', label: 'Shortcuts & help' },
      '-',
      { id: 'studio.collab', label: 'Live collaboration…' },
      { id: 'studio.timeline', label: 'Animation timeline…' },
      { id: 'studio.forms', label: 'Form submissions…' },
      { id: 'studio.cms', label: 'CMS preview…' },
      { id: 'studio.market', label: 'Component marketplace…' },
    ],
  },
  {
    label: 'Develop',
    items: [
      { id: 'dev.frameworks', label: 'Framework components…' },
      { id: 'dev.backend', label: 'Backend / API client…' },
      { id: 'dev.data', label: 'Data & CMS…' },
      { id: 'dev.workspace', label: 'Workspace & snapshots…' },
    ],
  },
  {
    label: 'Insert',
    items: [
      { id: 'ins.heading', label: 'Heading' },
      { id: 'ins.paragraph', label: 'Paragraph' },
      { id: 'ins.button', label: 'Button' },
      { id: 'ins.image', label: 'Image' },
      { id: 'ins.frame', label: 'Frame' },
      { id: 'ins.section', label: 'Section' },
      { id: 'ins.columns', label: 'Columns' },
      { id: 'ins.card', label: 'Card' },
      '-',
      { id: 'ins.hero', label: 'Hero section' },
      { id: 'ins.features', label: 'Features section' },
      { id: 'ins.pricingSection', label: 'Pricing section' },
      { id: 'ins.testimonialsSection', label: 'Testimonials section' },
      { id: 'ins.faqSection', label: 'FAQ section' },
      { id: 'ins.contactSection', label: 'Contact section' },
      { id: 'ins.ctaBanner', label: 'CTA banner' },
      { id: 'ins.footer', label: 'Footer' },
      '-',
      '-',
      { id: 'ins.three', label: '3D object' },
      { id: 'ins.three_scene', label: '3D scene' },
      { id: 'ins.model3d', label: '3D model from device…' },
    ],
  },
  {
    label: '3D',
    items: [
      { id: 'three.box', label: 'Cube' },
      { id: 'three.sphere', label: 'Sphere' },
      { id: 'three.torus', label: 'Torus' },
      { id: 'three.torusKnot', label: 'Torus knot' },
      { id: 'three.cylinder', label: 'Cylinder' },
      { id: 'three.cone', label: 'Cone' },
      { id: 'three.capsule', label: 'Capsule' },
      { id: 'three.icosahedron', label: 'Icosahedron' },
      { id: 'three.ring', label: 'Ring' },
      '-',
      { id: 'three.scene', label: '3D scene (many objects)' },
      { id: 'three.model', label: '3D model from device…' },
      '-',
      { id: 'three.preset.studio', label: 'Preset: Studio' },
      { id: 'three.preset.night', label: 'Preset: Night' },
      { id: 'three.preset.neon', label: 'Preset: Neon' },
      { id: 'three.preset.daylight', label: 'Preset: Daylight' },
      { id: 'three.preset.clay', label: 'Preset: Clay' },
      { id: 'three.preset.void', label: 'Preset: Void' },
      '-',
      { id: 'three.toggleSpin', label: 'Toggle auto spin' },
      { id: 'three.toggleScroll', label: 'Toggle spin on scroll' },
    ],
  },
];

/* Does this document need the page's own stylesheet to be drawn at all?
   An imported page is styled by Tailwind + web fonts + Font Awesome, none of
   which exist in the editor document, so drawing its blocks natively here
   produced a pile of unstyled text. Those documents open in the live canvas,
   which renders the real exported page. */
function needsLiveCanvas(doc) {
  if (!doc) return false;
  const head = doc.head || {};
  if (Array.isArray(head.scripts) && head.scripts.length) return true;
  let found = false;
  const scan = (list) => {
    for (const b of list || []) {
      if (b.props && b.props._imported) { found = true; return; }
      scan(b.children);
    }
  };
  scan(doc.children);
  return found;
}

function repaint() {
  /* The page's own stylesheet, scoped to the canvas, so an imported document
     looks like itself while staying NATIVE - drag, resize, the selection box,
     flow and free all keep working. */
  if (needsLiveCanvas(currentDoc())) {
    try { pageCss.applyPageCss(currentDoc()); } catch (e) { void e; }
  }

  if (state.ui.liveCanvas === true) {
    const box = canvas();
    /* The host lives on the STAGE, not on #canvas: reconcileChildren() owns
       every child of #canvas and deletes anything it does not recognise, so a
       live-canvas element appended there was removed on the very next render. */
    const host = box && box.parentNode;
    if (box && host) {
      const doc = currentDoc();
      doc.canvas.live = true;
      renderCanvas();
      liveCanvas.mount(host, box, exporter.htmlBundle(), (doc.canvas || {}).width);
      liveCanvas.highlight(state.selection);
    }
  } else {
    const doc = currentDoc();
    if (doc && doc.canvas) doc.canvas.live = false;
    liveCanvas.unmount();
    renderCanvas();
  }
  try { tokens.applyTokensToDom(); } catch (e) { void e; }
  three.mountAll();
  try { mushaf.scheduleMushaf(); } catch (e) { void e; }
  measureAll();
  interact.paint();
  shell.buildStatusbar();
  shell.buildContextbar();
}

const repaintSoon = debounce(repaint, 16);

function bindEvents() {
  on('doc', () => {
    repaintSoon();
    project.saveAutosave();
  });

  on('field:changed', (payload) => {
    if (!payload) return;
    const block = find(currentDoc(), payload.id);
    if (block) updateBlockNode(block);
    three.schedule();
    // Always remeasure + paint selection so layout/hidden changes stick
    if (payload.live !== true) {
      repaintSoon();
    } else {
      measureAll();
      interact.paint();
    }
  });
  on('selection', () => {
    measureAll();
    interact.paint();
    shell.buildContextbar();
  });

  on('palette:add', (type) => {
    ops.addBlock(type);
    repaint();
  });

  on('ctx:color', (payload) => {
    if (!payload || !payload.block) return;
    colorPopover(payload.anchor, payload.block.style.bg, (value) => {
      ops.setStyleProp(payload.block.id, 'bg', value);
      repaint();
    });
  });

  on('field:color', (payload) => {
    if (!payload) return;
    colorPopover(payload.anchor, payload.current, (value) => {
      payload.onPick(value);
      repaint();
    });
  });

  on('field:iconPick', (payload) => {
    openPopover(payload.anchor, () => {
      const wrap = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '230px' } });
      for (const n of ['spark', 'bolt', 'shield', 'star', 'heart', 'check', 'arrow', 'globe', 'clock', 'layers', 'chat', 'user', 'users', 'mail', 'phone', 'pin', 'lock', 'chart', 'menu', 'close', 'plus', 'play', 'search']) {
        const b = h('button', { class: 'pick', type: 'button', title: n }, n);
        b.addEventListener('click', () => {
          payload.onPick(n);
          closePopover();
          repaint();
        });
        wrap.appendChild(b);
      }
      return wrap;
    });
  });

  on('field:icon', (name) => {
    const block = ops.primary();
    if (!block) return;
    ops.setProp(block.id, 'icon', name);
    repaint();
  });

  on('field:asset', (payload) => {
    if (!payload) return;
    pickAsset(payload.accept).then((value) => {
      if (!value) return;
      payload.onPick(value);
      // Save into project assets library
      try {
        const doc = currentDoc();
        doc.assets = doc.assets || [];
        doc.assets.push({ id: 'a' + Date.now().toString(36), src: value, kind: payload.accept || 'image', at: Date.now() });
      } catch (e) { void e; }
      repaint();
    });
  });

  on('field:model', (payload) => {
    if (!payload) return;
    Promise.resolve()
      .then(() => pickModelFile())
      .then((result) => {
        if (!result) return;
        payload.onPick(result);
        try {
          const doc = currentDoc();
          doc.assets = doc.assets || [];
          doc.assets.push({ id: 'm' + Date.now().toString(36), src: result.src, name: result.name, kind: 'model', at: Date.now() });
        } catch (e) { void e; }
        repaint();
        // Force the WebGL viewer to rebuild with the new file
        const id = ops.primary() && ops.primary().id;
        if (id) three.remount(id);
        else three.schedule();
        widgets.toast('3D model loaded: ' + (result.name || 'file') + (result.companions && result.companions.mtl ? ' + materials' : ''), 'ok');
      })
      .catch((err) => {
        console.error('[model pick]', err);
        widgets.toast('Could not open model picker', 'err');
      });
  });

  on('command', (id) => runCommand(id));
  on('view', () => {
    applyTransform();
    interact.paint();
    shell.buildStatusbar();
    shell.buildContextbar();
  });
  /* Keep the JavaFX dock in step with the page. */
  on('doc', () => {
    notifyBlockCount();
    notifyChanged();
  });
  on('selection', () => {
    notifySelection();
    notifyBlockCount();
  });
}

/* ------------------------------------------------------------------ *
 * The JavaFX dock bridge.
 *
 * The docked panel (VisualBuilderController) drives the page through a
 * handful of window-level functions and listens through window.javaBridge.
 * NONE of them existed, so the panel's "0 blocks" label never changed and
 * its Add / Load / Clear / Folder buttons did nothing at all - which is
 * exactly what "it says it has no blocks and nothing opens for editing"
 * looked like from the user's side.
 * ------------------------------------------------------------------ */

function vbBridge() {
  return (typeof window !== 'undefined' && window.javaBridge) ? window.javaBridge : null;
}

function notifyBlockCount() {
  const b = vbBridge();
  if (!b || typeof b.onBlockCount !== 'function') return;
  try { b.onBlockCount(blockCount()); } catch (e) { void e; }
}

function notifySelection() {
  const b = vbBridge();
  if (!b || typeof b.onSelection !== 'function') return;
  const ids = Array.from(state.selection);
  const block = ids.length ? ops.findBlock(ids[ids.length - 1]) : null;
  const st = (block && block.style) || {};
  const info = {
    selected: !!block,
    type: block ? block.type : 'none',
    x: Number(st.x) || 0,
    y: Number(st.y) || 0,
    w: Number(st.w) || 0,
    h: Number(st.h) || 0,
  };
  try { b.onSelection(JSON.stringify(info)); } catch (e) { void e; }
}

function notifyChanged() {
  const b = vbBridge();
  if (!b || typeof b.onChanged !== 'function') return;
  try { b.onChanged(); } catch (e) { void e; }
}

/** Install the window-level functions the dock calls. */
function installDockBridge() {
  if (typeof window === 'undefined') return;

  /* The dock's "Add block" button. */
  window.addBlock = function addBlock(type) {
    try {
      const b = ops.addBlock(String(type || ''));
      notifyChanged();
      notifyBlockCount();
      return b;
    } catch (e) {
      console.error('[dock.addBlock]', e);
      return null;
    }
  };

  /* The dock's "Clear all" button. */
  window.clearAll = function clearAll() {
    snapshot('Clear canvas');
    const doc = currentDoc();
    doc.children = [];
    state.selection.clear();
    repaint();
    emit('doc');
    emit('selection');
    notifyChanged();
    return true;
  };

  /* The dock's "Load project" button - a project JSON string. */
  window.setBlocksJSON = function setBlocksJSON(json) {
    try {
      const payload = typeof json === 'string' ? JSON.parse(json) : json;
      if (!payload) return false;
      if (!project.loadPayload(payload)) return false;
      repaint();
      interact.fit();
      emit('doc');
      emit('selection');
      notifyChanged();
      notifyBlockCount();
      return true;
    } catch (e) {
      console.error('[dock.setBlocksJSON]', e);
      return false;
    }
  };

  /* The dock's "Open folder" button: { name, files: [{name, path, text}] } */
  window.ingestProjectFromJava = function ingestProjectFromJava(payload) {
    try {
      const p = payload || {};
      const files = Array.isArray(p.files) ? p.files : [];
      if (!files.length) return false;
      const html = files.find((f) => /index\.html?$/i.test(f.name || f.path || ''))
        || files.find((f) => /\.html?$/i.test(f.name || f.path || ''));
      if (!html) return false;
      const text = html.text != null ? html.text : (html.content || '');
      if (!text) return false;
      const doc = currentDoc();
      snapshot('Open external folder');
      doc.children = [];
      doc.name = p.name || (html.name || 'page').replace(/\.html?$/i, '') || 'External project';
      doc.canvas.mode = 'flow';
      doc.canvas.background = '#0f172a';
      doc.canvas.width = 1440;
      doc.pageHtml = text;
      doc.projectFiles = files.map((f) => ({
        name: f.name || f.path || '',
        path: f.path || f.name || '',
        size: f.size || 0,
        kind: /\.html?$/i.test(f.name || '') ? 'html'
          : /\.css$/i.test(f.name || '') ? 'css'
          : /\.(js|mjs)$/i.test(f.name || '') ? 'js'
          : /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || '') ? 'image'
          : 'file',
      }));
      const imported = blocks.importHtmlString(text, { sourceName: html.name || 'index.html', structure: true });
      if (!imported || !imported.length) {
        ops.addBlock('htmlStage', {
          props: { bodyHtml: text, headCss: '', sourceName: html.name || 'index.html', editable: true },
          style: { w: '100%', minH: 900, overflow: 'auto' },
        });
      }
      doc.pageHtml = '';
      for (const b of (currentDoc().children || [])) b.locked = false;
      state.selection.clear();
      try { layers.setMode('files'); } catch (e) { void e; }
      repaint();
      interact.fit();
      emit('doc');
      emit('selection');
      notifyChanged();
      notifyBlockCount();
      return true;
    } catch (e) {
      console.error('[dock.ingestProjectFromJava]', e);
      return false;
    }
  };
}

/**
 * Put an HTML file on the canvas as a real, editable page.
 *
 * Used by three entry points: the File menu, the "open" argument the IDE
 * hands to the launcher, and the JavaFX dock. Before this existed the boot
 * handler only ever tried to JSON.parse the file, so an .html path was
 * silently dropped and the builder came up on the starter page with the
 * user's file nowhere in sight.
 */
function openHtmlOnCanvas(file) {
  try {
    const text = (file && (file.text != null ? file.text : file.content)) || '';
    if (!text) return false;
    const name = (file && file.name) || 'page';
    const doc = currentDoc();
    snapshot('Open HTML page');
    doc.children = [];
    doc.name = name.replace(/\.html?$/i, '');
    doc.canvas.mode = 'flow';
    doc.canvas.background = '#0f172a';
    doc.canvas.width = 1440;
    doc.pageHtml = text;
    doc.projectFiles = [{
      name: name,
      path: (file && file.path) || name,
      size: (file && file.size) || 0,
      kind: 'html',
    }];
    /* Import the page STRUCTURALLY, so the author gets real, individually
       editable blocks instead of one opaque "browser screenshot" box. The
       page's own stylesheet is still applied to the canvas, so it looks like
       the browser too - that is the point of the pagecss layer. */
    const imported = blocks.importHtmlString(text, { sourceName: name, structure: true });
    if (!imported || !imported.length) {
      ops.addBlock('htmlStage', {
        props: { bodyHtml: text, headCss: '', sourceName: name, editable: true },
        style: { w: '100%', minH: 900, overflow: 'auto' },
      });
    }
    doc.pageHtml = '';
    for (const b of (currentDoc().children || [])) b.locked = false;
    state.selection.clear();
    try { layers.setMode('files'); } catch (e) { void e; }
    repaint();
    interact.fit();
    emit('doc');
    emit('selection');
    notifyBlockCount();
    return true;
  } catch (e) {
    console.error('[openHtmlOnCanvas]', e);
    return false;
  }
}

function pickAsset(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept === 'model' ? '.glb,.gltf,.obj,.stl,.fbx' : accept === 'image' ? 'image/*' : accept === 'video' ? 'video/*' : accept === 'audio' ? 'audio/*' : '*';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    input.click();
  });
}

async function runCommand(id) {
  const ids = Array.from(state.selection);
  const block = ops.primary();

  switch (id) {
    case 'file.new': {
      // Keep existing page(s); create a fresh page in the project
      const current = currentDoc();
      // Persist current page into state.pages
      let page = state.pages.find((p) => p.id === state.pageId);
      if (!page) {
        page = { id: state.pageId || 'page1', name: current.name || 'Page 1', doc: current };
        state.pages = [page];
      } else {
        page.doc = current;
        page.name = current.name || page.name;
      }
      const n = state.pages.length + 1;
      const id = 'page' + n + '_' + Date.now().toString(36).slice(-4);
      const fresh = {
        version: 2,
        name: 'Page ' + n,
        canvas: { width: 1280, background: '#ffffff', mode: 'flow', minHeight: 720 },
        children: [],
        tokens: null,
        assets: [],
        pageJs: '',
      };
      state.pages.push({ id, name: fresh.name, doc: fresh });
      state.pageId = id;
      state.doc = fresh;
      state.selection.clear();
      state.ui.breakpoint = 'desktop';
      snapshot('New page');
      repaint();
      interact.fit();
      emit('selection');
      emit('doc');
      shell.buildToolstrip();
      shell.buildStatusbar();
      widgets.toast('New page created — previous pages kept in project', 'ok');
      break;
    }

    case 'file.open': {
      const ok = await project.loadFile();
      if (ok) {
        state.selection.clear();
        repaint();
        interact.fit();
        emit('selection');
        shell.buildToolstrip();
        widgets.toast('Project opened', 'ok');
      } else {
        widgets.toast('No project selected or invalid JSON', 'err');
      }
      break;
    }

    case 'file.save': {
      const saved = await project.saveFile();
      if (saved) {
        markClean();
        widgets.toast('Project downloaded as JSON — reopen anytime with Open', 'ok');
      } else {
        widgets.toast('Could not save project', 'err');
      }
      shell.buildStatusbar();
      break;
    }

    case 'file.library':
      panels.openLibraryPanel();
      break;

    case 'file.settings':
      panels.openSettingsPanel();
      break;
    case 'file.tokens':
      panels.openTokensPanel();
      break;

    case 'file.assets':
      panels.openAssetsPanel();
      break;

    case 'file.export':
      openExportModal();
      break;

    case 'file.zip':
      widgets.toast('Building ZIP…');
      exporter.downloadZip().then((name) => widgets.toast(name + ' saved', 'ok'));
      break;

    case 'file.preview':
      studio.openPreview(exporter.htmlBundle ? exporter.htmlBundle() : exporter.generate('html'));
      break;

    case 'file.clear':
      if (!host.confirmBox('Delete every block on this page?', 'Delete all', 'Cancel')) return;
      snapshot('Clear canvas');
      {
        const d = currentDoc();
        d.children = [];
        d.pageHtml = '';
        d.projectFiles = [];
      }
      state.selection.clear();
      repaint();
      emit('selection');
      emit('doc');
      break;

    case 'edit.undo':
      if (undo()) afterHistory();
      break;
    case 'edit.redo':
      if (redo()) afterHistory();
      break;
    case 'edit.duplicate':
      ops.duplicateBlocks();
      repaint();
      break;
    case 'edit.delete': {
      const gone = ops.removeBlocks();
      if (gone && gone.length) {
        repaint();
        emit('selection');
        emit('doc');
        widgets.toast('Deleted ' + gone.length + ' block(s)', 'ok');
      } else {
        widgets.toast('Nothing selected to delete', 'err');
      }
      break;
    }
    case 'edit.selectAll':
      ops.selectAll();
      emit('selection');
      break;
    case 'edit.find':
      openFind();
      break;
    case 'edit.copy': {
      const payload = blocks.copySelection();
      widgets.toast(payload ? payload.blocks.length + ' block(s) copied' : 'Nothing selected', payload ? 'ok' : 'err');
      break;
    }
    case 'edit.paste': {
      const made = blocks.pasteClipboard();
      repaint();
      emit('selection');
      widgets.toast(made && made.length ? made.length + ' block(s) pasted' : 'Clipboard is empty', made && made.length ? 'ok' : 'err');
      break;
    }
    case 'edit.blockActions':
      panels.openBlockActions();
      break;
    case 'edit.saveToLibrary': {
      const list = Array.from(state.selection).map((sid) => find(currentDoc(), sid)).filter(Boolean);
      if (!list.length) {
        widgets.toast('Nothing selected', 'err');
        break;
      }
      const name = window.prompt('Library name', list.length === 1 ? list[0].name || list[0].type : 'Block group');
      if (name == null) break;
      blocks.saveToLibrary(list, name);
      widgets.toast('Saved "' + name + '" to library', 'ok');
      break;
    }
    case 'edit.createComponent': {
      if (ids.length !== 1) {
        widgets.toast('Select exactly one block', 'err');
        break;
      }
      const src = find(currentDoc(), ids[0]);
      if (!src) break;
      const name = window.prompt('Component name', src.name || src.type || 'Component');
      if (name == null) break;
      const master = components.createFromSelection(src, name.trim() || 'Component');
      blocks.saveToLibrary([src], name.trim() || 'Component');
      repaint();
      widgets.toast(master ? ('Component "' + master.name + '" created — instances stay in sync') : 'Could not create', master ? 'ok' : 'err');
      break;
    }
    case 'edit.detachComponent': {
      if (!block) break;
      if (components.detachInstance(block)) {
        repaint();
        widgets.toast('Instance detached', 'ok');
      } else widgets.toast('Not a component instance', 'err');
      break;
    }
    case 'edit.syncComponent': {
      if (!block || !block.props || !block.props.__componentId) {
        widgets.toast('Select a component instance', 'err');
        break;
      }
      const n = components.syncInstances(block.props.__componentId);
      repaint();
      widgets.toast('Synced ' + n + ' instance(s)', 'ok');
      break;
    }
    case 'edit.copyStyle':
      state.clip = block ? { style: Object.assign({}, block.style), props: Object.assign({}, block.props) } : null;
      widgets.toast(block ? 'Style copied' : 'Nothing selected');
      break;
    case 'edit.pasteStyle':
      if (state.clip && block) {
        snapshot('Paste style');
        for (const k in state.clip.style) block.style[k] = state.clip.style[k];
        updateBlockNode(block);
        repaint();
      } else {
        widgets.toast('Copy a style first', 'err');
      }
      break;
    case 'edit.selectParent': {
      const doc = currentDoc();
      const p = block ? parentOf(doc, block.id) : null;
      if (!p) {
        widgets.toast('Already at page root', 'err');
        break;
      }
      ops.select(p.id);
      emit('selection');
      break;
    }
    case 'edit.selectChild': {
      if (!block || !(block.children || []).length) {
        widgets.toast('That block has no children', 'err');
        break;
      }
      ops.select(block.children[0].id);
      emit('selection');
      break;
    }

    case 'arr.up':
      if (block) ops.reorderRelative(block.id, 'up');
      repaint();
      break;
    case 'arr.down':
      if (block) ops.reorderRelative(block.id, 'down');
      repaint();
      break;
    case 'arr.front':
      if (block) ops.reorderTo(block.id, 'front');
      repaint();
      break;
    case 'arr.back':
      if (block) ops.reorderTo(block.id, 'back');
      repaint();
      break;
    case 'arr.nest': {
      if (ids.length !== 1) break;
      const doc = currentDoc();
      const src = find(doc, ids[0]);
      if (!src) break;
      const parent = parentOf(doc, ids[0]);
      if (!parent) {
        widgets.toast('Already at page root', 'err');
        break;
      }
      const list = parent.children || [];
      const idx = list.indexOf(src);
      let target = null;
      for (let i = idx - 1; i >= 0; i -= 1) {
        if (isContainer(list[i].type)) {
          target = list[i];
          break;
        }
      }
      if (!target) {
        widgets.toast('No container above this block', 'err');
        break;
      }
      ops.nest(src.id, target.id);
      repaint();
      break;
    }
    case 'arr.left': ops.align(ids, 'left'); repaint(); break;
    case 'arr.cx': ops.align(ids, 'center-x'); repaint(); break;
    case 'arr.right': ops.align(ids, 'right'); repaint(); break;
    case 'arr.top': ops.align(ids, 'top'); repaint(); break;
    case 'arr.cy': ops.align(ids, 'center-y'); repaint(); break;
    case 'arr.bottom': ops.align(ids, 'bottom'); repaint(); break;
    case 'arr.distH': ops.align(ids, 'distribute-h'); repaint(); break;
    case 'arr.distV': ops.align(ids, 'distribute-v'); repaint(); break;
    case 'arr.spaceH': ops.align(ids, 'space-h'); repaint(); break;
    case 'arr.spaceV': ops.align(ids, 'space-v'); repaint(); break;
    case 'arr.group': ops.groupSelection(); repaint(); emit('selection'); break;
    case 'arr.ungroup': ops.ungroupSelection(); repaint(); emit('selection'); break;
    case 'arr.unnest': if (block) { ops.unnest(block.id); repaint(); } break;
    case 'arr.wrap': wrapSelection(); repaint(); emit('selection'); break;

    case 'view.zoomIn': zoomBy(1.2); applyTransform(); emit('view'); break;
    case 'view.zoomOut': zoomBy(1 / 1.2); applyTransform(); emit('view'); break;
    case 'view.zoomReset': zoomReset(); applyTransform(); emit('view'); break;
    case 'view.zoom50': coords.setZoom(0.5); applyTransform(); emit('view'); break;
    case 'view.zoom200': coords.setZoom(2); applyTransform(); emit('view'); break;
    case 'view.fit': interact.fit(); emit('view'); break;
    case 'view.fitSel': interact.zoomFitSelection(); emit('view'); break;
    case 'view.grid': state.ui.grid = !state.ui.grid; emit('view'); shell.buildToolstrip(); break;
    case 'view.snap': state.ui.snap = !state.ui.snap; emit('view'); shell.buildToolstrip(); break;
    case 'view.guides': state.ui.guides = !state.ui.guides; guides.clear(); emit('view'); shell.buildToolstrip(); break;
    case 'view.preview': {
      if (state.ui.preview) {
        studio.closePreview();
      } else {
        const html = typeof exporter.htmlBundle === 'function' ? exporter.htmlBundle() : exporter.generate('html');
        studio.openPreview(html);
      }
      shell.buildToolstrip();
      emit('view');
      break;
    }
    case 'view.theme': toggleTheme(); break;
    case 'view.flow':
      ops.setCanvasMode('flow');
      repaint();
      interact.fit();
      shell.buildToolstrip();
      break;
    case 'view.free':
      ops.setCanvasMode('free');
      repaint();
      interact.fit();
      shell.buildToolstrip();
      break;
    case 'view.help':
      panels.openHelpPanel();
      break;

    case 'ins.heading': ops.addBlock('heading'); repaint(); break;
    case 'ins.paragraph': ops.addBlock('paragraph'); repaint(); break;
    case 'ins.button': ops.addBlock('button'); repaint(); break;
    case 'ins.image': ops.addBlock('image'); repaint(); break;
    case 'ins.frame': ops.addBlock('frame'); repaint(); break;
    case 'ins.section': ops.addBlock('section'); repaint(); break;
    case 'ins.columns': ops.addBlock('columns'); repaint(); break;
    case 'ins.card': ops.addBlock('card'); repaint(); break;
    case 'ins.hero': ops.addBlock('hero'); repaint(); break;
    case 'ins.features': ops.addBlock('features'); repaint(); break;
    case 'ins.pricingSection': ops.addBlock('pricingSection'); repaint(); break;
    case 'ins.testimonialsSection': ops.addBlock('testimonialsSection'); repaint(); break;
    case 'ins.faqSection': ops.addBlock('faqSection'); repaint(); break;
    case 'ins.contactSection': ops.addBlock('contactSection'); repaint(); break;
    case 'ins.ctaBanner': ops.addBlock('ctaBanner'); repaint(); break;
    case 'ins.footer': ops.addBlock('footer'); repaint(); break;
    case 'ins.three':
    case 'ins.three_scene':
    case 'ins.model3d': {
      const map = { 'ins.three': 'three_box', 'ins.three_scene': 'three_scene', 'ins.model3d': 'model3d' };
      const type = map[id] || 'three_box';
      const made = ops.addBlock(type);
      if (made && type === 'model3d') {
        try {
          const picked = await pickModelFile();
          if (picked) {
            ops.setProp(made.id, 'src', picked.src);
            ops.setProp(made.id, 'srcName', picked.name);
            if (picked.companions) ops.setProp(made.id, 'companions', picked.companions);
            widgets.toast('Model loaded: ' + picked.name + (picked.companions && picked.companions.mtl ? ' + materials' : ''), 'ok');
          }
        } catch (e) {
          console.error('[model pick]', e);
          widgets.toast('Could not open model picker', 'err');
        }
      }
      repaint();
      if (made) three.remount(made.id);
      break;
    }

    case 'three.box': ops.addBlock('three_box'); repaint(); break;
    case 'three.sphere': ops.addBlock('three_sphere'); repaint(); break;
    case 'three.torus': ops.addBlock('three_torus'); repaint(); break;
    case 'three.torusKnot': ops.addBlock('three_torusKnot'); repaint(); break;
    case 'three.cylinder': ops.addBlock('three_cylinder'); repaint(); break;
    case 'three.cone': ops.addBlock('three_cone'); repaint(); break;
    case 'three.capsule': ops.addBlock('three_capsule'); repaint(); break;
    case 'three.icosahedron': ops.addBlock('three_icosahedron'); repaint(); break;
    case 'three.ring': ops.addBlock('three_ring'); repaint(); break;
    case 'three.scene': ops.addBlock('three_scene'); repaint(); break;
    case 'three.model': {
      const made = ops.addBlock('model3d');
      if (made) {
        try {
          const picked = await pickModelFile();
          if (picked) {
            ops.setProp(made.id, 'src', picked.src);
            ops.setProp(made.id, 'srcName', picked.name);
            if (picked.companions) ops.setProp(made.id, 'companions', picked.companions);
            widgets.toast('Model loaded: ' + picked.name + (picked.companions && picked.companions.mtl ? ' + materials' : ''), 'ok');
          }
        } catch (e) {
          console.error('[model pick]', e);
          widgets.toast('Could not open model picker', 'err');
        }
      }
      repaint();
      if (made) three.remount(made.id);
      break;
    }
    case 'three.preset.studio':
    case 'three.preset.night':
    case 'three.preset.neon':
    case 'three.preset.daylight':
    case 'three.preset.clay':
    case 'three.preset.void': {
      if (!block || !isThreeType(block.type)) {
        widgets.toast('Select a 3D block first', 'err');
        break;
      }
      const preset = id.slice('three.preset.'.length);
      ops.setProp(block.id, 'preset', preset);
      repaint();
      widgets.toast('Environment: ' + preset, 'ok');
      break;
    }
    case 'three.toggleSpin':
      if (!block || !isThreeType(block.type)) {
        widgets.toast('Select a 3D block first', 'err');
        break;
      }
      ops.setProp(block.id, 'spin', !block.props.spin);
      repaint();
      break;
    case 'three.toggleScroll':
      if (!block || !isThreeType(block.type)) {
        widgets.toast('Select a 3D block first', 'err');
        break;
      }
      ops.setProp(block.id, 'scrollSpin', !block.props.scrollSpin);
      repaint();
      break;

    case 'studio.collab':
      studio.openCollab();
      break;
    case 'studio.timeline':
      studio.openTimeline();
      break;
    case 'studio.forms':
      studio.openForms();
      break;
    case 'studio.cms':
      studio.openCms();
      break;
    case 'studio.market':
      studio.openMarket();
      break;

    case 'dev.frameworks':
      devPanels.openFrameworkPanel();
      break;
    case 'dev.backend':
      devPanels.openBackendPanel();
      break;
    case 'dev.data':
      devPanels.openDataPanel();
      break;
    case 'dev.workspace':
      devPanels.openWorkspacePanel();
      break;

    default:
      break;
  }
}

function wrapSelection() {
  const ids = Array.from(state.selection);
  if (!ids.length) return;
  snapshot('Wrap in container');
  const doc = currentDoc();
  const frame = ops.addBlock('frame');
  if (!frame) return;
  const container = find(doc, frame.id);
  const kids = container.children;
  for (const id of ids) {
    const b = find(doc, id);
    if (!b) continue;
    const detached = ops.removeBlocks([id]);
    void detached;
  }
  for (const id of ids) {
    const b = find(doc, id);
    if (b && b.id !== frame.id) kids.push(b);
  }
}

function afterHistory() {
  guides.clear();
  repaint();
  emit('selection');
}

function openExportModal() {
  let format = 'html';
  widgets.openModal('Export', (body) => {
    body.classList.add('modal__body--flush');
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
    const bar = h('div', { style: { display: 'flex', gap: '6px', padding: '10px 12px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' } });
    for (const f of exporter.FORMATS) {
      const b = h('button', { class: 'chip' + (f.id === format ? ' is-on' : ''), type: 'button' }, f.label);
      b.addEventListener('click', () => {
        format = f.id;
        bar.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-on'));
        b.classList.add('is-on');
        code.textContent = exporter.generate(format);
      });
      bar.appendChild(b);
    }
    const code = h('pre', { class: 'code' });
    code.textContent = exporter.generate(format);

    const acts = h('div', { style: { display: 'flex', gap: '6px', padding: '10px 12px', borderTop: '1px solid var(--line)' } });
    const copyBtn = h('button', { class: 'tb-btn', type: 'button' }, 'Copy');
    copyBtn.addEventListener('click', () => {
      const text = code.textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      else host.clipboard(text);
      widgets.toast('Copied to clipboard', 'ok');
    });
    const dlBtn = h('button', { class: 'tb-btn tb-btn--primary', type: 'button' }, 'Download');
    dlBtn.addEventListener('click', () => {
      if (format === 'split') {
        exporter.downloadZip().then((name) => widgets.toast(name + ' saved', 'ok'));
      } else {
        exporter.downloadSingle(format).then((name) => widgets.toast(name + ' saved', 'ok'));
      }
    });
    const zipBtn = h('button', { class: 'tb-btn', type: 'button' }, 'ZIP');
    zipBtn.addEventListener('click', () => {
      exporter.downloadZip().then((name) => widgets.toast(name + ' saved', 'ok'));
    });
    acts.appendChild(copyBtn);
    acts.appendChild(zipBtn);
    acts.appendChild(dlBtn);

    wrap.appendChild(bar);
    wrap.appendChild(code);
    wrap.appendChild(acts);
    return wrap;
  }, []);
}

function openFind() {
  let results = [];
  widgets.openModal('Find block', (body) => {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const input = h('input', { type: 'search', placeholder: 'Search by type, label or text…', style: { padding: '9px 11px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--bg-2)', width: '100%' } });
    const list = h('div', { class: 'cardgrid' });
    const run = () => {
      const q = input.value.trim().toLowerCase();
      clear(list);
      results = [];
      if (!q) return;
      for (const entry of findAll(currentDoc())) {
        const def = getDef(entry.block.type);
        const label = (entry.block.name || (def && def.label) || entry.block.type);
        const text = String((entry.block.props || {}).text || '');
        const hay = (entry.block.type + ' ' + label + ' ' + text).toLowerCase();
        if (!hay.includes(q)) continue;
        results.push(entry.block.id);
        const b = h('button', { class: 'cardopt', type: 'button' }, [h('strong', {}, label), h('span', {}, entry.block.type)]);
        b.addEventListener('click', () => {
          ops.select(entry.block.id);
          interact.zoomFitSelection();
          widgets.closeModal();
          emit('selection');
        });
        list.appendChild(b);
      }
      if (!results.length) list.appendChild(h('div', { class: 'pal-empty' }, 'No matches'));
    };
    input.addEventListener('input', run);
    run();
    wrap.appendChild(input);
    wrap.appendChild(list);
    return wrap;
  }, []);
}

function installSplitters() {
  const wire = (splitterId, cssVar, min, max, invert) => {
    const splitter = document.getElementById(splitterId);
    if (!splitter) return;
    let startX = 0;
    let startVal = 0;
    const move = (ev) => {
      const delta = (ev.clientX - startX) * (invert ? -1 : 1);
      const next = Math.max(min, Math.min(max, startVal + delta));
      document.documentElement.style.setProperty(cssVar, next + 'px');
    };
    const up = () => {
      splitter.classList.remove('is-drag');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      applyTransform();
      measureAll();
      interact.paint();
    };
    splitter.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      startX = ev.clientX;
      startVal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(cssVar)) || (invert ? 312 : 264);
      splitter.classList.add('is-drag');
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  };
  wire('splitL', '--palette-w', 180, 520, false);
  wire('splitR', '--inspector-w', 220, 620, true);
}

function installKeys() {
  window.addEventListener('keydown', (ev) => {
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const mod = ev.ctrlKey || ev.metaKey;

    if (mod && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) { if (redo()) afterHistory(); } else if (undo()) afterHistory();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); if (redo()) afterHistory(); return; }
    if (mod && ev.key.toLowerCase() === 's') { ev.preventDefault(); runCommand('file.save'); return; }
    if (mod && ev.key.toLowerCase() === 'e') { ev.preventDefault(); openExportModal(); return; }
    if (mod && ev.key.toLowerCase() === 'o') { ev.preventDefault(); runCommand('file.open'); return; }
    if (mod && ev.key.toLowerCase() === 'd') { ev.preventDefault(); runCommand('edit.duplicate'); return; }
    if (mod && ev.key.toLowerCase() === 'a') { ev.preventDefault(); runCommand('edit.selectAll'); return; }
    if (mod && ev.key.toLowerCase() === 'f') { ev.preventDefault(); openFind(); return; }
    if (mod && ev.key.toLowerCase() === 'g') { ev.preventDefault(); runCommand('arr.group'); return; }
    if (mod && ev.key === ']') { ev.preventDefault(); runCommand('arr.up'); return; }
    if (mod && ev.key === '[') { ev.preventDefault(); runCommand('arr.down'); return; }
    if (mod && ev.key === '0') { ev.preventDefault(); zoomReset(); applyTransform(); emit('view'); return; }
    if (mod && ev.key === '1') { ev.preventDefault(); interact.fit(); emit('view'); return; }
    if (mod && ev.key === '2') { ev.preventDefault(); interact.zoomFitSelection(); emit('view'); return; }
    if (mod && (ev.key === '=' || ev.key === '+')) { ev.preventDefault(); zoomBy(1.2); applyTransform(); emit('view'); return; }
    if (mod && ev.key === '-') { ev.preventDefault(); zoomBy(1 / 1.2); applyTransform(); emit('view'); return; }
    if (mod && ev.key.toLowerCase() === 'p') { ev.preventDefault(); runCommand('view.preview'); return; }

    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (state.selection.size) { ev.preventDefault(); runCommand('edit.delete'); }
      return;
    }
    if (ev.key === 'Escape') {
      if (state.ui.isolateId) {
        interact.exitIsolation();
        return;
      }
      if (state.selection.size) { state.selection.clear(); emit('selection'); }
      return;
    }
    const step = ev.shiftKey ? 10 : 1;
    const nudge = {
      ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0],
    }[ev.key];
    if (nudge && state.selection.size) {
      ev.preventDefault();
      interact.nudge(nudge[0], nudge[1]);
    }
  });
}

function starterPage() {
  const doc = currentDoc();
  doc.canvas.width = 1440;
  doc.canvas.background = '#080d1a';
  doc.canvas.mode = 'flow';
  doc.name = 'نور — المنصة الإسلامية الشاملة';
  doc.pageHtml = NUR_FULL_HTML;
  /* The page is Arabic, so the exported document has to SAY so. Without
     lang/dir the export wrote <html lang="en"> and the whole layout came out
     left-to-right with the fonts it did not load - which is why the NUR design
     never looked like the NUR page. */
  doc.lang = 'ar';
  doc.dir = 'rtl';
  /* The technologies the NUR platform is built on. These are what make the
     design reproduce outside the builder, and they used to be thrown away:
     the exported page carried neither the fonts nor the icon set. The page's
     OWN stylesheet and its Tailwind script travel with it too - the design is
     produced by those utilities applied to the imported class names, so
     without them the page comes out as unstyled skeleton markup. */
  const assets = blocks.htmlAssets ? blocks.htmlAssets(NUR_FULL_HTML) : null;
  doc.head = {
    scripts: (assets && assets.scripts) || [],
    styles: (assets && assets.styles) || [],
    links: (assets && assets.links) || [],
    fonts: 'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@300;400;500;600;700;800;900&family=Scheherazade+New:wght@400;700&display=swap',
    iconCss: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    themeColor: '#080d1a',
    htmlClass: (assets && assets.htmlClass) || '',
  };
  doc.tokens = {
    color: {
      primary: '#10b981',
      secondary: '#080d1a',
      accent: '#f59e0b',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      surface: '#0f172a',
      surface2: '#1e293b',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      border: 'rgba(16,185,129,.25)',
    },
    font: {
      sans: 'Cairo, Tahoma, system-ui, sans-serif',
      display: 'Amiri, Georgia, serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    radius: { sm: 8, md: 14, lg: 22, xl: 28, full: 999 },
    space: { xs: 4, sm: 8, md: 16, lg: 28, xl: 48, '2xl': 88 },
    shadow: {
      sm: '0 2px 8px rgba(0,0,0,.35)',
      md: '0 16px 40px rgba(0,0,0,.45)',
      lg: '0 32px 80px rgba(0,0,0,.55)',
    },
  };

  doc.children = [];

  // Prefer full Nur HTML as native editable blocks (structure + text + styles + fonts)
  try {
    /* structure:true is the whole point of this call - the default is
       fidelity mode, which wraps the page in ONE htmlStage block. A starter
       page made of a single opaque box cannot be customised, saved as a block
       or developed, which is exactly what a starter page has to allow. */
    const imported = blocks.importHtmlString(NUR_FULL_HTML, { structure: true });
    if (imported && imported.length) {
      /* The platform's behaviour travels with the markup. Without this the
         starter exported as a beautiful but completely inert screenshot. */
      doc.pageJs = NUR_RUNTIME_JS;
      // Unlock everything so inspector / typography / drag work immediately
      const unlock = (list) => {
        for (const b of list || []) {
          b.locked = false;
          if (b.children && b.children.length) unlock(b.children);
        }
      };
      unlock(doc.children);
      state.selection.clear();
      emit('selection');
      return doc;
    }
  } catch (e) {
    console.warn('[starterPage] html import fallback', e);
  }

  // Fallback: hand-built native blocks if import produced nothing

  // —— شريط التنقل ——
  ops.addBlock('navbar', {
    props: {
      brand: 'نُور',
      brandEmoji: '🕋',
      brandLogo: '',
      links: 'المصحف, تلاوة, الحديث, الصلاة, السبحة',
      linkEmojis: '📖, 🎧, 📜, 🧭, 🤲',
      cta: 'المنصة الشاملة',
      ctaEmoji: '✦',
    },
    style: {
      display: 'flex', dir: 'row', justify: 'space-between', align: 'center',
      w: '100%', pT: 18, pR: 40, pB: 18, pL: 40,
      bg: 'rgba(15,23,42,0.92)', color: '#f1f5f9',
      borderW: 0, borderB: 1, borderColor: 'rgba(16,185,129,0.25)',
      radius: 0,
    },
  });

  // —— هيرو ——
  const hero = ops.addBlock('section', {
    style: {
      display: 'flex', dir: 'column', align: 'center', justify: 'center',
      w: '100%', gap: 16,
      pT: 72, pR: 48, pB: 56, pL: 48,
      bg: 'transparent', color: '#f1f5f9',
    },
  });
  if (hero) {
    ops.addBlock('label', {
      parentId: hero.id,
      props: { text: 'المنصة الإسلامية الشاملة' },
      style: {
        fontSize: 13, fontWeight: 800, letterSpacing: 2, textCase: 'uppercase',
        color: '#10b981', textAlign: 'center',
      },
    });
    ops.addBlock('heading', {
      parentId: hero.id,
      props: { text: 'نُور', tag: 'h1' },
      style: {
        fontSize: 72, fontWeight: 900, color: '#ffffff', textAlign: 'center',
        letterSpacing: -1, w: '100%',
        fontFamily: 'Amiri, Georgia, serif',
      },
    });
    ops.addBlock('paragraph', {
      parentId: hero.id,
      props: {
        text: 'المصحف الشريف • التلاوة • الأحاديث النبوية • مواقيت الصلاة • السبحة الإلكترونية — كل أدواتك الإيمانية في مكان واحد بتصميم راقٍ وواضح.',
      },
      style: {
        fontSize: 17, color: '#94a3b8', textAlign: 'center', lineHeight: 1.75,
        maxW: 720, w: '100%',
      },
    });
    const ctaRow = ops.addBlock('columns', {
      parentId: hero.id,
      style: {
        display: 'flex', dir: 'row', justify: 'center', align: 'center',
        gap: 12, w: '100%', pT: 12,
      },
    });
    if (ctaRow) {
      ops.addBlock('button', {
        parentId: ctaRow.id,
        props: { text: 'افتح المصحف', emoji: '📖' },
        style: {
          bg: '#059669', color: '#fff', fontWeight: 700, fontSize: 15,
          radius: 16, pT: 12, pR: 22, pB: 12, pL: 22,
        },
      });
      ops.addBlock('button', {
        parentId: ctaRow.id,
        props: { text: 'مواقيت الصلاة', emoji: '🧭' },
        style: {
          bg: 'transparent', color: '#fbbf24', fontWeight: 700, fontSize: 15,
          radius: 16, pT: 12, pR: 22, pB: 12, pL: 22,
          borderW: 1, borderColor: 'rgba(251,191,36,0.45)',
        },
      });
    }
  }

  // —— شبكة الأقسام ——
  const features = ops.addBlock('section', {
    style: {
      display: 'flex', dir: 'column', gap: 28, align: 'center',
      w: '100%', pT: 24, pR: 48, pB: 48, pL: 48,
      bg: 'transparent',
    },
  });
  if (features) {
    ops.addBlock('label', {
      parentId: features.id,
      props: { text: 'أقسام المنصة' },
      style: { fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#f59e0b', textAlign: 'center' },
    });
    ops.addBlock('heading', {
      parentId: features.id,
      props: { text: 'كل ما تحتاجه في رحلتك الإيمانية', tag: 'h2' },
      style: {
        fontSize: 32, fontWeight: 800, color: '#fff', textAlign: 'center',
        fontFamily: 'Amiri, Georgia, serif',
      },
    });

    const grid = ops.addBlock('columns', {
      parentId: features.id,
      style: { display: 'grid', gridCols: 3, gap: 18, w: '100%', pT: 8 },
    });
    if (grid) {
      const cards = [
        { t: 'المصحف الشريف', d: 'تصفح صفحات المصحف، انتقل للسورة أو الجزء، واحفظ موضع قراءتك.', e: '📖' },
        { t: 'تلاوة وسور', d: 'استمع لأشهر القراء واختر السورة والآيات بسهولة.', e: '🎧' },
        { t: 'الأحاديث النبوية', d: 'مجموعة مختارة من الأحاديث مع المصدر والراوي.', e: '📜' },
        { t: 'مواقيت الصلاة', d: 'أوقات الصلوات واتجاه القبلة حسب موقعك.', e: '🧭' },
        { t: 'السبحة الإلكترونية', d: 'عدّاد أذكار مع اهتزاز وتتبّع الهدف.', e: '🤲' },
        { t: 'وضع ليلي أنيق', d: 'واجهة داكنة مريحة للعين بألوان الزمرد والذهب.', e: '🌙' },
      ];
      for (const c of cards) {
        const card = ops.addBlock('frame', {
          parentId: grid.id,
          style: {
            display: 'flex', dir: 'column', gap: 12, flex: 1,
            pT: 24, pR: 22, pB: 24, pL: 22, radius: 20, minH: 160,
            bg: 'rgba(30,41,59,0.75)', borderW: 1, borderColor: 'rgba(16,185,129,0.22)',
          },
        });
        if (card) {
          ops.addBlock('label', {
            parentId: card.id,
            props: { text: c.e + '  قسم' },
            style: { fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#10b981' },
          });
          ops.addBlock('heading', {
            parentId: card.id,
            props: { text: c.t, tag: 'h3' },
            style: { fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'Cairo, sans-serif' },
          });
          ops.addBlock('paragraph', {
            parentId: card.id,
            props: { text: c.d },
            style: { fontSize: 14, color: '#94a3b8', lineHeight: 1.65 },
          });
        }
      }
    }
  }

  // —— قسم المصحف (قابل للتعديل) ——
  const moshaf = ops.addBlock('section', {
    style: {
      display: 'flex', dir: 'column', gap: 20, align: 'center',
      w: '100%', pT: 40, pR: 48, pB: 48, pL: 48,
      bg: '#0f172a',
    },
  });
  if (moshaf) {
    ops.addBlock('label', {
      parentId: moshaf.id,
      props: { text: 'المصحف الشريف' },
      style: { fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#10b981', textAlign: 'center' },
    });
    ops.addBlock('heading', {
      parentId: moshaf.id,
      props: { text: 'اقرأ من مصحف واضح ومرتب', tag: 'h2' },
      style: {
        fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center',
        fontFamily: 'Amiri, Georgia, serif',
      },
    });
    ops.addBlock('paragraph', {
      parentId: moshaf.id,
      props: {
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ',
      },
      style: {
        fontSize: 26, color: '#e2e8f0', textAlign: 'center', lineHeight: 2.2,
        fontFamily: 'Amiri, Scheherazade New, serif', maxW: 900, w: '100%',
        pT: 20, pR: 28, pB: 20, pL: 28, radius: 18,
        bg: 'rgba(15,23,42,0.9)', borderW: 1, borderColor: 'rgba(16,185,129,0.2)',
      },
    });
  }

  // —— حديث ——
  const hadith = ops.addBlock('section', {
    style: {
      display: 'flex', dir: 'column', gap: 18, align: 'center',
      w: '100%', pT: 40, pR: 48, pB: 40, pL: 48,
      bg: 'transparent',
    },
  });
  if (hadith) {
    ops.addBlock('label', {
      parentId: hadith.id,
      props: { text: 'حديث اليوم' },
      style: { fontSize: 12, fontWeight: 800, letterSpacing: 2, color: '#f59e0b', textAlign: 'center' },
    });
    const hCard = ops.addBlock('frame', {
      parentId: hadith.id,
      style: {
        display: 'flex', dir: 'column', gap: 14, align: 'center',
        w: '100%', maxW: 820, pT: 28, pR: 32, pB: 28, pL: 32, radius: 22,
        bg: 'rgba(30,41,59,0.8)', borderW: 1, borderColor: 'rgba(245,158,11,0.28)',
      },
    });
    if (hCard) {
      ops.addBlock('paragraph', {
        parentId: hCard.id,
        props: { text: '« إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى »' },
        style: {
          fontSize: 22, color: '#f8fafc', textAlign: 'center', lineHeight: 1.8,
          fontFamily: 'Amiri, Georgia, serif', fontWeight: 700,
        },
      });
      ops.addBlock('label', {
        parentId: hCard.id,
        props: { text: 'متفق عليه — عن عمر بن الخطاب رضي الله عنه' },
        style: { fontSize: 13, color: '#fbbf24', textAlign: 'center', fontWeight: 600 },
      });
    }
  }

  // —— تذييل ——
  ops.addBlock('footer', {
    props: {
      brand: 'نُور',
      columns: 'الأقسام|المصحف, التلاوة, الحديث\\nالعبادة|الصلاة, السبحة, الأذكار\\nحول|عن المنصة, تواصل',
      note: '© نور — المنصة الإسلامية الشاملة',
    },
    style: {
      display: 'flex', dir: 'column', gap: 20, w: '100%',
      pT: 40, pR: 48, pB: 32, pL: 48,
      bg: '#050b14', color: '#94a3b8',
      borderW: 0, borderT: 1, borderColor: 'rgba(16,185,129,0.2)',
    },
  });

  doc.pageJs = '';
  state.selection.clear();
  emit('selection');
  return doc;
}



function boot() {
  initTheme();
  widgets.initWidgets();
  menus.install();
  menus.buildMenus(MENUS);
  /* The JavaFX dock drives the page through window-level functions. */
  installDockBridge();

  const undoBtn = $('tbUndo');
  const redoBtn = $('tbRedo');
  undoBtn.addEventListener('click', () => { if (undo()) afterHistory(); });
  redoBtn.addEventListener('click', () => { if (redo()) afterHistory(); });
  $('tbTheme').addEventListener('click', () => toggleTheme());
  $('tbExport').addEventListener('click', () => openExportModal());

  palette.init();
  layers.init();
  inspector.init();
  shell.initShell();
  interact.install();
  installSplitters();
  installKeys();
  bindEvents();
  three.init();
  studio.install();
  studio.hookBus(on);
  project.startAutosaveLoop();
  /* Local-first workspace: autosave, snapshots and the activity log.
     A single user gets the safety net on their own; nobody has to be in the
     room for it to be useful. */
  workspace.init();

// The first paint happens with the STARTER page so the app is never blank,
  // then the autosave question is asked on top of a window that is already up.
  // This MUST NOT use window.confirm(): the preload turns it into a native
  // modal, and a native modal raised while the BrowserWindow is still hidden
  // deadlocks the app - the window the dialog hangs off never appears, so the
  // question can never be answered and the renderer never answers CDP again.
  // That is not theoretical: it wedged the renderer on every launch after the
  // first one, because an autosave exists exactly from the second launch on.
  const pendingAutosave = (() => {
    try { return project.loadAutosave(); } catch (e) { console.warn('[autosave]', e); return null; }
  })();

  if (!currentDoc().children || !currentDoc().children.length) {
    starterPage();
  }

  repaint();
  interact.fit();

  if (pendingAutosave && pendingAutosave.payload) {
    const ageMin = pendingAutosave.at ? Math.round((Date.now() - pendingAutosave.at) / 60000) : null;
    const p = pendingAutosave.payload;
    const label = (p.name || 'project') + (ageMin != null ? (' · ' + ageMin + ' min ago') : '');
    const pagesN = (p.pages && p.pages.length) || 1;
    setTimeout(() => {
      widgets.confirmDialog(
        'Restore autosaved work?',
        label + '\n' + pagesN + ' page(s)\n\nOK = restore the autosave, Cancel = start fresh.',
        'Restore', 'Start fresh'
      ).then((yes) => {
        if (!yes) { project.clearAutosave(); return; }
        project.loadPayload(p);
        repaint();
        interact.fit();
        shell.buildStatusbar();
        widgets.toast('Autosaved work restored', 'ok');
      });
    }, 120);
  }

  window.addEventListener('resize', debounce(() => {
    applyTransform();
    measureAll();
    interact.paint();
    shell.refreshContextbar();
  }, 90));

window.addEventListener('beforeunload', () => project.saveAutosave());

  /* The IDE can hand the builder a file to open. It used to be JSON only:
     an .html path was JSON.parsed, threw, and was swallowed - so the builder
     came up on the starter page and the user's file was nowhere in sight. */
  host.takeOpen().then((path) => {
    if (!path) return;
    host.readText(path).then((res) => {
      const content = res && (res.content || res);
      if (!content) return;
      const name = String(path);
      if (/\.html?$/i.test(name)) {
        if (openHtmlOnCanvas({ name: name.split(/[\\/]/).pop(), path: name, content: content })) {
          widgets.toast('Opened ' + name, 'ok');
        }
        return;
      }
      try {
        if (project.loadPayload(JSON.parse(content))) {
          repaint();
          interact.fit();
          emit('doc');
          emit('selection');
          widgets.toast('Opened ' + name, 'ok');
        }
      } catch (e) {
        void 0;
      }
    });
  });

  emit('history');
  widgets.toast(blockCount() + ' block types ready', 'ok');

  window.VB = {
    state,
    doc: currentDoc,
    add: ops.addBlock,
    select: ops.select,
    render: repaint,
    undo,
    redo,
    export: exporter.generate,
    save: project.saveFile,
    open: project.loadFile,
    /* Exposed so the HTML importer can be exercised directly instead of only
       through the UI - "the imported page came out empty" is otherwise very
       hard to tell apart from "the imported page looks fine". */
    importHtml: function (html, opts) { return blocks.importHtmlString(html, opts || {}); },
    starter: starterPage,
  };
  window.__vbReady = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}




