import { canvas, nodeMap } from '../render/canvas.js';
import { rectFromDom } from './coords.js';

const rects = new Map();

export function measureAll() {
  rects.clear();
  const root = canvas();
  if (!root) return rects;
  for (const [id, el] of nodeMap()) {
    const r = rectFromDom(el);
    if (r) rects.set(id, r);
  }
  return rects;
}

export function rectOf(id) {
  if (rects.has(id)) return rects.get(id);
  const el = nodeMap().get(id);
  return el ? rectFromDom(el) : null;
}

export function all() {
  return rects;
}

export function invalidate() {
  rects.clear();
}

export function selectionBounds(ids) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = 0;
  for (const id of ids) {
    const r = rectOf(id);
    if (!r) continue;
    found += 1;
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.w);
    bottom = Math.max(bottom, r.y + r.h);
  }
  if (!found) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function hitTestAt(x, y) {
  const root = canvas();
  if (!root) return null;
  let best = null;
  let bestArea = Infinity;
  for (const [id, el] of nodeMap()) {
    const r = rects.get(id) || rectFromDom(el);
    if (!r) continue;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      const area = r.w * r.h;
      if (area < bestArea) {
        bestArea = area;
        best = id;
      }
    }
  }
  return best;
}