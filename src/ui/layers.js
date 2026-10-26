import * as ops from '../model/ops.js';
import * as project from '../io/project.js';
import { h, clear } from '../core/dom.js';
import { state, currentDoc, find, findAll, parentOf } from '../core/store.js';
import { emit, on } from '../core/bus.js';
import { get as getDef } from '../model/registry.js';
import { iconFor } from './palette.js';

const collapsed = new Set();
let host = null;
let activeTarget = null;
let filter = '';
let mode = 'page'; // 'page' | 'project' | 'files'

export function setMode(next) {
  mode = next === 'project' || next === 'files' ? next : 'page';
  renderLayers(activeTarget || host);
}

export function getMode() {
  return mode;
}

function iconNode(type) {
  const span = h('span', { class: 'layer__ico' });
  span.style.backgroundImage = 'url("IMAGES/' + iconFor(type) + '")';
  return span;
}

function ensurePages() {
  try {
    project.ensurePagesSynced();
  } catch (e) {
    void e;
  }
  if (!state.pages || !state.pages.length) {
    const doc = currentDoc();
    state.pages = [{ id: state.pageId || 'page1', name: (doc && doc.name) || 'Page 1', doc: doc }];
  }
}

function matchesFilter(block) {
  if (!filter) return true;
  const q = filter.toLowerCase();
  const def = getDef(block.type);
  const label = (block.name || (def && def.label) || block.type || '').toLowerCase();
  if (label.indexOf(q) >= 0) return true;
  if ((block.type || '').toLowerCase().indexOf(q) >= 0) return true;
  return false;
}

function subtreeMatches(block) {
  if (matchesFilter(block)) return true;
  for (const c of block.children || []) {
    if (subtreeMatches(c)) return true;
  }
  return false;
}

function layerRow(block, depth, opts) {
  const options = opts || {};
  const def = getDef(block.type);
  const label = block.name || (def && def.label) || block.type;
  const selected = state.selection.has(block.id);
  const hasKids = (block.children || []).length > 0;
  const isolated = state.ui.isolateId === block.id;

  if (filter && !subtreeMatches(block)) return null;

  const twist = h('button', {
    class: 'layer__twist',
    type: 'button',
    title: hasKids ? (collapsed.has(block.id) ? 'Expand' : 'Collapse') : '',
  }, hasKids ? (collapsed.has(block.id) ? '▸' : '▾') : '');
  twist.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!hasKids) return;
    if (collapsed.has(block.id)) collapsed.delete(block.id);
    else collapsed.add(block.id);
    render();
  });

  const nameEl = h('span', { class: 'layer__name', title: block.type + ' · ' + block.id }, label);
  const meta = h('span', { class: 'layer__meta' }, block.type);

  const el = h('div', {
    class: 'layer'
      + (selected ? ' is-sel' : '')
      + (block.hidden ? ' is-hidden' : '')
      + (block.locked ? ' is-locked' : '')
      + (isolated ? ' is-iso' : ''),
    style: { paddingLeft: 6 + depth * 12 + 'px' },
    'data-id': block.id,
    draggable: options.draggable !== false ? 'true' : 'false',
  }, [twist, iconNode(block.type), nameEl, meta]);

  el.addEventListener('click', (ev) => {
    if (options.onSelect) {
      options.onSelect(block, ev);
      return;
    }
    ops.select(block.id, ev.shiftKey || ev.metaKey || ev.ctrlKey);
    emit('selection');
  });

  el.addEventListener('dblclick', (ev) => {
    ev.stopPropagation();
    if (hasKids) {
      // Enter isolation for nested editing
      state.ui.isolateId = block.id;
      ops.select(block.id);
      emit('view');
      emit('selection');
      return;
    }
    const name = window.prompt('Rename layer', label);
    if (name != null && String(name).trim() && name !== label) {
      ops.rename(block.id, String(name).trim());
      emit('doc');
    }
  });

  const eye = h('button', {
    class: 'layer__act' + (block.hidden ? ' is-off' : ''),
    type: 'button',
    title: block.hidden ? 'Show' : 'Hide',
  }, block.hidden ? '◌' : '◉');
  eye.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ops.toggleHidden([block.id]);
    emit('doc');
  });

  const lock = h('button', {
    class: 'layer__act' + (block.locked ? ' is-off' : ''),
    type: 'button',
    title: block.locked ? 'Unlock' : 'Lock',
  }, block.locked ? '⊘' : '⊚');
  lock.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ops.toggleLock([block.id]);
    emit('doc');
  });

  const more = h('button', {
    class: 'layer__act',
    type: 'button',
    title: 'Duplicate',
  }, '⧉');
  more.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ops.duplicateBlocks([block.id]);
    emit('doc');
  });

  el.appendChild(eye);
  el.appendChild(lock);
  el.appendChild(more);

  if (options.draggable !== false) {
    el.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/vb-move', block.id);
      ev.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-drag');
    });
    el.addEventListener('dragend', () => el.classList.remove('is-drag'));
    el.addEventListener('dragover', (ev) => {
      if (!Array.from(ev.dataTransfer.types || []).includes('text/vb-move')) return;
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const after = ev.clientY > rect.top + rect.height / 2;
      el.classList.toggle('is-drop-after', after);
      el.classList.toggle('is-drop-before', !after);
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('is-drop-after', 'is-drop-before');
    });
    el.addEventListener('drop', (ev) => {
      el.classList.remove('is-drop-after', 'is-drop-before');
      const id = ev.dataTransfer.getData('text/vb-move');
      if (!id || id === block.id) return;
      ev.preventDefault();
      ev.stopPropagation();
      const doc = currentDoc();
      const parent = parentOf(doc, block.id);
      const parentId = parent && parent.id ? parent.id : null;
      // If dropping onto a container with Alt, nest inside
      const nest = ev.altKey && (block.children || []).length >= 0 && getDef(block.type) && getDef(block.type).container;
      if (nest) {
        ops.reorder(id, block.id, (block.children || []).length);
      } else {
        const list = parentId ? (find(doc, parentId) || {}).children : doc.children;
        const index = list ? list.findIndex((b) => b.id === block.id) : 0;
        const rect = el.getBoundingClientRect();
        const after = ev.clientY > rect.top + rect.height / 2;
        ops.reorder(id, parentId, after ? index + 1 : index);
      }
      emit('doc');
    });
  }

  return el;
}

function walkInto(list, depth, out) {
  // Top of list = front; show top first (like design tools)
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const block = list[i];
    const row = layerRow(block, depth);
    if (row) out.push(row);
    if ((block.children || []).length && !collapsed.has(block.id) && (!filter || subtreeMatches(block))) {
      walkInto(block.children, depth + 1, out);
    }
  }
}

function toolbar() {
  const bar = h('div', { class: 'layers-bar' });

  const tabs = h('div', { class: 'layers-tabs' });
  const pageTab = h('button', {
    class: 'layers-tab' + (mode === 'page' ? ' is-on' : ''),
    type: 'button',
  }, 'Page');
  const projTab = h('button', {
    class: 'layers-tab' + (mode === 'project' ? ' is-on' : ''),
    type: 'button',
  }, 'Project');
  const filesTab = h('button', {
    class: 'layers-tab' + (mode === 'files' ? ' is-on' : ''),
    type: 'button',
  }, 'Files');
  pageTab.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mode = 'page';
    renderLayers(activeTarget || host);
  });
  projTab.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mode = 'project';
    renderLayers(activeTarget || host);
  });
  filesTab.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    mode = 'files';
    renderLayers(activeTarget || host);
  });
  tabs.appendChild(pageTab);
  tabs.appendChild(projTab);
  tabs.appendChild(filesTab);
  bar.appendChild(tabs);

  const search = h('input', {
    class: 'layers-search',
    type: 'search',
    placeholder: 'Filter layers…',
    value: filter,
  });
  search.addEventListener('input', () => {
    filter = search.value || '';
    render();
  });
  bar.appendChild(search);

  const actions = h('div', { class: 'layers-actions' });
  const expandAll = h('button', { class: 'layer__act', type: 'button', title: 'Expand all' }, '▾▾');
  expandAll.addEventListener('click', () => {
    collapsed.clear();
    render();
  });
  const collapseAll = h('button', { class: 'layer__act', type: 'button', title: 'Collapse all' }, '▸▸');
  collapseAll.addEventListener('click', () => {
    const doc = currentDoc();
    findAll(doc).forEach((entry) => {
      if ((entry.block.children || []).length) collapsed.add(entry.block.id);
    });
    render();
  });
  const delSel = h('button', { class: 'layer__act', type: 'button', title: 'Delete selected' }, '⌫');
  delSel.addEventListener('click', () => {
    ops.removeBlocks();
    emit('doc');
    emit('selection');
  });
  actions.appendChild(expandAll);
  actions.appendChild(collapseAll);
  actions.appendChild(delSel);
  bar.appendChild(actions);

  return bar;
}

function renderPageTree(el) {
  const doc = currentDoc();
  const out = [];
  walkInto(doc.children || [], 0, out);
  for (const node of out) el.appendChild(node);
  if (!out.length) {
    el.appendChild(h('div', { class: 'pal-empty' }, filter
      ? 'No layers match “' + filter + '—'
      : 'No layers yet. Drag a block onto the canvas.'));
  }
}

function renderProjectTree(el) {
  ensurePages();
  const pages = state.pages || [];

  for (const page of pages) {
    const isCurrent = page.id === state.pageId;
    const pageDoc = page.doc || (isCurrent ? currentDoc() : null);
    const count = pageDoc && pageDoc.children ? pageDoc.children.length : 0;
    const pageCollapsed = collapsed.has('page:' + page.id);

    const twist = h('button', { class: 'layer__twist', type: 'button' },
      pageCollapsed ? '▸' : '▾');
    twist.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const key = 'page:' + page.id;
      if (collapsed.has(key)) collapsed.delete(key);
      else collapsed.add(key);
      render();
    });

    const row = h('div', {
      class: 'layer layer--page' + (isCurrent ? ' is-sel is-current-page' : ''),
      'data-page': page.id,
    }, [
      twist,
      h('span', { class: 'layer__ico layer__ico--page' }, '▤'),
      h('span', { class: 'layer__name' }, page.name || 'Page'),
      h('span', { class: 'layer__meta' }, count + ' blocks'),
    ]);

    row.addEventListener('click', () => {
      if (!isCurrent) {
        project.switchPage(page.id);
        emit('doc');
        emit('selection');
        emit('view');
      }
      render();
    });

    row.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      const name = window.prompt('Rename page', page.name || 'Page');
      if (name != null && String(name).trim()) {
        project.renamePage(page.id, String(name).trim());
        emit('doc');
        render();
      }
    });

    const openBtn = h('button', {
      class: 'layer__act' + (isCurrent ? ' is-off' : ''),
      type: 'button',
      title: isCurrent ? 'Editing this page' : 'Open for editing',
    }, isCurrent ? '●' : '○');
    openBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!isCurrent) {
        project.switchPage(page.id);
        emit('doc');
        emit('selection');
        emit('view');
        render();
      }
    });
    row.appendChild(openBtn);

    el.appendChild(row);

    // Show layers of current page under it; for others show summary only unless expanded & we have doc
    if (!pageCollapsed && isCurrent && pageDoc) {
      const kids = [];
      walkInto(pageDoc.children || [], 1, kids);
      for (const node of kids) el.appendChild(node);
      if (!kids.length) {
        el.appendChild(h('div', {
          class: 'pal-empty',
          style: { paddingLeft: '24px', fontSize: '11px' },
        }, 'Empty page — add blocks from the palette'));
      }
    } else if (!pageCollapsed && !isCurrent) {
      el.appendChild(h('div', {
        class: 'pal-empty',
        style: { paddingLeft: '24px', fontSize: '11px' },
      }, 'Click the page to open it for editing'));
    }
  }

  // New page shortcut
  const add = h('button', { class: 'layers-add-page', type: 'button' }, '+ New page');
  add.addEventListener('click', () => {
    emit('command', 'file.new');
    mode = 'project';
    setTimeout(() => render(), 50);
  });
  el.appendChild(add);
}

function renderFilesTree(el) {
  const doc = currentDoc();
  const files = (doc && doc.projectFiles) || [];
  if (!files.length) {
    el.appendChild(h('div', { class: 'pal-empty' },
      'No project folder open. Use File → Open external project folder…'));
    return;
  }
  // Group by top path segment for a simple tree
  const groups = new Map();
  for (const f of files) {
    const path = String(f.path || f.name || '');
    const parts = path.split(/[/\\]/).filter(Boolean);
    const top = parts.length > 1 ? parts[0] : '(root)';
    if (!groups.has(top)) groups.set(top, []);
    groups.get(top).push(f);
  }
  for (const [folder, list] of groups) {
    const key = 'pf:' + folder;
    const isCol = collapsed.has(key);
    const twist = h('button', { class: 'layer__twist', type: 'button' }, isCol ? '▸' : '▾');
    twist.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (collapsed.has(key)) collapsed.delete(key);
      else collapsed.add(key);
      render();
    });
    const folderRow = h('div', { class: 'layer layer--page', style: { paddingLeft: '6px' } }, [
      twist,
      h('span', { class: 'layer__ico layer__ico--page' }),
      h('span', { class: 'layer__name' }, folder),
      h('span', { class: 'layer__meta' }, String(list.length)),
    ]);
    el.appendChild(folderRow);
    if (isCol) continue;
    for (const f of list) {
      const icon = f.kind === 'html' ? '📄' : f.kind === 'css' ? '🎨' : f.kind === 'js' ? '⚙' : f.kind === 'image' ? '🖼' : f.kind === 'model' ? '🎲' : '📎';
      const row = h('div', {
        class: 'layer',
        style: { paddingLeft: '22px' },
        title: f.path || f.name,
      }, [
        h('span', { class: 'layer__twist' }, ''),
        h('span', { class: 'layer__ico' }, icon),
        h('span', { class: 'layer__name' }, f.name || f.path),
        h('span', { class: 'layer__meta' }, f.kind || 'file'),
      ]);
      el.appendChild(row);
    }
  }
}

export function renderLayers(target) {
  // Prefer the live host inside the inspector; fall back to last known / init host
  let el = target || activeTarget || host;
  if (target && target.isConnected) {
    activeTarget = target;
    el = target;
  } else if (activeTarget && activeTarget.isConnected) {
    el = activeTarget;
  } else {
    // Recover live host from DOM if inspector re-mounted
    const live = document.querySelector('.insp-layers-pane .layers')
      || document.querySelector('#inspector .layers');
    if (live) {
      activeTarget = live;
      el = live;
    }
  }
  if (!el) return;
  clear(el);

  el.appendChild(toolbar());

  const tree = h('div', { class: 'layers-tree' });
  if (mode === 'project') renderProjectTree(tree);
  else if (mode === 'files') renderFilesTree(tree);
  else renderPageTree(tree);
  el.appendChild(tree);

  requestAnimationFrame(() => {
    const sel = tree.querySelector('.layer.is-sel');
    if (sel && sel.scrollIntoView) {
      try { sel.scrollIntoView({ block: 'nearest' }); } catch (e) { void e; }
    }
  });
}

export const render = renderLayers;

export function init() {
  host = h('div', { class: 'layers layers--panel' });
  activeTarget = host;
  renderLayers(host);
  on('doc', () => renderLayers(activeTarget));
  on('selection', () => renderLayers(activeTarget));
  on('view', () => renderLayers(activeTarget));
}

export function count() {
  return findAll(currentDoc()).length;
}
