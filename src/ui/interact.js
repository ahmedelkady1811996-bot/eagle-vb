import * as guides from '../layout/guides.js';
import * as ops from '../model/ops.js';
import { state, currentDoc, find, begin, commit, parentOf, detach } from '../core/store.js';
import { emit } from '../core/bus.js';
import { clientToCanvas, setZoom, zoomBy, applyTransform, canvasEl, viewportEl } from '../layout/coords.js';
import { measureAll, rectOf, selectionBounds, hitTestAt } from '../layout/measure.js';
import { highlight as liveHighlight, isMounted as liveCanvasOn } from '../render/livecanvas.js';
import { renderCanvas, nodeFor, updateBlockNode } from '../render/canvas.js';
import { round } from '../core/util.js';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

let drag = null;
let spaceDown = false;
let overlay = null;
let marquee = null;
let hint = null;

export function overlayLayer() {
  if (overlay && overlay.isConnected) return overlay;
  overlay = document.getElementById('overlay');
  return overlay;
}

function stageLayerFn() {
  return document.getElementById('stage');
}

function ensureMarquee() {
  if (marquee && marquee.isConnected) return marquee;
  marquee = document.getElementById('marquee');
  if (!marquee) {
    marquee = document.createElement('div');
    marquee.id = 'marquee';
    stageLayerFn().appendChild(marquee);
  }
  return marquee;
}

function ensureHint() {
  if (hint && hint.isConnected) return hint;
  hint = document.getElementById('size-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'size-hint';
    stageLayerFn().appendChild(hint);
  }
  return hint;
}

function isFree() {
  const doc = currentDoc();
  return !!(doc.canvas && doc.canvas.mode === 'free');
}

/** True when block is a page-root child (parent is the document, which has no .id). */
function isTopLevel(id) {
  const doc = currentDoc();
  const parent = parentOf(doc, id);
  if (!parent) return true;
  // Document root has children but no block id
  if (!parent.id) return true;
  return false;
}

export function paint() {
  measureAll();
  const layer = overlayLayer();
  if (!layer) return;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  if (state.ui.preview) return;

  // Isolation mode: dim everything outside the focused container
  const root = canvasEl && canvasEl();
  const stage = document.getElementById('canvas') || (root);
  if (stage) {
    if (state.ui.isolateId) {
      stage.classList.add('is-isolating');
      stage.querySelectorAll('.vb-b').forEach((n) => {
        const id = n.dataset.id;
        const inside = id === state.ui.isolateId || isUnder(state.ui.isolateId, id);
        n.classList.toggle('is-dimmed', !inside);
        n.classList.toggle('is-isolate-root', id === state.ui.isolateId);
      });
    } else {
      stage.classList.remove('is-isolating');
      stage.querySelectorAll('.vb-b.is-dimmed, .vb-b.is-isolate-root').forEach((n) => {
        n.classList.remove('is-dimmed', 'is-isolate-root');
      });
    }
  }

  const ids = Array.from(state.selection);
  if (!ids.length) { try { liveHighlight(ids); } catch (e) { void e; } return; }
  const free = isFree();

  /* In the live canvas the page is its own document; the selection is drawn
     there as an outline over the real element, not as an editor box. */
  if (liveCanvasOn()) {
    try { liveHighlight(ids); } catch (e) { void e; }
    return;
  }

  for (const id of ids) {
    const r = rectOf(id);
    if (!r) continue;
    const box = document.createElement('div');
    box.className = 'sel' + (ids.length > 1 ? ' sel--multi' : '');
    box.style.left = r.x + 'px';
    box.style.top = r.y + 'px';
    box.style.width = r.w + 'px';
    box.style.height = r.h + 'px';
    if (ids.length === 1) {
      for (const dir of HANDLES) {
        const g = document.createElement('div');
        g.className = 'handle handle--' + dir;
        g.dataset.dir = dir;
        box.appendChild(g);
      }
      if (free) {
        const rot = document.createElement('div');
        rot.className = 'handle handle--rot';
        rot.dataset.dir = 'rot';
        box.appendChild(rot);
      }
    }
    layer.appendChild(box);
  }
}

function showHint(x, y, text) {
  const el = ensureHint();
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.classList.add('is-on');
}

function hideHint() {
  const el = ensureHint();
  el.classList.remove('is-on');
}

export function fit() {
  const doc = currentDoc();
  const vp = viewportEl();
  if (!vp) return;
  const target = (doc.canvas && doc.canvas.width) || 1280;
  const padX = 64;
  const padY = 48;
  const availW = Math.max(200, vp.clientWidth - padX);
  const availH = Math.max(160, vp.clientHeight - padY);
  const minH = (doc.canvas && Number(doc.canvas.minHeight)) || 720;
  /* Fit the artboard into the viewport without over-zooming past 100%
     unless the board is much smaller than the viewport (mobile frame). */
  const zW = availW / Math.max(1, target);
  const zH = availH / Math.max(1, minH);
  const z = Math.min(1.15, Math.max(0.12, Math.min(zW, zH)));
  setZoom(z);
  /* Centre the scaled artboard in the viewport. */
  const stageW = target * z;
  const stageH = Math.max(minH, 200) * z;
  state.ui.panX = Math.round((vp.clientWidth - stageW) / 2);
  state.ui.panY = Math.round(Math.max(20, (vp.clientHeight - stageH) / 5));
  applyTransform();
  emit('view');
}

export function zoomFitSelection() {
  const b = selectionBounds(Array.from(state.selection));
  const vp = viewportEl();
  if (!b || !vp) return;
  const z = Math.max(0.15, Math.min(2.5, Math.min((vp.clientWidth - 80) / Math.max(40, b.w), (vp.clientHeight - 80) / Math.max(40, b.h))));
  setZoom(z);
  state.ui.panX = vp.clientWidth / 2 - (b.x + b.w / 2) * z;
  state.ui.panY = vp.clientHeight / 2 - (b.y + b.h / 2) * z;
  applyTransform();
  emit('view');
}

function editableTarget(id) {
  const b = find(currentDoc(), id);
  if (!b || b.locked) return null;
  return b;
}

function onPointerDown(ev) {
  if (state.ui.preview) return;
  if (ev.button === 1 || spaceDown) {
    startPan(ev);
    return;
  }
  if (ev.button !== 0) return;
  const canvas = canvasEl();
  if (!canvas) return;

  const handle = ev.target instanceof Element ? ev.target.closest('.handle') : null;
  if (handle) {
    ev.preventDefault();
    ev.stopPropagation();
    const sel = Array.from(state.selection);
    if (sel.length !== 1) return;
    const dir = handle.dataset.dir;
    if (dir === 'rot') startRotate(ev, sel[0]);
    else startResize(ev, sel[0], dir);
    return;
  }

  const node = ev.target instanceof Element ? ev.target.closest('.vb-b') : null;
  let id = node ? node.dataset.id : null;

  // Alt / Option click → select parent container (edit structure as a unit)
  if (id && ev.altKey) {
    const parent = parentOf(currentDoc(), id);
    if (parent) id = parent.id;
  }

  if (!id) {
    const p = clientToCanvas(ev.clientX, ev.clientY);
    const hit = hitTestAt(p.x, p.y);
    if (hit) {
      ops.select(hit, ev.shiftKey || ev.metaKey || ev.ctrlKey);
      emit('selection');
      paint();
      startDrag(ev);
      return;
    }
    startMarquee(ev);
    return;
  }

  const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey;
  if (!state.selection.has(id)) ops.select(id, additive);
  else if (additive) ops.select(id, true);
  emit('selection');
  paint();

  if (isTextTarget(ev.target)) {
    if (ev.detail >= 2) startTextEdit(ev.target, id);
    return;
  }

  // Double-click a container → isolation mode (edit nested pieces only)
  if (ev.detail >= 2) {
    const block = find(currentDoc(), id);
    if (block && (block.type === 'htmlStage' || block.type === 'htmlEmbed')) {
      startHtmlStageEdit(id, ev.target);
      return;
    }
    if (block && (block.children || []).length) {
      state.ui.isolateId = id;
      emit('view');
      emit('selection');
      paint();
      return;
    }
    // Double-click text-like blocks → inline edit
    if (block && block.props && (block.props.text != null || block.props.title != null)) {
      const node = nodeFor(id);
      const content = node && (node.querySelector('.vb-c') || node);
      if (content) startTextEdit(content, id);
      return;
    }
  }

  startDrag(ev);
}

/** Inline-edit imported HTML stage: contenteditable + write-back to props.bodyHtml / html */
function startHtmlStageEdit(id, clickTarget) {
  const block = editableTarget(id);
  if (!block) return;
  const root = nodeFor(id);
  if (!root) return;
  const stage = root.querySelector('.vb-html-stage') || root.querySelector('.vb-c') || root;
  if (!stage) return;

  // Prefer editing the deepest text element under the cursor
  let target = clickTarget instanceof Element ? clickTarget : stage;
  if (!stage.contains(target)) target = stage;
  const editable = target.closest('p,h1,h2,h3,h4,h5,h6,span,a,li,td,th,label,button,div') || stage;

  const original = editable.innerHTML;
  editable.contentEditable = 'true';
  editable.style.outline = '2px solid var(--accent, #6366f1)';
  editable.style.outlineOffset = '2px';
  try {
    editable.focus();
    const sel = window.getSelection && window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch (e) {
    void e;
  }

  const finish = (save) => {
    editable.contentEditable = 'false';
    editable.style.outline = '';
    editable.style.outlineOffset = '';
    if (!save) {
      editable.innerHTML = original;
      renderCanvas();
      return;
    }
    // Persist whole stage HTML back into the block props
    const stageNow = root.querySelector('.vb-html-stage') || root.querySelector('.vb-c') || root;
    begin('Edit imported HTML');
    if (block.type === 'htmlStage') {
      // Prefer the stage's own HTML (without the outer vb-html-stage chrome)
      const clone = stageNow.cloneNode(true);
      clone.querySelectorAll('style[data-vb-stage]').forEach((n) => n.remove());
      block.props.bodyHtml = clone.innerHTML;
    } else {
      block.props.html = stageNow.innerHTML;
    }
    // Keep pageHtml in sync for any legacy readers
    try {
      const doc = currentDoc();
      if (doc.children && doc.children.length === 1 && doc.children[0].id === block.id) {
        doc.pageHtml = '';
      }
    } catch (e) {
      void e;
    }
    commit();
    emit('doc');
    renderCanvas();
  };

  const onBlur = () => finish(true);
  editable.addEventListener('blur', onBlur, { once: true });
  editable.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      editable.removeEventListener('blur', onBlur);
      finish(false);
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      editable.blur();
    }
    e.stopPropagation();
  });
}

export function exitIsolation() {
  if (!state.ui.isolateId) return;
  state.ui.isolateId = null;
  emit('view');
  paint();
}

function isUnder(ancestorId, id) {
  if (!ancestorId || !id) return false;
  if (ancestorId === id) return true;
  const doc = currentDoc();
  let cur = parentOf(doc, id);
  while (cur && cur.id) {
    if (cur.id === ancestorId) return true;
    cur = parentOf(doc, cur.id);
  }
  return false;
}

function isTextTarget(target) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'BUTTON' || tag === 'A') return false;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function startTextEdit(target, id) {
  const block = editableTarget(id);
  if (!block) return;
  const content = target.closest('.vb-c') || target;
  if (!content) return;
  const original = content.textContent;
  content.contentEditable = 'true';
  content.style.outline = '2px solid var(--accent)';
  content.focus();
  const finish = (save) => {
    content.contentEditable = 'false';
    content.style.outline = '';
    const next = content.textContent;
    if (save && next !== original) {
      begin('Edit text');
      block.props.text = next;
      if (block.props.title != null && !block.props.text) block.props.title = next;
      commit();
      emit('doc');
    } else {
      renderCanvas();
    }
  };
  content.addEventListener('blur', () => finish(true), { once: true });
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      content.textContent = original;
      finish(false);
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      content.blur();
    }
    e.stopPropagation();
  });
}

function startPan(ev) {
  ev.preventDefault();
  const startX = ev.clientX;
  const startY = ev.clientY;
  const baseX = state.ui.panX;
  const baseY = state.ui.panY;
  const move = (e) => {
    state.ui.panX = baseX + (e.clientX - startX);
    state.ui.panY = baseY + (e.clientY - startY);
    applyTransform();
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    document.body.classList.remove('is-panning');
  };
  document.body.classList.add('is-panning');
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

/**
 * Canvas point (x,y) in the coordinate space an absolutely positioned child of
 * `parentId` actually lives in.
 *
 * `styleToCss` writes `left`/`top` for pos:absolute, and those are resolved
 * against the nearest POSITIONED ancestor - not against the canvas. A nested
 * block that was dragged therefore used to keep a canvas-absolute number and
 * jumped by the parent's offset the moment it was dropped. In free mode every
 * block is absolute, so this is the difference between a block landing where it
 * was dropped and landing somewhere else entirely.
 */
function parentOrigin(parentId) {
  const doc = currentDoc();
  if (!parentId) return { x: 0, y: 0 };
  const canvasElNow = canvasEl();
  if (!canvasElNow) return { x: 0, y: 0 };
  const cr = canvasElNow.getBoundingClientRect();
  const z = state.ui.zoom || 1;
  let el = nodeFor(parentId);
  // skip ancestors that are not actually positioned
  while (el) {
    const pos = getComputedStyle(el).position;
    if (pos === 'absolute' || pos === 'fixed' || pos === 'relative') break;
    el = el.parentElement && el.parentElement.closest ? el.parentElement.closest('.vb-b') : null;
  }
  if (!el) return { x: 0, y: 0 };
  const pr = el.getBoundingClientRect();
  return { x: (pr.left - cr.left) / z, y: (pr.top - cr.top) / z };
}

function promoteToArtboard(id) {
  const d = currentDoc();
  const b = find(d, id);
  const parent = parentOf(d, id);
  if (!b || !parent) return false;
  const r = rectOf(id);
  try { detach(d, id); } catch (e) { return false; }
  d.children = d.children || [];
  d.children.push(b);
  b.style = b.style || {};
  b.style.pos = 'absolute';
  if (r) {
    b.style.x = Math.round(r.x);
    b.style.y = Math.round(r.y);
    if (b.style.w == null || b.style.w === '' || b.style.w === '100%') b.style.w = Math.round(r.w);
    if (b.style.h == null || b.style.h === '') b.style.h = Math.round(r.h);
  }
  return true;
}

function startDrag(ev) {
  const ids = Array.from(state.selection).filter((id) => editableTarget(id));
  if (!ids.length) return;
  const start = clientToCanvas(ev.clientX, ev.clientY);
  const free = isFree();
  const rootMove = !!free;

  if (rootMove) {
    for (const id of ids) {
      const parent = parentOf(currentDoc(), id);
      if (parent) promoteToArtboard(id);
    }
    try { renderCanvas(); measureAll(); } catch (e) { void e; }
  }

  const origins = ids.map((id) => {
    const b = find(currentDoc(), id);
    const r = rectOf(id);
    const po = rootMove ? { x: 0, y: 0 } : parentOrigin(parentOf(currentDoc(), id) ? parentOf(currentDoc(), id).id : null);
    const hasXY = b.style.pos === 'absolute' && b.style.x != null;
    const x = hasXY ? po.x + (Number(b.style.x) || 0) : (r ? r.x : 0);
    const y = hasXY ? po.y + (Number(b.style.y) || 0) : (r ? r.y : 0);
    return {
      id,
      x, y,
      ox: po.x, oy: po.y,
      hasXY,
      hadW: b.style.w != null && b.style.w !== '' && b.style.w !== '100%',
      hadH: b.style.h != null && b.style.h !== '',
      w: r ? r.w : Number(b.style.w) || 0,
      h: r ? r.h : Number(b.style.h) || 0,
    };
  });
  begin('Move');
  if (rootMove) {
    for (const origin of origins) {
      const b = find(currentDoc(), origin.id);
      if (!b) continue;
      b.style.pos = 'absolute';
      b.style.x = Math.round(origin.x - origin.ox);
      b.style.y = Math.round(origin.y - origin.oy);
      if (origin.hadW && origin.w) b.style.w = Math.round(origin.w);
      if (origin.hadH && origin.h) b.style.h = Math.round(origin.h);
    }
  }
  drag = {
    mode: 'drag',
    ids,
    start,
    origins,
    free: rootMove,
    flow: !rootMove,
    moved: false,
    flowId: null,
    flowBefore: true,
  };
}

function startResize(ev, id, dir) {
  const b = editableTarget(id);
  if (!b) return;
  const start = clientToCanvas(ev.clientX, ev.clientY);
  const r = rectOf(id);
  if (!r) return;
  const doc = currentDoc();
  const parent = parentOf(doc, id);
  const po = parentOrigin(parent ? parent.id : null);
  begin('Resize');
  drag = {
    mode: 'resize',
    ids: [id],
    start,
    dir,
    free: isFree(),
    /* x/y are kept in CANVAS space while dragging and converted back to the
       offset parent's space on write, exactly like startDrag does. */
    ox: po.x, oy: po.y,
    origin: {
      x: r.x,
      y: r.y,
      w: Number(b.style.w) || r.w,
      h: Number(b.style.h) || r.h,
    },
    moved: false,
  };
}

function startRotate(ev, id) {
  const b = editableTarget(id);
  if (!b) return;
  const r = rectOf(id);
  if (!r) return;
  const p = clientToCanvas(ev.clientX, ev.clientY);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const startAngle = Math.atan2(p.y - cy, p.x - cx);
  const current = b.style.transform && /rotate\(([-\d.]+)deg\)/.exec(b.style.transform);
  begin('Rotate');
  drag = {
    mode: 'rotate',
    ids: [id],
    cx, cy, startAngle,
    base: current ? Number(current[1]) : 0,
    moved: false,
  };
}

function startMarquee(ev) {
  const start = clientToCanvas(ev.clientX, ev.clientY);
  const base = new Set(ev.shiftKey ? Array.from(state.selection) : []);
  const el = ensureMarquee();
  el.classList.add('is-on');
  drag = { mode: 'marquee', start, base, moved: false };
  const paintBox = (x, y) => {
    el.style.left = Math.min(start.x, x) + 'px';
    el.style.top = Math.min(start.y, y) + 'px';
    el.style.width = Math.abs(x - start.x) + 'px';
    el.style.height = Math.abs(y - start.y) + 'px';
  };
  paintBox(start.x, start.y);
  const move = (e) => {
    const p = clientToCanvas(e.clientX, e.clientY);
    paintBox(p.x, p.y);
    drag.moved = true;
    const left = Math.min(start.x, p.x);
    const top = Math.min(start.y, p.y);
    const right = Math.max(start.x, p.x);
    const bottom = Math.max(start.y, p.y);
    const next = new Set(base);
    for (const [id, r] of measureAll()) {
      if (r.x + r.w >= left && r.x <= right && r.y + r.h >= top && r.y <= bottom) next.add(id);
    }
    state.selection = next;
    emit('selection');
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    el.classList.remove('is-on');
    if (!drag.moved && !ev.shiftKey) {
      state.selection = new Set();
      emit('selection');
    }
    drag = null;
    paint();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

export function install() {
  const vp = viewportEl();
  if (!vp) return;

  ensureArtboardEdges(vp);
  ensureEdgeZoom(vp);

  vp.addEventListener('mousedown', (ev) => {
    const t = ev.target instanceof Element ? ev.target : null;
    if (t && t.closest('#contextbar, #vb-preview, .modal, #ctxmenu, .edge-zoom, .artboard-edge')) return;
    /* In the live canvas the page is drawn inside an iframe and a transparent
       hit box sits over every block. Clicking one selects that block, which
       is what makes "edit what you see" work. */
    if (t && t.dataset && t.dataset.vbLiveId) {
      ev.preventDefault();
      ops.select(t.dataset.vbLiveId, ev.shiftKey || ev.metaKey || ev.ctrlKey);
      emit('selection');
      paint();
      try { liveHighlight(state.selection); } catch (e) { void e; }
      return;
    }
    if (t && t.closest('.handle')) {
      onPointerDown(ev);
      return;
    }
    onPointerDown(ev);
  });

  window.addEventListener('mousemove', onGlobalMove);
  window.addEventListener('mouseup', onGlobalUp);

  vp.addEventListener('wheel', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    zoomBy(ev.deltaY < 0 ? 1.08 : 1 / 1.08, ev.clientX, ev.clientY);
    applyTransform();
    emit('view');
  }, { passive: false });

  vp.addEventListener('dblclick', (ev) => {
    const node = ev.target instanceof Element ? ev.target.closest('.vb-b') : null;
    if (!node) return;
    const content = node.querySelector(':scope > .vb-c');
    if (content) startTextEdit(content, node.dataset.id);
  });

  vp.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const node = ev.target instanceof Element ? ev.target.closest('.vb-b') : null;
    if (node && node.dataset.id) {
      if (!state.selection.has(node.dataset.id)) {
        ops.select(node.dataset.id);
        emit('selection');
      }
      paint();
    }
    showContextMenu(ev.clientX, ev.clientY, !!node);
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' && !isTyping(ev)) {
      spaceDown = true;
      document.body.classList.add('is-panning-ready');
    }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.code === 'Space') {
      spaceDown = false;
      document.body.classList.remove('is-panning-ready');
    }
  });
}

/** Floating zoom controls on the viewport edge. */
function ensureEdgeZoom(vp) {
  if (document.getElementById('edge-zoom')) return;
  const box = document.createElement('div');
  box.id = 'edge-zoom';
  box.className = 'edge-zoom';
  box.innerHTML =
    '<button type="button" class="edge-zoom__btn" data-z="in" title="Zoom in">+</button>' +
    '<button type="button" class="edge-zoom__btn" data-z="out" title="Zoom out">−</button>' +
    '<button type="button" class="edge-zoom__btn" data-z="fit" title="Fit canvas">⤢</button>';
  vp.appendChild(box);
  box.addEventListener('click', (ev) => {
    const btn = ev.target instanceof Element ? ev.target.closest('[data-z]') : null;
    if (!btn) return;
    const z = btn.getAttribute('data-z');
    if (z === 'in') {
      zoomBy(1.15);
      applyTransform();
      emit('view');
    } else if (z === 'out') {
      zoomBy(1 / 1.15);
      applyTransform();
      emit('view');
    } else if (z === 'fit') {
      fit();
    }
  });
}

/**
 * Artboard edge handles: drag left/right edges of the canvas to change width.
 */
function ensureArtboardEdges(vp) {
  if (document.getElementById('artboard-edges')) return;
  const wrap = document.createElement('div');
  wrap.id = 'artboard-edges';
  wrap.innerHTML =
    '<div class="artboard-edge artboard-edge--w" data-side="w" title="Drag to resize artboard width">' +
      '<span class="artboard-edge__arrow">◀</span></div>' +
    '<div class="artboard-edge artboard-edge--e" data-side="e" title="Drag to resize artboard width">' +
      '<span class="artboard-edge__arrow">▶</span></div>';
  vp.appendChild(wrap);

  let resizing = null;
  wrap.addEventListener('mousedown', (ev) => {
    const edge = ev.target instanceof Element ? ev.target.closest('.artboard-edge') : null;
    if (!edge) return;
    ev.preventDefault();
    ev.stopPropagation();
    const doc = currentDoc();
    const startW = (doc.canvas && Number(doc.canvas.width)) || 1280;
    resizing = { startW, startX: ev.clientX, side: edge.getAttribute('data-side') };
    document.body.classList.add('is-resizing-artboard');
  });
  window.addEventListener('mousemove', (ev) => {
    if (!resizing) return;
    const dx = ev.clientX - resizing.startX;
    const z = state.ui.zoom || 1;
    let next = resizing.side === 'e'
      ? resizing.startW + dx / z
      : resizing.startW - dx / z;
    next = Math.round(Math.max(320, Math.min(2560, next)));
    const doc = currentDoc();
    const prev = (doc.canvas && Number(doc.canvas.width)) || 1280;
    if (next === prev) return;
    ops.adaptToCanvasWidth(prev, next);
    if (next <= 480) state.ui.breakpoint = 'mobile';
    else if (next <= 960) state.ui.breakpoint = 'tablet';
    else state.ui.breakpoint = 'desktop';
    applyTransform();
    emit('doc');
    emit('view');
  });
  window.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = null;
    document.body.classList.remove('is-resizing-artboard');
  });

  const syncEdges = () => {
    const canvas = canvasEl();
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const vpR = vp.getBoundingClientRect();
    const left = r.left - vpR.left + vp.scrollLeft;
    const right = r.right - vpR.left + vp.scrollLeft;
    const top = r.top - vpR.top + vp.scrollTop;
    const h = r.height;
    const west = wrap.querySelector('.artboard-edge--w');
    const east = wrap.querySelector('.artboard-edge--e');
    if (west) {
      west.style.left = (left - 14) + 'px';
      west.style.top = top + 'px';
      west.style.height = h + 'px';
    }
    if (east) {
      east.style.left = (right - 2) + 'px';
      east.style.top = top + 'px';
      east.style.height = h + 'px';
    }
  };
  window.addEventListener('resize', syncEdges);
  setInterval(syncEdges, 200);
  requestAnimationFrame(syncEdges);
}

function showContextMenu(clientX, clientY, onBlock) {
  let menu = document.getElementById('ctxmenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'ctxmenu';
    document.body.appendChild(menu);
  }
  const items = onBlock
    ? [
      { label: 'Duplicate', cmd: 'edit.duplicate' },
      { label: 'Delete', cmd: 'edit.delete' },
      { label: '—' },
      { label: 'Bring to front', cmd: 'arr.front' },
      { label: 'Send to back', cmd: 'arr.back' },
      { label: '—' },
      { label: 'Group', cmd: 'arr.group' },
      { label: 'Wrap in frame', cmd: 'arr.wrap' },
      { label: '—' },
      { label: 'Copy style', cmd: 'edit.copyStyle' },
      { label: 'Paste style', cmd: 'edit.pasteStyle' },
      { label: 'Save to library', cmd: 'edit.saveToLibrary' },
      { label: '—' },
      { label: 'Hide / Show', action: () => { ops.toggleHidden(); emit('doc'); } },
      { label: 'Lock / Unlock', action: () => { ops.toggleLock(); emit('doc'); } },
    ]
    : [
      { label: 'Paste', cmd: 'edit.paste' },
      { label: 'Select all', cmd: 'edit.selectAll' },
      { label: '—' },
      { label: 'Fit canvas', cmd: 'view.fit' },
      { label: 'Zoom 100%', cmd: 'view.zoomReset' },
      { label: 'Zoom in', cmd: 'view.zoomIn' },
      { label: 'Zoom out', cmd: 'view.zoomOut' },
      { label: '—' },
      { label: 'Preview', cmd: 'view.preview' },
      { label: 'New page', cmd: 'file.newPage' },
    ];

  menu.innerHTML = '';
  menu.className = 'ctxmenu is-on';
  for (const item of items) {
    if (item.label === '—') {
      const sep = document.createElement('div');
      sep.className = 'ctxmenu__sep';
      menu.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctxmenu__item';
    btn.textContent = item.label;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      menu.classList.remove('is-on');
      window.removeEventListener('mousedown', close, true);
      window.removeEventListener('keydown', close, true);
      try {
        if (item.action) item.action();
        else if (item.cmd) emit('command', item.cmd);
      } catch (err) {
        console.error('[ctxmenu]', err);
      }
    });
    menu.appendChild(btn);
  }
  const pad = 8;
  const mw = 200;
  const mh = menu.offsetHeight || 240;
  let x = clientX;
  let y = clientY;
  if (x + mw > window.innerWidth - pad) x = window.innerWidth - mw - pad;
  if (y + mh > window.innerHeight - pad) y = window.innerHeight - mh - pad;
  menu.style.left = Math.max(pad, x) + 'px';
  menu.style.top = Math.max(pad, y) + 'px';

  const close = (ev) => {
    if (ev.type === 'keydown' && ev.key !== 'Escape') return;
    // Don't close when clicking a menu item — let the item handler run first
    if (ev.type === 'mousedown' && menu.contains(ev.target)) return;
    menu.classList.remove('is-on');
    window.removeEventListener('mousedown', close, true);
    window.removeEventListener('keydown', close, true);
  };
  setTimeout(() => {
    window.addEventListener('mousedown', close, true);
    window.addEventListener('keydown', close, true);
  }, 0);
}

function isTyping(ev) {
  const t = ev.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function clearDropMarks() {
  document.querySelectorAll('.vb-drop-before,.vb-drop-after').forEach((el) => {
    el.classList.remove('vb-drop-before', 'vb-drop-after');
  });
}

function onGlobalMove(ev) {
  if (!drag || drag.mode === 'marquee') return;
  const grid = state.ui.snap ? (state.ui.gridSize || 8) : 0;

  if (drag.mode === 'drag') {
    const p = clientToCanvas(ev.clientX, ev.clientY);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;

    if (drag.flow) {
      placeFlowMarker(p);
      return;
    }

    const first = drag.origins[0];
    let nx = first.x + dx;
    let ny = first.y + dy;
    if (grid) {
      nx = round(nx, grid);
      ny = round(ny, grid);
    }
    const snap = state.ui.guides ? guides.snapMove(first.id, { x: nx, y: ny }, drag.ids) : { dx: 0, dy: 0 };
    const fdx = nx + (snap.dx || 0) - first.x;
    const fdy = ny + (snap.dy || 0) - first.y;
    const canvasW = (currentDoc().canvas && Number(currentDoc().canvas.width)) || 1280;
    for (const origin of drag.origins) {
      const b = find(currentDoc(), origin.id);
      if (!b) continue;
      b.style.pos = 'absolute';
      let nx2 = Math.round(origin.x + fdx - origin.ox);
      let ny2 = Math.round(origin.y + fdy - origin.oy);
      // Keep the block inside the current artboard width (device size)
      const bw = origin.hadW ? (origin.w || Number(b.style.w) || 0) : 0;
      const span = (origin.ox || 0) + canvasW;
      if (bw > 0) nx2 = Math.max(0, Math.min(nx2, Math.max(0, span - bw)));
      else nx2 = Math.max(-40, Math.min(nx2, span - 40));
      ny2 = Math.max(0, ny2);
      b.style.x = nx2;
      b.style.y = ny2;
      updateBlockNode(b);
    }
    syncFreeHeight();
    paint();
    showHint(first.x + fdx, first.y + fdy, Math.round(first.x + fdx) + ', ' + Math.round(first.y + fdy));
    return;
  }

  if (drag.mode === 'resize') {
    const p = clientToCanvas(ev.clientX, ev.clientY);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    drag.moved = true;
    const o = drag.origin;
    let x = o.x;
    let y = o.y;
    let w = o.w;
    let h = o.h;
    if (drag.dir.indexOf('e') >= 0) w = o.w + dx;
    if (drag.dir.indexOf('s') >= 0) h = o.h + dy;
    if (drag.dir.indexOf('w') >= 0) { w = o.w - dx; x = o.x + dx; }
    if (drag.dir.indexOf('n') >= 0) { h = o.h - dy; y = o.y + dy; }
    if (ev.shiftKey) {
      const ratio = o.w / Math.max(1, o.h);
      if (Math.abs(dx) > Math.abs(dy)) h = w / ratio;
      else w = h * ratio;
    }
    w = Math.max(32, grid ? round(w, grid) : w);
    h = Math.max(20, grid ? round(h, grid) : h);
    const b = find(currentDoc(), drag.ids[0]);
    if (b) {
      if (drag.free) {
        b.style.pos = 'absolute';
        b.style.x = Math.round(x - (drag.ox || 0));
        b.style.y = Math.round(y - (drag.oy || 0));
      }
      b.style.w = Math.round(w);
      b.style.h = Math.round(h);
      updateBlockNode(b);
    }
    paint();
    showHint(x + w, y + h, Math.round(w) + ' x ' + Math.round(h));
    return;
  }

  if (drag.mode === 'rotate') {
    const p = clientToCanvas(ev.clientX, ev.clientY);
    const angle = Math.atan2(p.y - drag.cy, p.x - drag.cx);
    let deg = drag.base + (angle - drag.startAngle) * 180 / Math.PI;
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
    deg = Math.round(deg);
    const b = find(currentDoc(), drag.ids[0]);
    if (b) {
      const prev = (b.style.transform || '').replace(/rotate\([-\d.]+deg\)/g, '').trim();
      b.style.transform = (prev + ' rotate(' + deg + 'deg)').trim();
      updateBlockNode(b);
    }
    drag.moved = true;
    paint();
    showHint(drag.cx, drag.cy - 28, deg + ' deg');
  }
}

function placeFlowMarker(p) {
  clearDropMarks();
  const doc = currentDoc();
  const id = drag.ids[0];
  const parent = parentOf(doc, id);
  const list = parent ? parent.children : doc.children;
  let best = null;
  let bestDist = Infinity;
  for (const block of list) {
    if (block.id === id) continue;
    const r = rectOf(block.id);
    if (!r) continue;
    const beforeDist = Math.abs(p.y - r.y);
    const afterDist = Math.abs(p.y - (r.y + r.h));
    if (beforeDist < bestDist) {
      bestDist = beforeDist;
      best = { id: block.id, before: true };
    }
    if (afterDist < bestDist) {
      bestDist = afterDist;
      best = { id: block.id, before: false };
    }
  }
  drag.flowId = best ? best.id : null;
  drag.flowBefore = best ? best.before : true;
  if (!best) return;
  const el = nodeFor(best.id);
  if (el) el.classList.add(best.before ? 'vb-drop-before' : 'vb-drop-after');
}

function applyFlowReorder(d) {
  if (!d.flowId) return;
  const doc = currentDoc();
  const id = d.ids[0];
  const parent = parentOf(doc, id);
  const list = parent ? parent.children : doc.children;
  const from = list.findIndex((b) => b.id === id);
  if (from < 0) return;
  const [item] = list.splice(from, 1);
  let to = list.findIndex((b) => b.id === d.flowId);
  if (to < 0) {
    list.push(item);
    return;
  }
  if (!d.flowBefore) to += 1;
  list.splice(to, 0, item);
}

function syncFreeHeight() {
  const doc = currentDoc();
  if (!doc.canvas || doc.canvas.mode !== 'free') return;
  let bottom = 720;
  for (const b of doc.children || []) {
    if ((b.style || {}).pos !== 'absolute') continue;
    bottom = Math.max(bottom, (Number(b.style.y) || 0) + (Number(b.style.h) || 140) + 72);
  }
  doc.canvas.minHeight = bottom;
}

function onGlobalUp() {
  if (!drag || drag.mode === 'marquee') return;
  const d = drag;
  drag = null;
  hideHint();
  guides.clear();
  clearDropMarks();
  if (d.moved && d.flow) applyFlowReorder(d);
  if (d.moved && d.free) syncFreeHeight();
  commit();
  if (d.moved) {
    renderCanvas();
    applyTransform();
    paint();
    emit('doc');
  }
  emit('selection');
}

export function nudge(dx, dy) {
  const ids = Array.from(state.selection);
  if (!ids.length) return;
  if (!isFree()) {
    const id = ids[0];
    if (dy < 0 || dx < 0) ops.reorderRelative(id, 'down');
    else ops.reorderRelative(id, 'up');
    renderCanvas();
    paint();
    return;
  }
  begin('Nudge');
  for (const id of ids) {
    const b = editableTarget(id);
    if (!b) continue;
    b.style.pos = 'absolute';
    b.style.x = (Number(b.style.x) || 0) + dx;
    b.style.y = (Number(b.style.y) || 0) + dy;
    updateBlockNode(b);
  }
  syncFreeHeight();
  commit();
  renderCanvas();
  applyTransform();
  paint();
}




export { zoomBy, setZoom, applyTransform };
