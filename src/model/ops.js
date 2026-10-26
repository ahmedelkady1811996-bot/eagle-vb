import { currentDoc, commitDoc, state, find, findAll, parentOf, detach, insertAt, isDescendant, branchIds, begin, commit, markDirty, labelOf, primary, selectionBlocks } from '../core/store.js';
import { emit } from '../core/bus.js';
import { clone } from '../core/util.js';
import { get as getDef, createBlock, isContainer, findFreeSlot } from './catalog.js';
import { measureAll, rectOf } from '../layout/measure.js';
import { nodeMap } from '../render/canvas.js';

function doc() {
  return currentDoc();
}

function touch(label, fn) {
  begin(label);
  try {
    fn();
    markDirty();
  } catch (err) {
    console.error('[ops]', err);
  } finally {
    commit();
  }
  emit('doc');
}

/**
 * Blocks whose width comes from their own content rather than the layout.
 *
 * A Button, a Badge, a Divider or an icon must never be stretched to the width
 * of whatever container they are dropped into - that is the "the button is
 * enormous" report. In flow mode a column flex parent stretches its children by
 * default, so these need to opt out.
 */
const INTRINSIC_TYPES = new Set([
  'button', 'text', 'heading', 'label', 'badge', 'icon', 'divider', 'hr',
  'avatar', 'link', 'chip', 'tag', 'input', 'textarea', 'select', 'checkbox',
  'radio', 'switch', 'spacer', 'image',
]);

export function addBlock(type, options) {
  const o = options || {};
  const d = doc();
  const block = createBlock(type);
  const tpl = o.template || null;
  if (tpl && tpl.props) Object.assign(block.props, tpl.props);
  if (tpl && tpl.style) Object.assign(block.style, tpl.style);
  if (tpl && tpl.name) block.name = tpl.name;
  if (o.props) Object.assign(block.props, o.props);
  if (o.style) Object.assign(block.style, o.style);

  /* A framework block IS a custom element, so two of them must not claim the
     same tag: the second one would silently replace the first everywhere
     (canvas and export). Give every new one a tag that is not taken yet. */
  if (getDef(type) && getDef(type).customTag && block.props && block.props.tagName) {
    const taken = new Set();
    const scan = (list) => {
      for (const b of list || []) {
        if (b && b.props && b.props.tagName) taken.add(String(b.props.tagName));
        if (b) scan(b.children);
      }
    };
    scan(d.children);
    const base = String(block.props.tagName);
    if (taken.has(base)) {
      let n = 2;
      while (taken.has(base + '-' + n)) n += 1;
      block.props.tagName = base + '-' + n;
    }
  }

  /* An intrinsically sized control with no authored width keeps its natural
     width and stops stretching to the parent's cross axis. */
  const authoredW = block.style.w != null && block.style.w !== '' && block.style.w !== 'auto';
  if (INTRINSIC_TYPES.has(type) && !authoredW && block.style.alignSelf == null) {
    block.style.alignSelf = 'flex-start';
  }

  const free = d.canvas && d.canvas.mode === 'free';

  if (free) {
    const size = estimateSize(block);
    const slot = o.at || findFreeSlot(d, size);
    block.style.pos = 'absolute';
    block.style.x = Math.round(slot.x);
    block.style.y = Math.round(slot.y);
    if (!authoredW && !INTRINSIC_TYPES.has(type)) block.style.w = block.style.w == null ? size.w : block.style.w;
    if (block.style.h == null) block.style.h = size.h;
  }

  const parentId = o.parentId || null;
  let index = o.index;
  if (parentId) {
    const parent = find(d, parentId);
    if (!parent) return null;
    if (!isContainer(parent.type)) return null;
    if (index == null) index = (parent.children || []).length;
  } else if (index == null) {
    index = (d.children || []).length;
  }

  touch('Add ' + type, () => {
    insertAt(d, parentId, block, index);
    state.selection = new Set([block.id]);
  });
  emit('selection');
  return block;
}

function estimateSize(block) {
  const w = Number(block.style.w) || 360;
  const h = Number(block.style.h) || (block.type === 'spacer' ? 60 : 160);
  return { w: Math.min(w, 720), h: Math.min(h, 520) };
}

export function removeBlocks(ids) {
  const d = doc();
  const raw = ids && ids.length ? ids : Array.from(state.selection);
  // Prefer deleting outermost selected nodes only (avoid double-delete of nested)
  const list = raw.filter((id) => find(d, id));
  if (!list.length) return [];
  const removed = [];
  touch('Delete', () => {
    for (const id of list) {
      if (detach(d, id)) removed.push(id);
      state.selection.delete(id);
    }
  });
  emit('selection');
  return removed;
}

export function duplicateBlocks(ids, offset) {
  const d = doc();
  const list = (ids && ids.length ? ids : Array.from(state.selection)).filter((id) => find(d, id));
  if (!list.length) return [];
  const dx = offset == null ? 24 : offset;
  const created = [];
  touch('Duplicate', () => {
    for (const id of list) {
      const src = find(d, id);
      if (!src) continue;
      const parent = parentOf(d, id);
      const copy = clone(src);
      reid(copy);
      copy.style.x = Number(copy.style.x || 0) + dx;
      copy.style.y = Number(copy.style.y || 0) + dx;
      const siblings = parent ? parent.children : d.children;
      const idx = siblings.findIndex((b) => b.id === id);
      siblings.splice(idx + 1, 0, copy);
      created.push(copy.id);
    }
    state.selection = new Set(created);
  });
  emit('selection');
  return created;
}

function reid(node) {
  node.id = 'b' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  for (const child of node.children || []) reid(child);
}

export function moveBlocks(ids, dx, dy) {
  const d = doc();
  const free = d.canvas && d.canvas.mode === 'free';
  for (const id of ids) {
    const b = find(d, id);
    if (!b || b.locked) continue;
    b.style.pos = 'absolute';
    b.style.x = Math.round((Number(b.style.x) || 0) + dx);
    b.style.y = Math.round((Number(b.style.y) || 0) + dy);
  }
  if (!free) {
    for (const id of ids) {
      const b = find(d, id);
      if (b) b.style.pos = 'absolute';
    }
  }
  markDirty();
}

export function setPosition(id, x, y) {
  const b = find(doc(), id);
  if (!b) return;
  b.style.pos = 'absolute';
  b.style.x = Math.round(x);
  b.style.y = Math.round(y);
}

export function setSize(id, w, h) {
  const b = find(doc(), id);
  if (!b) return;
  if (w != null) b.style.w = Math.max(8, Math.round(w));
  if (h != null) b.style.h = Math.max(4, Math.round(h));
}

export function nest(childId, parentId, index) {
  const d = doc();
  const child = find(d, childId);
  const parent = find(d, parentId);
  if (!child || !parent) return false;
  if (!isContainer(parent.type)) return false;
  if (childId === parentId || isDescendant(d, childId, parentId)) return false;
  touch('Nest', () => {
    detach(d, childId);
    const at = index == null ? (parent.children || []).length : index;
    parent.children.splice(at, 0, child);
  });
  return true;
}

export function unnest(childId) {
  const d = doc();
  const child = find(d, childId);
  const parent = parentOf(d, childId);
  if (!child || !parent) return false;
  touch('Unnest', () => {
    detach(d, childId);
    d.children.push(child);
  });
  return true;
}

export function reorder(id, targetParentId, targetIndex) {
  const d = doc();
  const block = find(d, id);
  if (!block) return false;
  if (targetParentId && (targetParentId === id || isDescendant(d, id, targetParentId))) return false;
  if (targetParentId && !isContainer(find(d, targetParentId).type)) return false;
  touch('Reorder', () => {
    detach(d, id);
    insertAt(d, targetParentId, block, targetIndex);
  });
  return true;
}

export function reorderRelative(id, dir) {
  const d = doc();
  const block = find(d, id);
  if (!block) return;
  const parent = parentOf(d, id);
  const list = parent ? parent.children : d.children;
  const idx = list.indexOf(block);
  const next = dir === 'up' ? idx + 1 : idx - 1;
  if (next < 0 || next >= list.length) return;
  touch('Reorder', () => {
    list.splice(idx, 1);
    list.splice(next, 0, block);
  });
}

export function align(ids, mode) {
  const d = doc();
  const list = (ids || Array.from(state.selection)).map((id) => find(d, id)).filter(Boolean);
  if (list.length < 1) return;
  measureAll();
  touch('Align', () => {
    if (mode === 'distribute-h' || mode === 'distribute-v') {
      const rects = list.map((b) => ({ b, r: require_rect(b.id) })).filter((e) => e.r);
      rects.sort((a, z) => (mode === 'distribute-h' ? a.r.x - z.r.x : a.r.y - z.r.y));
      if (rects.length < 3) return;
      const first = rects[0].r;
      const last = rects[rects.length - 1].r;
      const total = mode === 'distribute-h'
        ? (last.x + last.w) - first.x
        : (last.y + last.h) - first.y;
      const sum = rects.reduce((a, e) => a + (mode === 'distribute-h' ? e.r.w : e.r.h), 0);
      const gap = (total - sum) / (rects.length - 1);
      let cursor = mode === 'distribute-h' ? first.x : first.y;
      for (const entry of rects) {
        if (mode === 'distribute-h') {
          entry.b.style.x = Math.round(cursor);
          cursor += entry.r.w + gap;
        } else {
          entry.b.style.y = Math.round(cursor);
          cursor += entry.r.h + gap;
        }
        entry.b.style.pos = 'absolute';
      }
      return;
    }
    const rects = list.map((b) => ({ b, r: require_rect(b.id) })).filter((e) => e.r);
    if (!rects.length) return;
    const left = Math.min(...rects.map((e) => e.r.x));
    const right = Math.max(...rects.map((e) => e.r.x + e.r.w));
    const top = Math.min(...rects.map((e) => e.r.y));
    const bottom = Math.max(...rects.map((e) => e.r.y + e.r.h));
    const cx = rects.reduce((a, e) => a + e.r.x + e.r.w / 2, 0) / rects.length;
    const cy = rects.reduce((a, e) => a + e.r.y + e.r.h / 2, 0) / rects.length;
    for (const entry of rects) {
      const r = entry.r;
      const b = entry.b;
      b.style.pos = 'absolute';
      if (mode === 'left') b.style.x = Math.round(left);
      else if (mode === 'right') b.style.x = Math.round(right - r.w);
      else if (mode === 'center-x') b.style.x = Math.round(cx - r.w / 2);
      else if (mode === 'top') b.style.y = Math.round(top);
      else if (mode === 'bottom') b.style.y = Math.round(bottom - r.h);
      else if (mode === 'center-y') b.style.y = Math.round(cy - r.h / 2);
      else if (mode === 'stretch-h') {
        b.style.x = Math.round(left);
        b.style.w = Math.round(right - left);
      } else if (mode === 'stretch-v') {
        b.style.y = Math.round(top);
        b.style.h = Math.round(bottom - top);
      }
    }
  });
}

function require_rect(id) {
  return rectOf(id);
}

export function groupSelection() {
  const d = doc();
  const ids = Array.from(state.selection).filter((id) => find(d, id));
  if (ids.length < 2) return;
  touch('Group', () => {
    const group = createBlock('frame', { name: 'Group' }, { display: 'flex', dir: 'column', gap: 12, pT: 12, pR: 12, pB: 12, pL: 12, borderW: 1, borderStyle: 'dashed', borderColor: '#94a3b8', radius: 10 });
    const first = find(d, ids[0]);
    const parent = parentOf(d, ids[0]);
    const target = parent || { children: d.children };
    const at = (target.children || []).indexOf(first);
    for (const id of ids) {
      const b = find(d, id);
      if (!b) continue;
      detach(d, id);
      group.children.push(b);
    }
    insertAt(d, parent ? parent.id : null, group, at < 0 ? undefined : at);
    state.selection = new Set([group.id]);
  });
  emit('selection');
}

export function ungroupSelection() {
  const d = doc();
  const ids = Array.from(state.selection).filter((id) => find(d, id));
  if (!ids.length) return;
  touch('Ungroup', () => {
    const freed = [];
    for (const id of ids) {
      const b = find(d, id);
      const parent = parentOf(d, id);
      if (!b || !parent || !(b.children || []).length) continue;
      const at = (parent.children || []).indexOf(b);
      detach(d, id);
      (parent.children || []).splice(at, 0, ...b.children);
      freed.push(...b.children.map((c) => c.id));
    }
    if (freed.length) state.selection = new Set(freed);
  });
  emit('selection');
}

export function findBlock(id) {
  return find(doc(), id);
}

export function setProp(id, key, value) {
  const b = find(doc(), id);
  if (!b) return;
  const ROOT = { hidden: 1, locked: 1, name: 1, type: 1, id: 1 };
  if (ROOT[key]) {
    b[key] = value;
  } else if (key === 'events') {
    b.events = Array.isArray(value) ? value : [];
  } else if (key === 'states') {
    b.states = value;
  } else if (key === 'a11y') {
    b.a11y = Object.assign({}, b.a11y, value);
  } else if (key in (b.style || {}) && !(key in (b.props || {}))) {
    b.style[key] = value;
  } else {
    b.props = b.props || {};
    b.props[key] = value;
  }
  markDirty();
}

export function setStyleProp(id, key, value) {
  const b = find(doc(), id);
  if (!b) return;
  if (!b.style) b.style = {};
  b.style[key] = value;
  markDirty();
  try { emit('doc'); } catch (e) { void e; }
}

export function rename(id, name) {
  touch('Rename', () => {
    const b = find(doc(), id);
    if (b) b.name = name;
  });
}

export function toggleLock(ids) {
  touch('Lock', () => {
    for (const id of ids || Array.from(state.selection)) {
      const b = find(doc(), id);
      if (b) b.locked = !b.locked;
    }
  });
}

export function toggleHidden(ids) {
  touch('Hide', () => {
    for (const id of ids || Array.from(state.selection)) {
      const b = find(doc(), id);
      if (b) b.hidden = !b.hidden;
    }
  });
}

export function reorderTo(id, edge) {
  const d = doc();
  const block = find(d, id);
  if (!block) return;
  const parent = parentOf(d, id);
  const list = parent ? parent.children : d.children;
  const idx = list.indexOf(block);
  if (idx < 0) return;
  touch('Reorder', () => {
    list.splice(idx, 1);
    if (edge === 'front') list.push(block);
    else list.unshift(block);
  });
}

export function setCanvasMode(mode) {
  const d = doc();
  const next = mode === 'free' ? 'free' : 'flow';
  if ((d.canvas && d.canvas.mode) === next) return;
  const keepW = (d.canvas && Number(d.canvas.width)) || 1280;
  let placements = [];
  if (next === 'free') {
    const INTRINSIC = INTRINSIC_TYPES;
    const map = (() => {
      try { return nodeMap(); } catch (e) { return new Map(); }
    })();
    // Temporarily shrink intrinsic elements to fit-content so measure matches natural size
    const restore = [];
    for (const b of d.children || []) {
      const el = map.get(b.id);
      if (!el) continue;
      const st = b.style || {};
      const explicitW = st.w != null && st.w !== '' && st.w !== 'auto' && st.w !== '100%';
      if (!explicitW && (INTRINSIC.has(b.type) || !st.w)) {
        if (st.alignSelf == null) st.alignSelf = 'flex-start';
        restore.push({ el, w: el.style.width, max: el.style.maxWidth, as: el.style.alignSelf });
        el.style.width = 'fit-content';
        el.style.maxWidth = '100%';
        el.style.alignSelf = 'flex-start';
      }
    }
    measureAll();
    let cursorY = 24;
    placements = (d.children || []).map((b) => {
      const r = rectOf(b.id);
      const st = b.style || {};
      /* Remember what flow had so "back to Flow" can restore it exactly.
         Leaving the free numbers behind was why a block kept its stretched
         width forever after the user returned to flow. */
      if (st._flowW == null) st._flowW = st.w == null ? '' : st.w;
      if (st._flowH == null) st._flowH = st.h == null ? '' : st.h;
      let w;
      let h;
      // Prefer author-set numeric sizes when present
      if (typeof st.w === 'number' && st.w > 0) w = Math.round(st.w);
      else if (st.w && /^\d+(\.\d+)?px$/.test(String(st.w))) w = Math.round(parseFloat(st.w));
      else if (String(st.w) === '100%' || String(st.w) === '100') w = keepW;
      else w = r ? Math.max(24, Math.round(r.w)) : Math.min(280, keepW - 48);
      if (typeof st.h === 'number' && st.h > 0) h = Math.round(st.h);
      else if (st.h && /^\d+(\.\d+)?px$/.test(String(st.h))) h = Math.round(parseFloat(st.h));
      else h = r ? Math.max(16, Math.round(r.h)) : 40;
      /* Guard: a small control must not lock to nearly the full artboard width.
         Without this a Button that was only as wide as its label got frozen at
         the width of its (stretched) container, which is the "the button is
         enormous" report. An authored width is always respected. */
      if (INTRINSIC.has(b.type) && w > keepW * 0.85 && !(typeof st.w === 'number' && st.w > keepW * 0.5)) {
        w = Math.max(48, Math.min(w, Math.round(keepW * 0.35)));
      }
      const x = r ? Math.round(r.x) : 24;
      const y = r ? Math.round(r.y) : cursorY;
      cursorY = y + h + 16;
      return { id: b.id, x, y, w, h };
    });
    for (const item of restore) {
      item.el.style.width = item.w;
      item.el.style.maxWidth = item.max;
      item.el.style.alignSelf = item.as;
    }
  }
  touch('Canvas mode', () => {
    d.canvas = d.canvas || {};
    d.canvas.mode = next;
    d.canvas.width = keepW;
    if (next === 'free') {
      let bottom = 720;
      for (const p of placements) {
        const b = find(d, p.id);
        if (!b) continue;
        b.style = b.style || {};
        b.style.pos = 'absolute';
        b.style.x = p.x;
        b.style.y = p.y;
        if (p.w) b.style.w = p.w;
        if (p.h) b.style.h = p.h;
        bottom = Math.max(bottom, p.y + (p.h || 80) + 48);
      }
      d.canvas.minHeight = bottom;
    } else {
      for (const entry of findAll(d)) {
        const st = entry.block.style || (entry.block.style = {});
        st.pos = 'relative';
        delete st.x;
        delete st.y;
        /* Restore the flow sizing instead of keeping the free-layout pixels -
         this is what makes Flow -> Free -> Flow a round trip again. */
        if (st._flowW != null) {
          if (st._flowW === '') delete st.w; else st.w = st._flowW;
          delete st._flowW;
        }
        if (st._flowH != null) {
          if (st._flowH === '') delete st.h; else st.h = st._flowH;
          delete st._flowH;
        }
      }
      d.canvas.minHeight = 720;
    }
  });
}

export function select(ids, additive) {
  if (!ids) {
    state.selection = new Set();
  } else if (additive) {
    const list = Array.isArray(ids) ? ids : [ids];
    for (const id of list) {
      if (state.selection.has(id)) state.selection.delete(id);
      else state.selection.add(id);
    }
  } else {
    state.selection = new Set(Array.isArray(ids) ? ids : [ids]);
  }
  emit('selection');
}

export function selectAll() {
  const d = doc();
  state.selection = new Set(findAll(d).map((e) => e.block.id));
  emit('selection');
}

export function labelsFor() {
  const d = doc();
  return findAll(d).map((e) => ({ id: e.block.id, label: labelOf(e.block, getDef(e.block.type)) }));
}



/**
 * When the artboard width changes (Mobile / Tablet / Desktop), re-place the
 * free-layout blocks - but NEVER resize them.
 *
 * This used to multiply every width by next/prev and leave the height alone.
 * That is wrong twice over: it destroyed the aspect ratio of every element
 * (a button got wider, not taller), and because the value was written back it
 * COMPOUNDED - one Desktop -> Mobile -> Desktop round trip left a block at
 * 1254px instead of its original 1440px, and the next one moved it again. The
 * user sees exactly that as "in free mode the sizes are far too big".
 *
 * Now: authored sizes are untouched, a block that was full-bleed keeps being
 * full-bleed, everything else keeps its horizontal centre, and x is clamped
 * back inside the artboard. Flow mode blocks reflow on their own.
 */
export function adaptToCanvasWidth(prevW, nextW) {
  const d = doc();
  const from = Math.max(1, Number(prevW) || 1280);
  const to = Math.max(1, Number(nextW) || 1280);
  if (from === to) return;
  const free = d.canvas && d.canvas.mode === 'free';

  touch('Adapt canvas width', () => {
    d.canvas = d.canvas || {};
    d.canvas.width = to;

    if (!free) {
      // Flow: only clamp sizes that cannot physically fit any more.
      for (const entry of findAll(d)) {
        const b = entry.block;
        const st = b.style || (b.style = {});
        const w = st.w;
        if (typeof w === 'number' && w > to) st.w = to;
        if (typeof w === 'string' && /^\d+(\.\d+)?px$/.test(w) && parseFloat(w) > to) {
          st.w = to;
        }
        if (st.maxW != null) {
          const mw = typeof st.maxW === 'number' ? st.maxW : parseFloat(st.maxW);
          if (Number.isFinite(mw) && mw > to) st.maxW = to;
        }
      }
      return;
    }

    // Free: full-bleed tracks the artboard, everything else keeps its size
    // and its centre. No scaling, ever.
    let bottom = 120;
    for (const b of d.children || []) {
      const st = b.style || (b.style = {});
      if (st.pos !== 'absolute') st.pos = 'absolute';

      let x = Number(st.x) || 0;
      const y = Number(st.y) || 0;

      let numW = null;
      const w = st.w;
      if (typeof w === 'number') numW = w;
      else if (typeof w === 'string' && /^\d+(\.\d+)?px$/.test(w)) numW = parseFloat(w);
      else if (typeof w === 'string' && /^\d+(\.\d+)?$/.test(w)) numW = parseFloat(w);

      if (numW == null) {
        /* No authored width - the block fills whatever artboard it sits on. */
        numW = to;
        st.w = to;
        x = 0;
      } else if (numW >= from * 0.9) {
        /* It was full-bleed on the old artboard, so it stays full-bleed. */
        numW = to;
        st.w = to;
        x = 0;
      } else {
        /* Keep the size the author chose; scale position proportionally
           so relative placement survives Mobile ↔ Tablet ↔ Desktop. */
        numW = Math.max(24, Math.min(numW, to));
        st.w = numW;
        const oldCentre = x + numW / 2;
        const newCentre = oldCentre * (to / from);
        x = Math.round(newCentre - numW / 2);
      }
      x = Math.max(0, Math.min(x, Math.max(0, to - numW)));
      st.x = x;
      st.y = Math.max(0, y);
      bottom = Math.max(bottom, st.y + (Number(st.h) || 80) + 48);
    }
    d.canvas.minHeight = bottom;
  });
}


export { branchIds, labelOf, primary, selectionBlocks, clone };
