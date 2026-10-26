import * as project from '../io/project.js';
import * as ops from '../model/ops.js';
import * as blocks from '../io/blocks.js';
import { h, clear, $ } from '../core/dom.js';
import { emit } from '../core/bus.js';
import { state, currentDoc, commitDoc } from '../core/store.js';
import { openModal, toast, closeModal } from './widgets.js';
import { htmlBundle } from '../io/exporter.js';
import { applyTransform } from '../layout/coords.js';

const SUB_KEY = 'vb.submissions';
let room = null;
let applying = false;
const selfId = 'u' + Math.random().toString(36).slice(2, 8);

function docJson() {
  // Full multipage project snapshot so collaborators see every page
  try {
    return project.serialize();
  } catch (e) {
    return JSON.parse(JSON.stringify(currentDoc()));
  }
}

function applyRemote(next) {
  if (!next) return;
  applying = true;
  try {
    if (Array.isArray(next.pages) && next.pages.length) {
      project.loadPayload(next);
    } else if (Array.isArray(next.children)) {
      commitDoc(next);
    }
  } catch (e) {
    console.warn('[collab] apply failed', e);
  }
  applying = false;
  emit('doc');
  emit('view');
}

export function install() {
  emit; 
  const bus = window;
  void bus;
}

let channel = null;
let pc = null;
let dc = null;

function publishDoc() {
  if (applying || !room) return;
  const msg = { from: selfId, doc: docJson() };
  if (channel) {
    try { channel.postMessage(msg); } catch (e) { void e; }
  }
  if (dc && dc.readyState === 'open') {
    try { dc.send(JSON.stringify(msg)); } catch (e) { void e; }
  }
}

export function bindSync() {
  const { on } = requireBus();
  on('doc', () => publishDoc());
}

function requireBus() {
  return { on: (name, fn) => document.addEventListener('vb:' + name, (ev) => fn(ev.detail)) };
}

export function hookBus(realOn) {
  realOn('doc', () => publishDoc());
}


/* Logical viewport sizes (iframe CSS pixels). Visual chrome is scaled down
   separately so devices fit on smaller screens without breaking @media rules. */
const PREVIEW_DEVICES = {
  phone:   { w: 390,  h: 780,  label: 'Phone' },
  phoneL:  { w: 430,  h: 860,  label: 'Phone L' },
  tablet:  { w: 768,  h: 960,  label: 'Tablet' },
  laptop:  { w: 1200, h: 720,  label: 'Laptop' },
  desktop: { w: 1360, h: 800,  label: 'Desktop' },
  wide:    { w: 1680, h: 900,  label: 'Wide' },
};

/**
 * Apply a device frame to the preview.
 *
 * The frame does one thing: it sets the IFRAME's real viewport width. That is
 * what makes the page's own @media rules fire, which is the only way a preview
 * can honestly tell you how the page will behave on that device.
 */
function applyPreviewDevice(root, kind, widthOverride) {
  if (!root) return;
  const spec = PREVIEW_DEVICES[kind] || PREVIEW_DEVICES.desktop;
  const w = Number(widthOverride) || spec.w;
  const h = spec.h;
  const frame = root.querySelector('iframe');
  const device = root.querySelector('.vb-preview__device');
  const stage = root.querySelector('.vb-preview__stage');
  if (!frame) return;
  /* Keep the iframe at the REAL device width so @media rules fire correctly.
     Only the chrome is visually scaled down to fit the available stage. */
  frame.style.width = w + 'px';
  frame.style.height = h + 'px';
  frame.setAttribute('width', String(w));
  frame.setAttribute('height', String(h));
  if (device) {
    device.setAttribute('data-frame', kind);
    device.style.setProperty('--vb-dev-w', w + 'px');
    device.style.setProperty('--vb-dev-h', h + 'px');
  }
  if (device && stage) {
    const pad = 56;
    const maxW = Math.max(200, stage.clientWidth - pad);
    const maxH = Math.max(160, stage.clientHeight - pad);
    /* Visual chrome is a bit larger than the iframe due to bezel padding. */
    const chromeExtra = 40;
    const scale = Math.min(1, maxW / (w + chromeExtra), maxH / (h + chromeExtra));
    /* Cap scale a bit lower so large devices (desktop/wide) always fit comfortably. */
    const fit = Math.min(scale, kind === 'wide' || kind === 'desktop' ? 0.72 : kind === 'laptop' ? 0.82 : 0.92);
    device.style.transform = fit < 0.995 ? 'scale(' + fit.toFixed(4) + ')' : 'none';
    device.style.transformOrigin = 'center center';
  }
  const size = root.querySelector('.vb-preview__size');
  if (size) size.textContent = w + ' × ' + h + '  ·  ' + (spec.label || kind);
  root.querySelectorAll('.vb-preview__bar [data-frame]').forEach((btn) => {
    const active = btn.getAttribute('data-frame') === kind;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

/**
 * What the preview injects into the page - deliberately almost nothing.
 *
 * The old version injected a stylesheet of !important rules over every element
 * plus a script that scaled <body> down whenever the content was wider than the
 * frame. That did not make the page responsive, it made it *look* narrower
 * while the layout underneath stayed desktop-sized; it also forced
 * `height:auto !important` on every canvas, which collapsed the WebGL surface
 * and is why 3D never appeared in the preview. The exported page now carries
 * its own real @media rules, so the preview only has to supply the viewport.
 */
function withPreviewResponsive(html, viewportWidth) {
  const vw = Number(viewportWidth) || 1280;
  const inject = `
<meta name="viewport" content="width=device-width, initial-scale=1">
<style id="vb-preview-fluid">
  /* Safety net only: never override the page's own layout.
     In particular do NOT force .page to width:100% - the exported page caps it
     at the canvas width and centres it, and overriding that is exactly why a
     centred page looked stretched to the full frame width in the preview. */
  html { -webkit-text-size-adjust: 100%; }
  html, body { margin: 0; }
  /* images and canvases stay inside the frame; note NO height:auto on canvas -
     that collapses a WebGL drawing surface to zero height. */
  img, video, svg { max-width: 100%; }
  img, video { height: auto; }
</style>
<script id="vb-preview-fit">
/* Report overflow so the preview bar can say the page is too wide, instead of
   silently scaling the document and hiding the problem. */
(function () {
  function report() {
    try {
      var de = document.documentElement;
      var over = de.scrollWidth - de.clientWidth;
      var flag = document.querySelector('.vb-preview__overflow');
      if (!flag) return;
      flag.hidden = over <= 2;
      flag.textContent = over > 2 ? ('overflowing by ' + over + 'px') : '';
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', report);
  else report();
  window.addEventListener('load', report);
  window.addEventListener('resize', report);
  setTimeout(report, 120);
  setTimeout(report, 500);
  setTimeout(report, 1500);
})();
</script>`;
  const src = String(html || '');
  if (/<head[\s>]/i.test(src)) {
    return src.replace(/<head([^>]*)>/i, '<head$1>' + inject);
  }
  if (/<html[\s>]/i.test(src)) {
    return src.replace(/<html([^>]*)>/i, '<html$1><head>' + inject + '</head>');
  }
  return '<!DOCTYPE html><html><head>' + inject + '</head><body>' + src + '</body></html>';
}




function ensurePreview() {
  let root = document.getElementById('vb-preview');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'vb-preview';
  root.hidden = true;
  const deviceButtons = [
    ['phone', 'Phone'],
    ['phoneL', 'Phone L'],
    ['tablet', 'Tablet'],
    ['laptop', 'Laptop'],
    ['desktop', 'Desktop'],
    ['wide', 'Wide'],
  ].map(([kind, label]) => {
    const spec = PREVIEW_DEVICES[kind];
    return '<button type="button" class="tb-btn" data-frame="' + kind + '" data-w="' + spec.w
      + '" title="' + spec.w + ' × ' + spec.h + '">' + label + '</button>';
  }).join('');
  root.innerHTML = ''
    + '<div class="vb-preview__bar">'
    + '<strong>Eagle Preview</strong>'
    + '<span class="vb-preview__size"></span>'
    + '<span class="vb-preview__overflow" hidden></span>'
    + '<span class="vb-preview__note">the page reflows for real — these widths drive its own media queries</span>'
    + '<span class="spacer"></span>'
    + deviceButtons
    + '<button type="button" class="tb-btn tb-btn--primary" id="vbPreviewClose">Close</button>'
    + '</div>'
    + '<div class="vb-preview__stage">'
    +   '<div class="vb-preview__device" data-frame="desktop">'
    +     '<div class="vb-preview__bezel"><span class="vb-preview__notch"></span>'
    +       '<iframe title="Page preview" id="vbPreviewFrame"></iframe>'
    +     '</div>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(root);
  root.querySelector('#vbPreviewClose').addEventListener('click', closePreview);
  root.addEventListener('click', (ev) => {
    if (ev.target === root) closePreview();
  });
  root.querySelectorAll('.vb-preview__bar [data-frame]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = btn.getAttribute('data-w');
      const kind = btn.getAttribute('data-frame') || 'desktop';
      applyPreviewDevice(root, kind, w);
      // Re-load for the new viewport width so the page's own media queries
      // are evaluated against the real frame the user picked.
      try {
        const frame = root.querySelector('iframe');
        const raw = frame.__vbRawHtml || '';
        if (raw) {
          frame.srcdoc = withPreviewResponsive(raw, w);
          frame.onload = function () { applyPreviewDevice(root, kind, w); };
        }
      } catch (e) { void e; }
    });
  });
  window.addEventListener('resize', () => {
    const cur = root.querySelector('.vb-preview__device');
    const kind = (cur && cur.getAttribute('data-frame')) || 'desktop';
    const w = (root.querySelector('.vb-preview__bar [data-frame="' + kind + '"]') || {}).getAttribute?.('data-w');
    applyPreviewDevice(root, kind, w);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !root.hidden) closePreview();
  });
  return root;
}

export function closePreview() {
  const root = document.getElementById('vb-preview');
  if (root) {
    root.hidden = true;
    root.style.display = 'none';
    const frame = root.querySelector('iframe');
    if (frame) frame.srcdoc = '';
  }
  state.ui.preview = false;
  const app = document.getElementById('app');
  if (app) app.classList.remove('is-preview');
  try { emit('view'); } catch (e) { void e; }
}

export function openPreview(html) {
  const root = ensurePreview();
  root.hidden = false;
  root.style.display = 'flex';
  const frame = root.querySelector('iframe');
  const doc = currentDoc();
  // Pick device from canvas width / current breakpoint
  const canvasW = Number(doc.canvas && doc.canvas.width) || 1280;
  let kind = 'desktop';
  if (canvasW <= 430) kind = 'phone';
  else if (canvasW <= 900) kind = 'tablet';
  else if (canvasW <= 1360) kind = 'laptop';
  const deviceW = (PREVIEW_DEVICES[kind] || PREVIEW_DEVICES.desktop).w;
  const raw = html || (typeof htmlBundle === 'function' ? htmlBundle() : '');
  frame.__vbRawHtml = raw;
  const source = withPreviewResponsive(raw, deviceW);
  try {
    if (frame.__vbBlobUrl) {
      try { URL.revokeObjectURL(frame.__vbBlobUrl); } catch (e) { /* ignore */ }
      frame.__vbBlobUrl = null;
    }
    frame.removeAttribute('src');
    frame.srcdoc = source;
    frame.onload = function () { applyPreviewDevice(root, kind, deviceW); };
  } catch (e) {
    try {
      const blob = new Blob([source], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      frame.__vbBlobUrl = url;
      frame.src = url;
      frame.onload = function () { applyPreviewDevice(root, kind, deviceW); };
    } catch (e2) {
      console.error('[preview]', e2);
    }
  }
  // Apply chrome immediately (iframe may still be loading content)
  applyPreviewDevice(root, kind, deviceW);
  state.ui.preview = true;
  const app = document.getElementById('app');
  if (app) app.classList.add('is-preview');
}

if (typeof window !== 'undefined') window.__vbShowPreview = openPreview;

export function openCollab() {
  return openModal('Live collaboration', () => {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    wrap.appendChild(h('p', { style: { margin: 0, color: 'var(--text-2)', lineHeight: '1.5' } },
      'Live collaboration keeps every page of the project in sync. Same computer: join a room code in two tabs. Different devices: create a WebRTC invite, send it, then paste their reply. Edits publish automatically while you work.'));
    const code = h('input', { type: 'text', value: room ? room.name : 'studio', spellcheck: 'false' });
    code.style.cssText = fieldCss();
    const status = h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } }, room ? 'Connected to ' + room.name : 'Not connected');
    const join = h('button', { class: 'tb-btn tb-btn--primary', type: 'button' }, 'Join room');
    join.addEventListener('click', () => {
      const name = (code.value || 'studio').trim().slice(0, 40);
      if (channel) channel.close();
      channel = new BroadcastChannel('vb-room-' + name);
      room = { name, transport: 'tab' };
      channel.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.from === selfId || !msg.doc) return;
        applyRemote(msg.doc);
        status.textContent = 'Synced with another tab in room ' + name;
      };
      publishDoc();
      status.textContent = 'Room "' + name + '" is live for other tabs on this computer.';
      toast('Room joined', 'ok');
    });

    const offerBox = h('textarea', { rows: 4, spellcheck: 'false', placeholder: 'WebRTC invite appears here' });
    offerBox.style.cssText = fieldCss() + ';font-family:var(--font-mono);font-size:11px';
    const answerBox = h('textarea', { rows: 3, spellcheck: 'false', placeholder: 'Paste the other person\'s reply' });
    answerBox.style.cssText = offerBox.style.cssText;
    const offerBtn = h('button', { class: 'tb-btn', type: 'button' }, 'Create invite');
    const answerBtn = h('button', { class: 'tb-btn', type: 'button' }, 'Accept reply');

    offerBtn.addEventListener('click', async () => {
      await startPeer(true, offerBox, status);
    });
    answerBtn.addEventListener('click', async () => {
      if (!pc) await startPeer(false, offerBox, status);
      const raw = answerBox.value.trim();
      if (!raw || !pc) return;
      try {
        await pc.setRemoteDescription(JSON.parse(raw));
        status.textContent = 'Reply accepted. Waiting for the data channel.';
      } catch (err) {
        toast('That reply is not valid JSON', 'err');
      }
    });

    wrap.appendChild(label('Room code'));
    wrap.appendChild(code);
    wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, [join]));
    wrap.appendChild(status);
    wrap.appendChild(label('WebRTC invite'));
    wrap.appendChild(offerBox);
    wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, [offerBtn, answerBtn]));
    wrap.appendChild(label('Paste reply'));
    wrap.appendChild(answerBox);
    return wrap;
  }, []);
}

async function startPeer(initiator, offerBox, status) {
  if (pc) {
    try { pc.close(); } catch (e) { void e; }
  }
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  room = { name: 'webrtc', transport: 'webrtc' };
  pc.onicecandidate = () => {
    if (pc.localDescription) offerBox.value = JSON.stringify(pc.localDescription);
  };
  const ready = () => {
    status.textContent = 'WebRTC connected. Edits sync both ways.';
    toast('Peer connected', 'ok');
    publishDoc();
  };
  if (initiator) {
    dc = pc.createDataChannel('vb');
    dc.onopen = ready;
    dc.onmessage = onPeerMessage;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  } else {
    pc.ondatachannel = (ev) => {
      dc = ev.channel;
      dc.onopen = ready;
      dc.onmessage = onPeerMessage;
    };
    const incoming = offerBox.value.trim();
    if (incoming) {
      await pc.setRemoteDescription(JSON.parse(incoming));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      offerBox.value = JSON.stringify(pc.localDescription);
      status.textContent = 'Send the text above back to the person who invited you.';
    }
  }
}

function onPeerMessage(ev) {
  try {
    const msg = JSON.parse(ev.data);
    if (!msg || msg.from === selfId || !msg.doc) return;
    applyRemote(msg.doc);
  } catch (e) { void e; }
}

const TRACKS = [
  { k: 'opacity', l: 'Opacity', min: 0, max: 1, step: 0.05 },
  { k: 'y', l: 'Move Y', min: -80, max: 80, step: 1 },
  { k: 'x', l: 'Move X', min: -80, max: 80, step: 1 },
  { k: 'scale', l: 'Scale', min: 0.6, max: 1.4, step: 0.02 },
];

export function openTimeline() {
  const block = ops.primary();
  if (!block) {
    toast('Select a block first', 'err');
    return;
  }
  block.motion = block.motion || { duration: 900, keys: [
    { t: 0, opacity: 0, y: 24, x: 0, scale: 0.96 },
    { t: 1, opacity: 1, y: 0, x: 0, scale: 1 },
  ] };
  return openModal('Animation timeline', () => {
    const wrap = h('div', { class: 'vb-time' });
    const dur = h('input', { type: 'number', min: 200, max: 8000, step: 50, value: block.motion.duration });
    dur.style.cssText = fieldCss();
    const list = h('div', { class: 'vb-time__keys' });

    const paint = () => {
      clear(list);
      block.motion.keys.sort((a, b) => a.t - b.t);
      block.motion.keys.forEach((key, index) => {
        const row = h('div', { class: 'vb-time__row' });
        row.appendChild(h('span', {}, 'Key ' + (index + 1)));
        const t = h('input', { type: 'number', min: 0, max: 1, step: 0.05, value: key.t, title: 'Time 0 to 1' });
        t.addEventListener('change', () => { key.t = clamp01(t.value); paint(); });
        row.appendChild(t);
        for (const track of TRACKS) {
          const input = h('input', { type: 'number', step: track.step, value: key[track.k] == null ? '' : key[track.k], title: track.l });
          input.addEventListener('change', () => {
            key[track.k] = input.value === '' ? null : Number(input.value);
          });
          row.appendChild(input);
        }
        const del = h('button', { class: 'tb-btn', type: 'button' }, 'Remove');
        del.addEventListener('click', () => {
          block.motion.keys.splice(index, 1);
          paint();
        });
        row.appendChild(del);
        list.appendChild(row);
      });
    };

    const add = h('button', { class: 'tb-btn', type: 'button' }, 'Add keyframe');
    add.addEventListener('click', () => {
      block.motion.keys.push({ t: 0.5, opacity: 1, y: 0, x: 0, scale: 1 });
      paint();
    });
    const play = h('button', { class: 'tb-btn tb-btn--primary', type: 'button' }, 'Play');
    play.addEventListener('click', () => playMotion(block, Number(dur.value) || 900));
    dur.addEventListener('change', () => { block.motion.duration = Number(dur.value) || 900; });

    wrap.appendChild(h('p', { style: { margin: 0, color: 'var(--text-2)' } }, 'Keyframes for the selected block. Time runs from 0 to 1. Play previews it on the canvas.'));
    wrap.appendChild(label('Duration (ms)'));
    wrap.appendChild(dur);
    wrap.appendChild(h('div', { class: 'vb-time__head' }, ['', 'Time', 'Opacity', 'Y', 'X', 'Scale', ''].map((n) => h('span', {}, n))));
    wrap.appendChild(list);
    wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, [add, play]));
    paint();
    return wrap;
  }, []);
}

function clamp01(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sample(keys, k, t) {
  const pts = keys.filter((key) => key[k] != null && key[k] !== '').sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  if (t <= pts[0].t) return Number(pts[0][k]);
  if (t >= pts[pts.length - 1].t) return Number(pts[pts.length - 1][k]);
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (t >= pts[i].t && t <= pts[i + 1].t) {
      const u = (t - pts[i].t) / Math.max(0.0001, pts[i + 1].t - pts[i].t);
      return lerp(Number(pts[i][k]), Number(pts[i + 1][k]), u);
    }
  }
  return null;
}

function playMotion(block, duration) {
  const node = document.querySelector('[data-id="' + block.id + '"]');
  if (!node) return;
  const keys = block.motion.keys || [];
  const start = performance.now();
  const base = node.style.transform;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const opacity = sample(keys, 'opacity', t);
    const x = sample(keys, 'x', t) || 0;
    const y = sample(keys, 'y', t) || 0;
    const scale = sample(keys, 'scale', t);
    if (opacity != null) node.style.opacity = String(opacity);
    node.style.transform = 'translate(' + x + 'px,' + y + 'px)' + (scale != null ? ' scale(' + scale + ')' : '');
    if (t < 1) requestAnimationFrame(tick);
    else setTimeout(() => {
      node.style.opacity = '';
      node.style.transform = base;
      emit('doc');
    }, 240);
  };
  requestAnimationFrame(tick);
}

const SAMPLES = {
  article: { title: 'The quiet relaunch', text: 'A shorter page, a clearer offer, and a form that actually gets read.', author: 'Hana Adel', price: '24' },
  product: { title: 'Field notebook', text: 'Paper cover, 192 pages, lies flat.', author: 'Atelier', price: '18' },
  person: { title: 'Lina Farouk', text: 'Design lead. Ships the interface and the words.', author: 'Team', price: '' },
};

export function openCms() {
  const doc = currentDoc();
  doc.cms = doc.cms || { sample: 'article', json: JSON.stringify(SAMPLES.article, null, 2) };
  return openModal('CMS preview', () => {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(h('p', { style: { margin: 0, color: 'var(--text-2)', lineHeight: '1.5' } },
      'Paste JSON or load a sample, then push fields into the selected block. Title, text, and brand are filled when those props exist.'));
    const pick = h('select');
    ['article', 'product', 'person'].forEach((id) => pick.appendChild(h('option', { value: id }, id)));
    pick.value = doc.cms.sample || 'article';
    const ta = h('textarea', { rows: 8, spellcheck: 'false' });
    ta.style.cssText = fieldCss() + ';font-family:var(--font-mono);font-size:12px';
    ta.value = doc.cms.json || '';
    pick.addEventListener('change', () => {
      doc.cms.sample = pick.value;
      ta.value = JSON.stringify(SAMPLES[pick.value], null, 2);
    });
    const url = h('input', { type: 'url', placeholder: 'https://example.com/post.json', spellcheck: 'false' });
    url.style.cssText = fieldCss();
    const load = h('button', { class: 'tb-btn', type: 'button' }, 'Fetch URL');
    load.addEventListener('click', async () => {
      if (!url.value) return;
      try {
        const res = await fetch(url.value);
        const data = await res.json();
        ta.value = JSON.stringify(data, null, 2);
        toast('Loaded', 'ok');
      } catch (err) {
        toast('Could not fetch that URL (blocked or invalid)', 'err');
      }
    });
    const apply = h('button', { class: 'tb-btn tb-btn--primary', type: 'button' }, 'Apply to selection');
    apply.addEventListener('click', () => {
      let data;
      try { data = JSON.parse(ta.value); } catch (e) {
        toast('JSON is not valid', 'err');
        return;
      }
      doc.cms.json = ta.value;
      const ids = Array.from(state.selection);
      const targets = ids.length ? ids : (currentDoc().children || []).map((b) => b.id);
      let n = 0;
      for (const id of targets) {
        const b = ops.findBlock(id);
        if (!b) continue;
        if (data.title && 'title' in (b.props || {})) { ops.setProp(id, 'title', data.title); n += 1; }
        if (data.title && 'text' in (b.props || {}) && !('title' in (b.props || {}))) { ops.setProp(id, 'text', data.title); n += 1; }
        if (data.text && 'text' in (b.props || {})) { ops.setProp(id, 'text', data.text); n += 1; }
        if (data.brand || data.author) {
          if ('brand' in (b.props || {})) ops.setProp(id, 'brand', data.brand || data.author);
        }
        if (data.price && 'price' in (b.props || {})) ops.setProp(id, 'price', data.price);
      }
      emit('doc');
      toast(n ? 'CMS fields applied' : 'No matching fields on the selection', n ? 'ok' : 'err');
      closeModal();
    });
    wrap.appendChild(label('Sample'));
    wrap.appendChild(pick);
    wrap.appendChild(ta);
    wrap.appendChild(url);
    wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, [load, apply]));
    return wrap;
  }, []);
}

export function openForms() {
  return openModal('Form inbox', () => {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(h('p', { style: { margin: 0, color: 'var(--text-2)' } },
      'Submissions from previewed forms stay in this browser. Required and email fields are checked before a row is saved.'));
    const list = h('div', { class: 'vb-inbox' });
    const paint = () => {
      clear(list);
      const rows = readSubs();
      if (!rows.length) {
        list.appendChild(h('div', { class: 'pal-empty' }, 'No submissions yet. Preview the page and send a form.'));
        return;
      }
      for (const row of rows) {
        const card = h('div', { class: 'vb-inbox__card' });
        card.appendChild(h('strong', {}, new Date(row.at).toLocaleString()));
        const data = row.data || {};
        for (const key of Object.keys(data)) {
          card.appendChild(h('div', {}, key + ': ' + data[key]));
        }
        list.appendChild(card);
      }
    };
    const clearBtn = h('button', { class: 'tb-btn', type: 'button' }, 'Clear inbox');
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem(SUB_KEY);
      paint();
    });
    paint();
    wrap.appendChild(clearBtn);
    wrap.appendChild(list);
    return wrap;
  }, []);
}

function readSubs() {
  try { return JSON.parse(localStorage.getItem(SUB_KEY) || '[]'); } catch (e) { return []; }
}

const PACKS = [
  { name: 'Hero pack', blocks: [{ type: 'navbar' }, { type: 'hero' }] },
  { name: 'Pricing pack', blocks: [{ type: 'pricingSection' }, { type: 'faqSection' }] },
  { name: 'Contact pack', blocks: [{ type: 'contactSection' }, { type: 'form' }] },
  { name: 'Story pack', blocks: [{ type: 'features' }, { type: 'testimonialsSection' }, { type: 'ctaBanner' }] },
];

export function openMarket() {
  return openModal('Block marketplace', () => {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    wrap.appendChild(h('p', { style: { margin: 0, color: 'var(--text-2)', lineHeight: '1.5' } },
      'Insert a starter pack, or share a .vbblock.json from Block actions. Files you import land as editable blocks.'));
    const grid = h('div', { class: 'cardgrid' });
    for (const pack of PACKS) {
      const b = h('button', { class: 'cardopt', type: 'button' }, [
        h('strong', {}, pack.name),
        h('span', {}, pack.blocks.map((x) => x.type).join(', ')),
      ]);
      b.addEventListener('click', () => {
        for (const block of pack.blocks) ops.addBlock(block.type);
        toast(pack.name + ' added', 'ok');
        closeModal();
      });
      grid.appendChild(b);
    }
    const imp = h('button', { class: 'tb-btn', type: 'button' }, 'Import .vbblock.json');
    imp.addEventListener('click', async () => {
      const done = await blocks.importFromFiles({ filter: 'json', intent: 'block', multiple: true, title: 'Import blocks' });
      toast(done.length ? 'Blocks imported' : 'Nothing imported', done.length ? 'ok' : 'err');
      if (done.length) closeModal();
    });
    const save = h('button', { class: 'tb-btn', type: 'button' }, 'Export selection');
    save.addEventListener('click', () => {
      const name = blocks.exportSelection();
      toast(name ? 'Saved ' + name : 'Select a block first', name ? 'ok' : 'err');
    });
    wrap.appendChild(grid);
    wrap.appendChild(h('div', { style: { display: 'flex', gap: '8px' } }, [imp, save]));
    return wrap;
  }, []);
}

function label(text) {
  return h('label', { class: 'row__label' }, text);
}

function fieldCss() {
  return 'width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-2);color:var(--text)';
}

void applyTransform;
