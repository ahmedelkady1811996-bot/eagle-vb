import { all, rectOf } from './measure.js';
import { state } from '../core/store.js';

const THRESHOLD = 5;

let layer = null;

function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  layer = document.getElementById('guides');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'guides';
    document.getElementById('viewport').appendChild(layer);
  }
  return layer;
}

export function clear() {
  const l = ensureLayer();
  while (l.firstChild) l.removeChild(l.firstChild);
}

function line(vertical, pos, from, to) {
  const el = document.createElement('div');
  el.className = 'guide' + (vertical ? ' guide--v' : ' guide--h');
  if (vertical) {
    el.style.left = pos + 'px';
    el.style.top = from + 'px';
    el.style.height = Math.max(1, to - from) + 'px';
  } else {
    el.style.top = pos + 'px';
    el.style.left = from + 'px';
    el.style.width = Math.max(1, to - from) + 'px';
  }
  const tag = document.createElement('span');
  tag.className = 'guide__tag';
  tag.textContent = Math.round(pos) + 'px';
  if (vertical) {
    tag.style.left = '3px';
    tag.style.top = Math.min(Math.max(2, (to - from) / 2), 400) + 'px';
  } else {
    tag.style.top = '3px';
    tag.style.left = '2px';
  }
  el.appendChild(tag);
  ensureLayer().appendChild(el);
}

function edges(r) {
  return {
    l: r.x,
    c: r.x + r.w / 2,
    r: r.x + r.w,
    t: r.y,
    m: r.y + r.h / 2,
    b: r.y + r.h,
  };
}

export function snapMove(movingId, proposed, skipIds) {
  if (!state.ui.guides) return { dx: 0, dy: 0 };
  clear();
  const self = rectOf(movingId);
  if (!self) return { dx: 0, dy: 0 };

  const skip = new Set(skipIds || []);
  skip.add(movingId);

  const me = edges(self);
  const targets = [];
  for (const [id, r] of all()) {
    if (skip.has(id)) continue;
    targets.push(edges(r));
  }

  let bestX = null;
  let bestY = null;

  for (const t of targets) {
    for (const axis of ['l', 'c', 'r']) {
      for (const key of ['l', 'c', 'r']) {
        const delta = t[axis] - me[key];
        if (Math.abs(delta) <= THRESHOLD && (bestX == null || Math.abs(delta) < Math.abs(bestX.delta))) {
          bestX = { delta, pos: t[axis] };
        }
      }
    }
    for (const axis of ['t', 'm', 'b']) {
      for (const key of ['t', 'm', 'b']) {
        const delta = t[axis] - me[key];
        if (Math.abs(delta) <= THRESHOLD && (bestY == null || Math.abs(delta) < Math.abs(bestY.delta))) {
          bestY = { delta, pos: t[axis] };
        }
      }
    }
  }

  const bounds = all();
  let minY = 0;
  let maxY = 0;
  let minX = 0;
  let maxX = 0;
  for (const r of bounds.values()) {
    minY = Math.min(minY, r.y);
    maxY = Math.max(maxY, r.y + r.h);
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x + r.w);
  }

  if (bestX) line(true, bestX.pos, Math.min(minY, self.y), Math.max(maxY, self.y + self.h));
  if (bestY) line(false, bestY.pos, Math.min(minX, self.x), Math.max(maxX, self.x + self.w));

  return { dx: bestX ? bestX.delta : 0, dy: bestY ? bestY.delta : 0 };
}

export function snapResize(movingId, proposed, dir) {
  if (!state.ui.guides) return { dw: 0, dh: 0 };
  clear();
  const self = rectOf(movingId);
  if (!self) return { dw: 0, dh: 0 };

  const targets = [];
  for (const [id, r] of all()) {
    if (id === movingId) continue;
    targets.push(edges(r));
  }

  let dw = 0;
  let dh = 0;
  let bestW = null;
  let bestH = null;

  const selfEdges = edges(self);
  if (dir.includes('e')) {
    for (const t of targets) {
      for (const key of ['l', 'c', 'r']) {
        const delta = t[key] - selfEdges.r;
        if (Math.abs(delta) <= THRESHOLD && (bestW == null || Math.abs(delta) < Math.abs(bestW.delta))) bestW = { delta, pos: t[key] };
      }
    }
  }
  if (dir.includes('w')) {
    for (const t of targets) {
      for (const key of ['l', 'c', 'r']) {
        const delta = selfEdges.l - t[key];
        if (Math.abs(delta) <= THRESHOLD && (bestW == null || Math.abs(delta) < Math.abs(bestW.delta))) bestW = { delta: -delta, pos: t[key] };
      }
    }
  }
  if (dir.includes('s')) {
    for (const t of targets) {
      for (const key of ['t', 'm', 'b']) {
        const delta = t[key] - selfEdges.b;
        if (Math.abs(delta) <= THRESHOLD && (bestH == null || Math.abs(delta) < Math.abs(bestH.delta))) bestH = { delta, pos: t[key] };
      }
    }
  }
  if (dir.includes('n')) {
    for (const t of targets) {
      for (const key of ['t', 'm', 'b']) {
        const delta = selfEdges.t - t[key];
        if (Math.abs(delta) <= THRESHOLD && (bestH == null || Math.abs(delta) < Math.abs(bestH.delta))) bestH = { delta: -delta, pos: t[key] };
      }
    }
  }

  if (bestW) line(true, bestW.pos, Math.min(self.y, self.y + self.h), Math.max(self.y, self.y + self.h));
  if (bestH) line(false, bestH.pos, Math.min(self.x, self.x + self.w), Math.max(self.x, self.x + self.w));

  return { dw: bestW ? bestW.delta : 0, dh: bestH ? bestH.delta : 0 };
}