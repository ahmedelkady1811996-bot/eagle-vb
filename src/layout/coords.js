import { state, currentDoc } from '../core/store.js';

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 8;

export function zoom() {
  return state.ui.zoom;
}

export function setZoom(value, anchorClientX, anchorClientY) {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  if (Math.abs(next - state.ui.zoom) < 0.0005) return state.ui.zoom;

  const vp = viewportEl();
  const before = anchorClientX != null ? clientToCanvasAt(vp, anchorClientX, anchorClientY) : null;

  state.ui.zoom = next;

  if (before && vp) {
    const after = canvasToClientAt(vp, before.x, before.y);
    const r = vp.getBoundingClientRect();
    state.ui.panX += anchorClientX - after.clientX;
    state.ui.panY += anchorClientY - after.clientY;
  }
  return next;
}

export function zoomBy(factor, anchorClientX, anchorClientY) {
  return setZoom(state.ui.zoom * factor, anchorClientX, anchorClientY);
}

export function zoomTo(actualW, availableW) {
  const available = availableW || (viewportEl() ? viewportEl().clientWidth - 96 : 1200);
  return setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, available / Math.max(1, actualW))));
}

export function zoomReset() {
  state.ui.panX = 0;
  state.ui.panY = 0;
  return setZoom(1);
}

export function viewportEl() {
  return document.getElementById('viewport');
}

export function stageEl() {
  return document.getElementById('stage');
}

export function canvasEl() {
  return document.getElementById('canvas');
}

export function applyTransform() {
  const stage = stageEl();
  const canvas = canvasEl();
  if (!stage || !canvas) return;
  const model = currentDoc();
  const w = (model.canvas && Number(model.canvas.width)) || 1280;
  const minH = (model.canvas && Number(model.canvas.minHeight)) || 720;
  canvas.style.width = w + 'px';
  canvas.style.maxWidth = 'none';
  canvas.style.minWidth = w + 'px';
  canvas.style.minHeight = minH + 'px';
  const z = state.ui.zoom || 1;
  const h = Math.max(minH, canvas.scrollHeight || canvas.offsetHeight || minH);
  stage.style.width = Math.round(w * z) + 'px';
  stage.style.height = Math.round(h * z) + 'px';
  stage.style.transformOrigin = '0 0';
  stage.style.transform = 'translate(' + (state.ui.panX || 0) + 'px,' + (state.ui.panY || 0) + 'px) scale(' + z + ')';
}

export function panBy(dx, dy) {
  state.ui.panX += dx;
  state.ui.panY += dy;
}

/**
 * Convert screen client coords → canvas-local coords.
 * Uses the canvas element's bounding box so centered stage margins
 * and zoom/pan stay correct when switching Mobile / Tablet / Desktop.
 */
export function clientToCanvasAt(vp, clientX, clientY) {
  const canvas = canvasEl();
  const z = state.ui.zoom || 1;
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return {
        x: (clientX - r.left) / z,
        y: (clientY - r.top) / z,
      };
    }
  }
  // Fallback (no canvas yet)
  const r = vp ? vp.getBoundingClientRect() : { left: 0, top: 0 };
  return {
    x: (clientX - r.left - (state.ui.panX || 0)) / z,
    y: (clientY - r.top - (state.ui.panY || 0)) / z,
  };
}

export function clientToCanvas(clientX, clientY) {
  return clientToCanvasAt(viewportEl(), clientX, clientY);
}

export function canvasToClientAt(vp, x, y) {
  const canvas = canvasEl();
  const z = state.ui.zoom || 1;
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    return {
      clientX: r.left + x * z,
      clientY: r.top + y * z,
    };
  }
  const r = vp ? vp.getBoundingClientRect() : { left: 0, top: 0 };
  return {
    clientX: r.left + (state.ui.panX || 0) + x * z,
    clientY: r.top + (state.ui.panY || 0) + y * z,
  };
}

export function canvasToClient(x, y) {
  const vp = viewportEl();
  if (!vp) return { clientX: 0, clientY: 0 };
  return canvasToClientAt(vp, x, y);
}

export function canvasToViewport(x, y) {
  const vp = viewportEl();
  if (!vp) return { x, y };
  return { x: x * state.ui.zoom, y: y * state.ui.zoom };
}

export function deltaToCanvas(dxClient, dyClient) {
  return { x: dxClient / state.ui.zoom, y: dyClient / state.ui.zoom };
}

export function rectFromDom(el) {
  const doc = canvasEl();
  if (!el || !doc) return null;
  const dr = doc.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const z = state.ui.zoom || 1;
  return {
    x: (r.left - dr.left) / z,
    y: (r.top - dr.top) / z,
    w: r.width / z,
    h: r.height / z,
  };
}

export function clientRectOf(el) {
  if (!el || !el.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}