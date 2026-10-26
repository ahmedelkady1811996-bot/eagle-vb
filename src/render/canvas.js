import * as frameworkHost from './frameworkhost.js';
import { currentDoc, find } from '../core/store.js';
import { get as getDef } from '../model/registry.js';
import { canHaveChildren, semanticTag } from '../model/catalog.js';
import { nodeStyleFor, isFreeMode, buildDocumentStylesheet } from './stylesheet.js';
import { styleToCss } from '../model/css.js';
import { renderLive } from './live.js';

const nodes = new Map();
let canvasEl = null;

export function canvas() {
  if (!canvasEl || !canvasEl.isConnected) canvasEl = document.getElementById('canvas');
  return canvasEl;
}

export function nodeFor(id) {
  return nodes.get(id) || null;
}

export function nodeMap() {
  return nodes;
}

/**
 * The element a block is drawn as.
 *  - an imported block IS the original element (same tag, same class names)
 *  - a framework block IS its own custom element (<my-counter>)
 *  - everything else is a plain div wrapper
 */
function nodeTag(block) {
  const def = getDef(block.type);
  if (def && def.customTag) return semanticTag(block);
  return importedTag(block) || 'div';
}

function createNode(block, doc) {
  const def = getDef(block.type);
  /* An imported block IS the original element: same tag, same class names, so
     the page's own stylesheet lays it out exactly like a browser does. A
     builder-made block keeps the plain div wrapper. A framework block is its
     own custom element so the framework host can mount the real component. */
  const tag = nodeTag(block);
  const el = document.createElement(tag);
  el.className = nodeClass(block, def);
  el.dataset.id = block.id;
  el.dataset.type = block.type;

  const content = document.createElement('div');
  content.className = 'vb-c';
  el.appendChild(content);

  if (canHaveChildren(block)) {
    const kids = document.createElement('div');
    kids.className = 'vb-k';
    el.appendChild(kids);
  }
  nodes.set(block.id, el);
  return el;
}

function importedTagOf(tag) {
  const t = String(tag || '').toLowerCase();
  return /^(div|section|header|footer|nav|main|article|aside|ul|ol|li|p|h1|h2|h3|h4|h5|h6|a|span|label|figure|blockquote|table|thead|tbody|tr|td|th|form|details|summary|dl|dt|dd)$/.test(t) ? t : 'div';
}

function importedTag(block) {
  const p = block && block.props;
  if (!p || !p._imported || !p._tag) return '';
  return importedTagOf(p._tag);
}

function nodeClass(block, def) {
  const base = 'vb-b' + (def && def.container ? ' vb-b--container' : '');
  const own = block.props && block.props._cls ? ' ' + String(block.props._cls) : '';
  return (base + own).trim();
}

function updateNode(el, block, doc) {
  el.__vbBlock = block;
  const p = block.props || {};
  /* The element's own inline declarations come first, then the builder's style.
     An imported block still has to be resizable and draggable, so its style is
     emitted like any other block's - it simply starts out empty because the
     importer no longer guesses. */
  const own = p._css || (block.style && block.style._css) || '';
  let css = nodeStyleFor(block, doc);
  if (own) css = own + (css ? ';' + css : '');
  const wantTag = nodeTag(block);
  if (el.tagName.toLowerCase() !== wantTag) {
    /* the tag changed (the block was re-imported) - rebuild the wrapper.
       Compare against the SAME resolved tag createNode uses: comparing with
       the bare importedTag() returns '' for a builder-made block, which is
       never equal to 'div' and recursed until the stack blew. */
    const replacement = createNode(block, doc);
    if (el.parentNode) el.parentNode.replaceChild(replacement, el);
    nodes.set(block.id, replacement);
    return updateNode(replacement, block, doc);
  }
  const wantClass = nodeClass(block, getDef(block.type));
  if (el.className !== wantClass) el.className = wantClass;
  if (el.getAttribute('style') !== css) el.setAttribute('style', css);
  if (el.dataset.type !== block.type) el.dataset.type = block.type;
  el.classList.toggle('vb-b--container', canHaveChildren(block));
  // Interactions for export + runtime
  if (block.events && block.events.length) {
    try { el.dataset.vbEvents = JSON.stringify(block.events); }
    catch (e) { el.removeAttribute('data-vb-events'); }
  } else {
    el.removeAttribute('data-vb-events');
  }
  if (block.props && block.props.onclick) el.setAttribute('data-vb-onclick', String(block.props.onclick));
  else el.removeAttribute('data-vb-onclick');

  const sig = propsSignature(block);
  if (el.dataset.sig !== sig) {
    el.dataset.sig = sig;
    const def = getDef(block.type);
    let html = '';
    // Prefer live children over baked HTML so each nested piece is selectable
    const hasKids = Array.isArray(block.children) && block.children.length > 0;
    const p = block.props || {};
    if (p._imported) {
      /* An imported block renders its OWN markup, with its own class names,
         so the page's stylesheet styles it exactly like the browser does. */
      html = p._html != null ? p._html : '';
    } else if (def && def.customTag) {
      /* A framework block's content is mounted by the framework host, not by
         the renderer. Wiping it here would destroy the live component on
         every repaint. */
      html = '';
    } else if (def && def.render && !hasKids) {
      try {
        html = def.render(p, block.style || {}, block) || '';
      } catch (err) {
        console.error('[render:' + block.type + ']', err);
        html = '<div class="vb-render-error">' + String(err && err.message) + '</div>';
      }
    }
    if (!def || !def.customTag) el.firstChild.innerHTML = html;
  }
  forceTypography(el, block);
  return el;
}

function pxLen(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return value + 'px';
  const raw = String(value).trim();
  if (/^-?\d*\.?\d+$/.test(raw)) return raw + 'px';
  return raw;
}

function forceTypography(el, block) {
  const s = block.style || {};
  const content = el.querySelector(':scope > .vb-c');
  if (!content) return;
  const pairs = [];
  if (s.color) pairs.push(['color', String(s.color)]);
  if (s.fontFamily) pairs.push(['font-family', String(s.fontFamily)]);
  if (s.fontSize != null && s.fontSize !== '') pairs.push(['font-size', pxLen(s.fontSize)]);
  if (s.fontWeight) pairs.push(['font-weight', String(s.fontWeight)]);
  if (s.fontStyle) pairs.push(['font-style', String(s.fontStyle)]);
  if (s.textAlign) pairs.push(['text-align', String(s.textAlign)]);
  if (s.lineHeight != null && s.lineHeight !== '') pairs.push(['line-height', String(s.lineHeight)]);
  if (s.letterSpacing != null && s.letterSpacing !== '') pairs.push(['letter-spacing', pxLen(s.letterSpacing)]);
  const deco = s.decoration || s.textDecor;
  if (deco) pairs.push(['text-decoration', String(deco)]);
  const nodes = [content].concat(Array.from(content.querySelectorAll('*')));
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    for (const pair of pairs) node.style.setProperty(pair[0], pair[1], 'important');
  }
}

function propsSignature(block) {
  const p = block.props || {};
  let out = block.type;
  for (const key in p) {
    const v = p[key];
    out += '|' + key + '=' + (Array.isArray(v) ? v.join('') : v);
  }
  return out;
}

function reconcileChildren(parentEl, blocks, doc) {
  // Keep all blocks in the editor tree; hidden ones are faded, not removed
  const wanted = blocks || [];
  let index = 0;
  for (const block of wanted) {
    let el = nodes.get(block.id);
    if (!el || !el.isConnected) el = createNode(block, doc);
    updateNode(el, block, doc);
    el.classList.toggle('is-hidden', !!block.hidden);
    el.style.opacity = block.hidden ? '0.35' : '';
    el.style.outline = block.hidden ? '1px dashed var(--line-2, #888)' : '';
    if (parentEl.children[index] !== el) {
      parentEl.insertBefore(el, parentEl.children[index] || null);
    }
    if (canHaveChildren(block)) {
      const kids = el.querySelector(':scope > .vb-k');
      if (kids) reconcileChildren(kids, block.children || [], doc);
    }
    index += 1;
  }
  while (parentEl.children.length > index) {
    const extra = parentEl.children[index];
    const id = extra.dataset.id;
    if (id) nodes.delete(id);
    parentEl.removeChild(extra);
  }
}

export function renderCanvas() {
  const doc = currentDoc();
  const root = canvas();
  if (!root) return;

  root.dataset.mode = doc.canvas && doc.canvas.mode === 'free' ? 'free' : 'flow';

  /* Carry the page's <html> class list onto the canvas. A class-based dark
     mode compiles to `.dark .x{}`, and the scoped page CSS prefixes those to
     `#canvas .dark .x{}` - so without the class on #canvas every dark variant
     silently does nothing and a dark platform renders light inside the editor. */
  const pageClass = String((doc.head && doc.head.htmlClass) || '');
  root.classList.add('vbpage');
  for (const c of pageClass.split(/\s+/)) {
    if (c) root.classList.add(c);
  }
  root.setAttribute('dir', doc.dir || 'ltr');
  if (doc.dir) root.classList.toggle('is-rtl', true);
  else root.classList.remove('is-rtl');
  /* In the live canvas the native tree is only the model behind the page, so it
     is hidden - otherwise both renderings stack on top of each other. */
  root.classList.toggle('is-live', !!doc.canvas.live);

  const alive = new Set();
  const mark = (blocks) => {
    for (const b of blocks) {
      alive.add(b.id);
      if (canHaveChildren(b)) mark(b.children || []);
    }
  };
  mark(doc.children || []);

  for (const id of Array.from(nodes.keys())) {
    if (alive.has(id)) continue;
    const el = nodes.get(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    nodes.delete(id);
  }

  reconcileChildren(root, doc.children || [], doc);
  buildDocumentStylesheet();
  renderLive.refresh(root);
  if (doc.canvas.live) root.classList.add('is-live');
  /* Register every framework component so the custom elements exist and the
     author's real component is mounted inside its block on the canvas. */
  try { frameworkHost.syncDocument(doc.children || []); } catch (e) { void e; }
}

export function updateBlockNode(block) {
  const doc = currentDoc();
  const el = nodes.get(block.id);
  if (!el) {
    renderCanvas();
    return;
  }
  updateNode(el, block, doc);
  const def = getDef(block.type);
  if (def && (def.container || canHaveChildren(block))) reconcileChildren(el.querySelector(':scope > .vb-k') || el, block.children || [], doc);
}

export function removeNodesFor(blocks) {
  for (const b of blocks) {
    const el = nodes.get(b.id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    nodes.delete(b.id);
  }
}

function threeExportAttrs(block) {
  const type = block.type || '';
  if (type.indexOf('three_') !== 0 && type !== 'model3d') return [];
  const p = block.props || {};
  const s = block.style || {};
  // Serialize viewer config (skip huge nested companions binary)
  const cfg = {};
  const keys = [
    'shape', 'scale', 'color', 'color2', 'metalness', 'roughness', 'flatShading', 'wireframe',
    'side', 'emissive', 'emissiveIntensity', 'opacity', 'spin', 'spinSpeed', 'wobble', 'wobbleAmount',
    'scrollSpin', 'scrollTurns', 'autoRotate', 'orbitSpeed', 'orbit', 'pan', 'damping',
    'fov', 'camX', 'camY', 'camDist', 'targetX', 'targetY', 'targetZ', 'minDist', 'maxDist',
    'ambient', 'ambientColor', 'key', 'keyColor', 'fill', 'fillColor', 'rim', 'rimColor',
    'shadows', 'bg', 'fog', 'exposure', 'ground', 'planeFloor', 'floorColor', 'gridColor',
    'gridLines', 'groundSize', 'preset', 'count', 'spread', 'tint', 'tintColor', 'modelOpacity',
    'srcName',
  ];
  for (const k of keys) {
    if (p[k] != null && p[k] !== '') cfg[k] = p[k];
  }
  if (s.h != null) cfg.h = s.h;
  if (s.minH != null) cfg.h = cfg.h || s.minH;
  const attrs = [];
  try {
    const json = JSON.stringify(cfg).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    attrs.push('data-vb-3d="' + json + '"');
  } catch (e) {
    void e;
  }
  // Kind + name on attributes; full model body lives in child <script class="vb-model-src">
  if (p.src) {
    const src = String(p.src);
    const name = String(p.srcName || '');
    const kind = /\.obj$/i.test(name) || /model\/obj/i.test(src.slice(0, 80)) ? 'obj'
      : /\.stl$/i.test(name) ? 'stl'
      : /\.fbx$/i.test(name) ? 'fbx'
      : /\.gltf$/i.test(name) ? 'gltf'
      : 'gltf';
    if (name) attrs.push('data-model-name="' + name.replace(/"/g, '&quot;') + '"');
    attrs.push('data-model-kind="' + kind + '"');
    attrs.push('data-has-model="1"');
    // Small remote URLs can stay on attribute; huge data-URLs go only in script body
    if (src.length < 8000 && !/^data:/i.test(src)) {
      attrs.push('data-model-src="' + src.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"');
    }
  }
  if (p.companions) {
    try {
      const c = typeof p.companions === 'string' ? JSON.parse(p.companions) : p.companions;
      if (c && c.mtl && c.mtl.src) attrs.push('data-has-mtl="1"');
    } catch (e) { void e; }
  }
  return attrs;
}

export function exportNodeFor(block, doc) {
  const def = getDef(block.type);
  const p = block.props || {};
  const imported = !!p._imported;
  /* An imported block exports as the original element - its own tag and class
     names - so the page's own stylesheet reproduces the original design. */
  const tag = imported && importedTagOf(p._tag) || semanticTag(block);
  const attrs = [];
  const cls = 'vb-' + block.type + (def && def.container ? ' vb-b--container' : '')
    + (p._cls ? ' ' + String(p._cls) : '');
  attrs.push('class="' + String(cls).replace(/"/g, '&quot;') + '"');
  attrs.push('data-type="' + block.type + '"');
  attrs.push('data-id="' + block.id + '"');
  const a11y = block.a11y || {};
  if (a11y.label) attrs.push('aria-label="' + String(a11y.label).replace(/"/g, '&quot;') + '"');
  if (a11y.role) attrs.push('role="' + a11y.role + '"');
  if (a11y.tabIndex != null && a11y.tabIndex !== '') attrs.push('tabindex="' + a11y.tabIndex + '"');
  if (a11y.id && !p._idEmitted) attrs.push('id="' + a11y.id + '"');

  // 3D blocks: serialize props + model so preview/export can mount WebGL
  for (const a of threeExportAttrs(block)) attrs.push(a);

  let styleAttr = '';
  if (imported) {
    /* the element's own inline declarations, then the builder's style, so a
       resize the user made survives the export */
    const own = p._css || '';
    const mine = styleToCss(Object.assign({}, block.style, { pos: 'relative', x: undefined, y: undefined }));
    const all = [own, mine].filter(Boolean).join(';');
    if (all) styleAttr = ' style="' + all.replace(/"/g, '&quot;') + '"';
  }

  /* 3D hosts still need a real box to paint into. It is emitted into the
     stylesheet as well - see threeHostCss() in io/exporter.js. */
  const is3d = (block.type || '').indexOf('three_') === 0 || block.type === 'model3d';

  let inner = '';
  const hasKids = Array.isArray(block.children) && block.children.length > 0;
  if (imported) {
    /* An imported block renders only what the element really had. Falling back
       to def.render() here is what put a stock white "Input" widget and a
       default "Button" into a page that had a real <input> and a real
       <button>. A void element needs no inner markup at all. */
    inner = p._html != null ? p._html : '';
  } else if (def && def.render && !hasKids) {
    /* A container must NOT also render the block default: that is what put a
       stock "Card title / Button / Input" panel on top of a page's real
       content. Its children are the content. */
    try {
      inner = def.render(block.props || {}, block.style || {}, block) || '';
    } catch (err) {
      inner = '';
    }
  }
  // Embed model payloads inside the host (script tags) so large GLB/OBJ survive export
  if (is3d && block.props && block.props.src) {
    const src = String(block.props.src);
    // Avoid breaking out of HTML if payload contains </script>
    const safe = src.replace(/</script/gi, '<\\/script');
    inner += '\n<script type="text/plain" class="vb-model-src">' + safe + '</script>';
    if (block.props.companions) {
      try {
        const c = typeof block.props.companions === 'string'
          ? JSON.parse(block.props.companions)
          : block.props.companions;
        if (c && c.mtl && c.mtl.src) {
          const mtlSafe = String(c.mtl.src).replace(/</script/gi, '<\\/script');
          inner += '\n<script type="text/plain" class="vb-model-mtl">' + mtlSafe + '</script>';
        }
        // Prefer durable data-URL maps for export; fall back to textures if already data:
        const texSource = (c.texturesData && typeof c.texturesData === 'object' && Object.keys(c.texturesData).length)
          ? c.texturesData
          : (c.textures && typeof c.textures === 'object' ? c.textures : null);
        if (texSource) {
          const durable = {};
          for (const k of Object.keys(texSource)) {
            const v = texSource[k];
            if (typeof v === 'string' && (v.indexOf('data:') === 0 || v.indexOf('http') === 0)) durable[k] = v;
          }
          if (Object.keys(durable).length) {
            const texSafe = JSON.stringify(durable).replace(/</script/gi, '<\\/script');
            inner += '\n<script type="application/json" class="vb-model-textures">' + texSafe + '</script>';
          }
        }
      } catch (e) {
        void e;
      }
    }
  }
  const kids = (block.children || []).map((child) => exportNodeFor(child, doc)).join('\n');
  if (!inner && !kids) return '<' + tag + ' ' + attrs.join(' ') + styleAttr + '></' + tag + '>';
  return '<' + tag + ' ' + attrs.join(' ') + styleAttr + '>\n' + inner + (inner && kids ? '\n' : '') + kids + '\n</' + tag + '>';
}

export function blockAt(id) {
  return find(currentDoc(), id);
}



export { isFreeMode };
