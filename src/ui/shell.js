import * as ops from '../model/ops.js';
import * as project from '../io/project.js';
import * as interact from './interact.js';
import { actionsFor } from '../model/compactions.js';
import { h, clear, $, icon } from '../core/dom.js';
import { state, currentDoc, canUndo, canRedo } from '../core/store.js';
import { emit, on } from '../core/bus.js';
import { zoom, applyTransform, viewportEl } from '../layout/coords.js';
import { selectionBounds } from '../layout/measure.js';
import { toast } from './widgets.js';
import { BREAKPOINTS, breakpointWidth, FONTS, FONT_WEIGHT } from '../model/options.js';

function chip(label, iconName, onClick, isOn) {
  const b = h('button', { class: 'chip' + (isOn ? ' is-on' : ''), type: 'button', title: label }, [
    iconName ? icon(iconName, 14) : null,
    h('span', {}, label),
  ]);
  b.addEventListener('click', onClick);
  return b;
}

export function buildToolstrip() {
  const host = $('toolstrip');
  if (!host) return;
  clear(host);

  const doc = currentDoc();
  const free = doc.canvas && doc.canvas.mode === 'free';

  host.appendChild(chip(free ? 'Free' : 'Flow', 'layout', () => {
    ops.setCanvasMode(free ? 'flow' : 'free');
    emit('doc');
    // Let the canvas re-render with the new mode before measuring / fitting
    requestAnimationFrame(() => {
      applyTransform();
      interact.fit();
      emit('view');
      buildToolstrip();
    });
  }, true));

  for (const bp of BREAKPOINTS) {
    host.appendChild(chip(bp.l, bp.v === 'desktop' ? 'desktop' : bp.v === 'tablet' ? 'tablet' : 'mobile', () => {
      const d = currentDoc();
      d.canvas = d.canvas || {};
      const prevW = Number(d.canvas.width) || 1280;
      const nextW = breakpointWidth(bp.v);
      if (prevW === nextW && state.ui.breakpoint === bp.v) return;
      state.ui.breakpoint = bp.v;
      // Adapt free-layout blocks to the new artboard width (sets canvas.width)
      ops.adaptToCanvasWidth(prevW, nextW);
      emit('doc');
      // Wait one frame so the DOM has the new width before measuring/fitting
      requestAnimationFrame(() => {
        applyTransform();
        interact.fit();
        emit('view');
        buildToolstrip();
        buildStatusbar();
      });
    }, state.ui.breakpoint === bp.v));
  }

  host.appendChild(h('span', { class: 'spacer' }));

  /* Live / Blocks canvas. A page imported from real HTML is styled by its own
     stylesheet, which the editor document does not have, so drawing its blocks
     natively shows an unstyled skeleton. Live renders the page itself. */
  host.appendChild(chip(state.ui.liveCanvas === false ? 'Blocks' : 'Live', 'eye', () => {
    state.ui.liveCanvas = state.ui.liveCanvas === false;
    emit('doc');
    emit('view');
    buildToolstrip();
  }, state.ui.liveCanvas !== false));
  host.appendChild(chip('Live view hints', 'help', () => {
    toast(state.ui.liveCanvas === false
      ? 'Blocks canvas: drag, resize and edit every block natively.'
      : 'Live canvas: the page renders exactly as a browser shows it. Click any element to select and edit it. Switch to "Blocks" for drag and resize.');
  }));

  host.appendChild(chip('Grid', 'grid', () => {
    state.ui.grid = !state.ui.grid;
    emit('view');
  }, state.ui.grid));

  host.appendChild(chip('Snap', 'magnet', () => {
    state.ui.snap = !state.ui.snap;
    emit('view');
  }, state.ui.snap));

  host.appendChild(chip('Guides', 'measure', () => {
    state.ui.guides = !state.ui.guides;
    emit('view');
  }, state.ui.guides));

  host.appendChild(chip(state.ui.preview ? 'Editing' : 'Preview', state.ui.preview ? 'eye' : 'eye-off', () => {
    emit('command', 'view.preview');
  }, !state.ui.preview));
}

export function buildStatusbar() {
  const host = $('statusbar');
  if (!host) return;
  clear(host);

  // Keep pages list in sync with current doc
  try { project.ensurePagesSynced(); } catch (e) { void e; }

  const doc = currentDoc();
  const count = (doc.children || []).length;
  const sel = state.selection.size;
  const primary = ops.primary();
  const pages = state.pages && state.pages.length
    ? state.pages
    : [{ id: state.pageId || 'page1', name: doc.name || 'Page 1' }];

  // ---- Page tabs (left) ----
  const tabs = h('div', { class: 'pagebar' });
  for (const page of pages) {
    const isOn = page.id === state.pageId;
    const tab = h('button', {
      class: 'pagebar__tab' + (isOn ? ' is-on' : ''),
      type: 'button',
      title: page.name || page.id,
    }, page.name || 'Page');
    tab.addEventListener('click', () => {
      if (project.switchPage(page.id)) {
        emit('command', 'view.fit');
        buildStatusbar();
        emit('doc');
      }
    });
    tab.addEventListener('dblclick', (ev) => {
      ev.preventDefault();
      const next = window.prompt('Rename page', page.name || 'Page');
      if (next != null && String(next).trim()) {
        project.renamePage(page.id, String(next).trim());
        buildStatusbar();
      }
    });
    tabs.appendChild(tab);
  }
  const addPage = h('button', { class: 'pagebar__add', type: 'button', title: 'New page' }, '+');
  addPage.addEventListener('click', () => emit('command', 'file.new'));
  tabs.appendChild(addPage);

  if (pages.length > 1) {
    const delPage = h('button', { class: 'pagebar__add', type: 'button', title: 'Delete current page' }, '×');
    delPage.addEventListener('click', () => {
      if (!window.confirm('Delete the current page?')) return;
      if (project.removePage(state.pageId)) {
        buildStatusbar();
        emit('doc');
      }
    });
    tabs.appendChild(delPage);
  }
  host.appendChild(tabs);

  host.appendChild(h('span', { class: 'pagebar__sep' }));

  host.appendChild(h('span', {}, ['Blocks ', h('b', {}, String(count))]));
  host.appendChild(h('span', {}, ['Selected ', h('b', {}, sel ? String(sel) : 'none')]));
  host.appendChild(h('span', {}, ['Type ', h('b', {}, primary ? primary.type : '—')]));

  const dot = h('span', { class: 'dot' + (state.dirty ? ' is-dirty' : ''), title: state.dirty ? 'Unsaved changes' : 'Saved' });
  host.appendChild(dot);
  host.appendChild(h('span', {}, [state.dirty ? 'Unsaved' : 'Saved']));

  host.appendChild(h('span', { class: 'spacer' }));

  const zoomWrap = h('span', { class: 'zoomctl' });
  const out = h('button', { class: 'tb-btn tb-btn--icon', type: 'button', title: 'Zoom out' }, '−');
  const val = h('button', { class: 'zoomctl__val', type: 'button', title: 'Reset zoom' }, Math.round(zoom() * 100) + '%');
  const inn = h('button', { class: 'tb-btn tb-btn--icon', type: 'button', title: 'Zoom in' }, '+');
  const fit = h('button', { class: 'tb-btn tb-btn--icon', type: 'button', title: 'Fit canvas' }, '⤢');

  out.addEventListener('click', () => {
    interact.zoomBy(1 / 1.2);
    applyTransform();
    emit('view');
  });
  inn.addEventListener('click', () => {
    interact.zoomBy(1.2);
    applyTransform();
    emit('view');
  });
  val.addEventListener('click', () => {
    interact.zoomReset();
    applyTransform();
    emit('view');
  });
  fit.addEventListener('click', () => {
    interact.fit();
    emit('view');
  });

  zoomWrap.appendChild(out);
  zoomWrap.appendChild(val);
  zoomWrap.appendChild(inn);
  zoomWrap.appendChild(fit);
  host.appendChild(zoomWrap);

  void canUndo;
  void canRedo;
  void BREAKPOINTS;
  void breakpointWidth;
}

function ctxBtn(label, iconName, title, onClick) {
  const b = h('button', { class: 'ctx-btn', type: 'button', title: title || label }, [
    iconName ? icon(iconName, 15) : null,
    label ? h('span', {}, label) : null,
  ]);
  b.addEventListener('click', onClick);
  return b;
}

export function buildContextbar() {
  const host = $('contextbar');
  if (!host) return;
  clear(host);

  if (state.ui.preview || !state.selection.size) {
    host.classList.remove('is-on');
    return;
  }

  const block = ops.primary();
  if (!block) {
    host.classList.remove('is-on');
    return;
  }

  host.appendChild(ctxBtn('', 'layers', 'Rename', () => {
    const name = window.prompt('Layer name', block.name || '');
    if (name != null) {
      ops.rename(block.id, name);
      emit('doc');
    }
  }));

  host.appendChild(h('span', { class: 'ctx-sep' }));

  const swatch = h('button', { class: 'ctx-swatch', type: 'button', title: 'Background colour' });
  swatch.style.background = block.style.bg || 'transparent';
  swatch.addEventListener('click', () => {
    emit('ctx:color', { anchor: swatch, block });
  });
  host.appendChild(swatch);

  host.appendChild(h('span', { class: 'ctx-sep' }));

  /* Component-specific actions. A table offers +Row / +Col / -Row / -Col, a
     tab strip offers +Tab / -Tab, a stepper offers Next / Prev - the same
     per-type section the legacy builder had, and the one that was missing. */
  const compActions = actionsFor(block.type);
  if (compActions && compActions.length) {
    for (const action of compActions) {
      const b = h('button', { class: 'ctx-btn ctx-btn--comp', type: 'button', title: action.title || action.label }, [
        action.icon ? icon(action.icon, 14) : null,
        h('span', {}, action.label),
      ]);
      b.addEventListener('click', () => {
        try {
          action.run(block);
          emit('doc');
        } catch (e) {
          console.error('[ctx action]', e);
        }
      });
      host.appendChild(b);
    }
    host.appendChild(h('span', { class: 'ctx-sep' }));
  }

  host.appendChild(ctxBtn('', 'copy', 'Duplicate', () => {
    ops.duplicateBlocks();
    emit('doc');
  }));
  host.appendChild(ctxBtn('', 'group', 'Group', () => {
    ops.groupSelection();
    emit('doc');
  }));
  host.appendChild(ctxBtn('', 'ungroup', 'Unnest', () => {
    ops.ungroupSelection();
    emit('doc');
  }));

  host.appendChild(h('span', { class: 'ctx-sep' }));

  host.appendChild(ctxBtn('', 'z-up', 'Bring forward', () => {
    ops.reorderRelative(block.id, 'up');
    emit('doc');
  }));
  host.appendChild(ctxBtn('', 'z-down', 'Send backward', () => {
    ops.reorderRelative(block.id, 'down');
    emit('doc');
  }));

  host.appendChild(h('span', { class: 'ctx-sep' }));

  // Typography quick controls
  const fontSel = h('select', { class: 'ctx-select', title: 'Font family' });
  const curFont = (block.style && block.style.fontFamily) || '';
  for (const f of FONTS) {
    const o = h('option', { value: f.v }, f.l);
    if (f.v === curFont) o.selected = true;
    fontSel.appendChild(o);
  }
  fontSel.addEventListener('change', () => {
    ops.setStyleProp(block.id, 'fontFamily', fontSel.value);
    emit('doc');
  });
  host.appendChild(fontSel);

  const weightSel = h('select', { class: 'ctx-select', title: 'Weight' });
  const curW = String((block.style && block.style.fontWeight) || '400');
  for (const w of FONT_WEIGHT) {
    const o = h('option', { value: w.v }, w.l);
    if (w.v === curW) o.selected = true;
    weightSel.appendChild(o);
  }
  weightSel.addEventListener('change', () => {
    ops.setStyleProp(block.id, 'fontWeight', weightSel.value);
    emit('doc');
  });
  host.appendChild(weightSel);

  host.appendChild(ctxBtn('B', '', 'Bold', () => {
    const w = String((block.style && block.style.fontWeight) || '400');
    ops.setStyleProp(block.id, 'fontWeight', Number(w) >= 700 ? '400' : '700');
    emit('doc');
  }));
  host.appendChild(ctxBtn('I', '', 'Italic', () => {
    const st = (block.style && block.style.fontStyle) || 'normal';
    ops.setStyleProp(block.id, 'fontStyle', st === 'italic' ? 'normal' : 'italic');
    emit('doc');
  }));
  host.appendChild(ctxBtn('U', '', 'Underline', () => {
    const d = (block.style && (block.style.decoration || block.style.textDecor)) || 'none';
    const next = d === 'underline' ? 'none' : 'underline';
    ops.setStyleProp(block.id, 'decoration', next);
    ops.setStyleProp(block.id, 'textDecor', next);
    emit('doc');
  }));

  const sizeInp = h('input', {
    class: 'ctx-size', type: 'number', title: 'Font size', min: '8', max: '200', step: '1',
    value: String((block.style && block.style.fontSize) || 16),
  });
  sizeInp.addEventListener('change', () => {
    const n = Number(sizeInp.value);
    if (!isNaN(n)) {
      ops.setStyleProp(block.id, 'fontSize', n);
      emit('doc');
    }
  });
  host.appendChild(sizeInp);

  host.appendChild(h('span', { class: 'ctx-sep' }));

  host.appendChild(ctxBtn('', block.locked ? 'unlock' : 'lock', block.locked ? 'Unlock' : 'Lock', () => {
    ops.toggleLock([block.id]);
    emit('doc');
  }));
  host.appendChild(ctxBtn('', block.hidden ? 'eye-off' : 'eye', block.hidden ? 'Show' : 'Hide', () => {
    ops.toggleHidden([block.id]);
    emit('doc');
  }));
  host.appendChild(ctxBtn('', 'trash', 'Delete', () => {
    const gone = ops.removeBlocks();
    emit('doc');
    emit('selection');
    if (gone && gone.length) emit('command', 'edit._deleted');
  }));

  position();
}

function position() {
  const host = $('contextbar');
  const vp = viewportEl();
  if (!host || !vp) return;
  const bounds = selectionBounds(Array.from(state.selection));
  const canvasEl = $('canvas');
  if (!bounds || !canvasEl) {
    host.classList.remove('is-on');
    return;
  }
  const canvasRect = canvasEl.getBoundingClientRect();
  const vr = vp.getBoundingClientRect();
  const z = zoom();
  // Place BELOW the selection so rotate handle above stays visible
  const left = canvasRect.left - vr.left + vp.scrollLeft + bounds.x * z;
  const top = canvasRect.top - vr.top + vp.scrollTop + (bounds.y + bounds.h) * z + 10;
  host.classList.add('is-on');
  const w = host.offsetWidth || 200;
  const centered = Math.max(8, left + (bounds.w * z - w) / 2);
  host.style.left = centered + 'px';
  host.style.top = Math.max(8, top) + 'px';
}

export function refreshContextbar() {
  position();
}

export function initShell() {
  buildToolstrip();
  buildStatusbar();
  buildContextbar();
  on('view', () => {
    buildToolstrip();
    buildStatusbar();
    buildContextbar();
  });
  on('selection', buildContextbar);
  on('doc', () => {
    buildStatusbar();
    buildContextbar();
  });
  on('dirty', buildStatusbar);
  on('history', () => {
    const u = $('tbUndo');
    const r = $('tbRedo');
    if (u) u.disabled = !canUndo();
    if (r) r.disabled = !canRedo();
  });
  window.addEventListener('resize', position);
  const vp = viewportEl();
  if (vp) vp.addEventListener('scroll', position, { passive: true });
}