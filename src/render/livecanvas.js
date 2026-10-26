/**
 * LIVE CANVAS - the builder renders the document as the browser actually sees it.
 *
 * Why this exists: an imported page is styled by ITS OWN stylesheet (Tailwind,
 * web fonts, Font Awesome). The editor document has none of those, so drawing
 * the imported blocks as native elements there produced a pile of unstyled,
 * un-laid-out text - nothing like the page the user is editing. Screenshotting
 * both side by side showed exactly that.
 *
 * So the live canvas is the real exported document in an iframe, which is the
 * only honest way to render it faithfully, with a transparent click-target over
 * every block so the user can still select and edit what they see.
 *
 * This is a VIEW. Editing still happens on the document model, exactly as
 * before; switching back to "Blocks" gives the editable native tree.
 */

const ID = 'vb-live-canvas';
let host = null;
let frame = null;
let overlay = null;
let pendingHtml = '';
let lastHtml = '';
let ready = false;
let overlayBoxes = [];

function ensure(container, box) {
  if (host && host.isConnected && host.parentNode === container) return true;
  if (host && host.parentNode) host.parentNode.removeChild(host);
  host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:2';
  frame = document.createElement('iframe');
  frame.setAttribute('title', 'Live canvas');
  frame.style.cssText = 'display:block;border:0;width:100%;background:#fff;pointer-events:none';
  overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  host.appendChild(frame);
  host.appendChild(overlay);
  container.appendChild(host);
  if (box) host.style.width = box.offsetWidth + 'px';
  frame.addEventListener('load', () => { ready = true; buildOverlay(); });
  return true;
}

function scaleOf() {
  /* The whole stage (canvas included) is already CSS-scaled by applyTransform,
     and the overlay lives INSIDE that canvas, so iframe pixels and overlay
     pixels are the same unit. Scaling here would double-count the zoom. */
  return 1;
}

function fitHeight() {
  try {
    const doc = frame && frame.contentDocument;
    if (!doc || !doc.documentElement) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0);
    if (h > 0) frame.style.height = h + 'px';
  } catch (e) { /* cross-origin guard */ }
}

function buildOverlay() {
  if (!overlay || !frame) return;
  overlay.innerHTML = '';
  overlayBoxes = [];
  let doc = null;
  try { doc = frame.contentDocument; } catch (e) { doc = null; }
  if (!doc || !doc.body) return;
  fitHeight();
  const zoom = scaleOf();
  const nodes = doc.querySelectorAll('[data-id]');
  for (const n of nodes) {
    const id = n.getAttribute('data-id');
    if (!id) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const hit = document.createElement('div');
    hit.style.cssText = 'position:absolute;left:' + (r.left * zoom) + 'px;top:' + (r.top * zoom)
      + 'px;width:' + (r.width * zoom) + 'px;height:' + (r.height * zoom)
      + 'px;pointer-events:auto;cursor:pointer';
    hit.dataset.vbLiveId = id;
    overlay.appendChild(hit);
    overlayBoxes.push({ id, el: hit });
  }
  highlight();
}

/** Draw the selection outline over the matching live nodes. */
export function highlight(selectedIds) {
  if (!overlay) return;
  const set = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  for (const box of overlayBoxes) {
    const on = set.has(box.id);
    box.el.style.outline = on ? '2px solid #6366f1' : '';
    box.el.style.background = on ? 'rgba(99,102,241,.12)' : '';
  }
}

/**
 * Show the document in the live canvas.
 * `container` is the #canvas element; the artboard width drives the iframe's
 * real viewport so the page's own media queries fire at the chosen breakpoint.
 */
export function mount(container, box, html, artboardWidth) {
  if (!container) return false;
  ensure(container, box);
  if (box) host.style.width = box.offsetWidth + 'px';
  const w = Number(artboardWidth) || 1280;
  frame.style.width = w + 'px';
  frame.setAttribute('width', String(w));
  pendingHtml = html || '';
  if (!ready || pendingHtml !== lastHtml) {
    lastHtml = pendingHtml;
    ready = false;
    try { frame.srcdoc = pendingHtml; } catch (e) { void e; }
  }
  return true;
}

export function unmount() {
  if (host) host.style.display = 'none';
}

export function isMounted() {
  return !!(host && host.style.display !== 'none');
}

export function isReady() {
  return ready;
}

/** id under a client point, or null. Lets a click select a real block. */
export function idAt(clientX, clientY) {
  if (!overlay || !isMounted()) return null;
  const el = document.elementFromPoint(clientX, clientY);
  if (!el || !el.dataset || !el.dataset.vbLiveId) return null;
  return el.dataset.vbLiveId;
}

export function boxOf(id) {
  for (const b of overlayBoxes) if (b.id === id) return b.el;
  return null;
}