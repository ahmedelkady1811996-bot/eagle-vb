import { findAll, currentDoc } from '../core/store.js';
import { styleToCss, stateToCss, animRule, keyframesFor } from '../model/css.js';
import { get as getDef } from '../model/registry.js';
import { breakpointWidth } from '../model/options.js';

let sheetEl = null;

function ensureSheet() {
  if (sheetEl && sheetEl.isConnected) return sheetEl;
  sheetEl = document.getElementById('vb-doc-css');
  if (!sheetEl) {
    sheetEl = document.createElement('style');
    sheetEl.id = 'vb-doc-css';
    document.head.appendChild(sheetEl);
  }
  return sheetEl;
}

export function buildDocumentStylesheet() {
  const doc = currentDoc();
  const rules = [];
  const frames = new Set();

  for (const entry of findAll(doc)) {
    const b = entry.block;
    const sel = '[data-id="' + b.id + '"]';

    for (const stateName in b.states) {
      const patch = b.states[stateName];
      if (!patch || !Object.keys(patch).length) continue;
      const pseudo = stateName === 'focus' ? ':focus-within' : ':' + stateName;
      const decls = [];
      for (const key in patch) {
        const value = patch[key];
        if (value == null || value === '') continue;
        if (key === 'scale') decls.push('transform:scale(' + value + ')');
        else if (key === 'rotate') decls.push('transform:rotate(' + value + ')');
        else decls.push(key.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + value);
      }
      if (decls.length) rules.push(sel + pseudo + '{' + decls.join(';') + '}');
    }

    const anim = b.style && b.style.anim;
    if (anim && anim !== 'none') {
      frames.add(anim);
      rules.push(animRule(b.style, sel));
    }

    const resp = b.responsive;
    if (resp) {
      for (const bp of ['tablet', 'mobile']) {
        const patch = resp[bp];
        if (!patch) continue;
        const decls = [];
        for (const key in patch) {
          if (key === 'style' && patch.style) {
            const nested = styleToCss(patch.style).split(';').filter(Boolean);
            for (const d of nested) decls.push(d);
            continue;
          }
          if (patch[key] == null || patch[key] === '') continue;
          if (key === 'hidden') continue;
          decls.push(key.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + patch[key]);
        }
        if (patch.hidden) decls.push('display:none');
        if (decls.length) {
          rules.push('@media (max-width:' + (bp === 'mobile' ? breakpointWidth('mobile') : breakpointWidth('tablet')) + 'px){' + sel + '{' + decls.join(';') + '}}');
        }
      }
    }
  }

  for (const anim of frames) {
    const kf = keyframesFor(anim);
    if (kf) rules.push(kf);
  }

  const canvas = doc.canvas || {};
  const w = Number(canvas.width) || 1280;
  const minH = Number(canvas.minHeight) || 720;
  rules.push('#canvas{width:' + w + 'px !important;min-width:' + w + 'px !important;max-width:none !important;min-height:' + minH + 'px;background:' + (canvas.background || '#fff') + ';box-sizing:border-box;}');

  ensureSheet().textContent = rules.join('\n');
}

export function clearDocumentStylesheet() {
  if (sheetEl) sheetEl.textContent = '';
}

export function nodeStyleFor(block, doc) {
  const free = isFreeMode(doc);
  const s = Object.assign({}, block.style || {});
  /* Free: artboard is the positioning context. Absolute keeps left/top;
     everything else stays static so it does not create a containing block. */
  if (!free) s.pos = 'relative';
  else if (s.pos !== 'absolute') delete s.pos;
  return styleToCss(s);
}

export function isFreeMode(doc) {
  return !!(doc && doc.canvas && doc.canvas.mode === 'free');
}

export function labelText(block) {
  const def = getDef(block.type);
  return block.name || (def ? def.label : block.type);
}