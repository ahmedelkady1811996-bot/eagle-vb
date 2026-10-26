import * as host from './host.js';
import * as project from './project.js';
import { currentDoc, state, findAll } from '../core/store.js';
import { ensureTokens, tokensToCss } from '../model/tokens.js';
import { exportNodeFor } from '../render/canvas.js';
import { get as getDef } from '../model/registry.js';
import { styleToCss } from '../model/css.js';
import { escapeHtml, slug, download } from '../core/util.js';
import { buildZip } from './zip.js';
import { usedFrameworks, frameworkScripts, safeScript } from '../lib/frameworks.js';
import { backendScriptsFor } from '../lib/backend.js';
import { databaseScriptsFor } from '../lib/cmsdb.js';

export const FORMATS = [
  { id: 'html', label: 'HTML (single file)' },
  { id: 'split', label: 'HTML + CSS + JS (ZIP)' },
  { id: 'css', label: 'CSS only' },
  { id: 'js', label: 'JavaScript only' },
  { id: 'react', label: 'React (JSX)' },
  { id: 'vue', label: 'Vue SFC' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'astro', label: 'Astro' },
  { id: 'tailwind', label: 'Tailwind classes' },
  { id: 'json', label: 'Project JSON' },
];

function docTitle() {
  return (currentDoc().name || 'Untitled').trim();
}

/**
 * Everything the exported page needs beyond its markup: the framework
 * components (their own ES modules), the API client and the database client.
 *
 * Each part is independent, so a page that uses none of them carries none of
 * them and stays a plain HTML file.
 */
function runtimeBitsFor(doc, bodyStr) {
  const parts = [];
  const blocks = (doc && doc.children) || [];
  try {
    const comps = usedFrameworks(blocks);
    if (comps.length) parts.push(frameworkScripts(comps));
  } catch (e) { void e; }
  try {
    const api = backendScriptsFor(doc);
    if (api) parts.push(api);
  } catch (e) { void e; }
  try {
    const db = databaseScriptsFor(doc);
    if (db) parts.push(db);
  } catch (e) { void e; }
  return parts.filter(Boolean).join('\n');
}

function allPages() {
  try {
    project.ensurePagesSynced();
  } catch (e) {
    void e;
  }
  if (state.pages && state.pages.length) {
    return state.pages.map((p) => ({
      id: p.id,
      name: p.name || 'Page',
      doc: p.doc || (p.id === state.pageId ? currentDoc() : null),
    })).filter((p) => p.doc);
  }
  return [{ id: 'page1', name: docTitle(), doc: currentDoc() }];
}

function bodyHtmlFor(doc) {
  return (doc.children || []).map((b) => exportNodeFor(b, doc)).join('\n');
}

function bodyHtml() {
  return bodyHtmlFor(currentDoc());
}

function pageFileName(page, index) {
  const base = slug(page.name || ('page-' + (index + 1)));
  return index === 0 ? 'index.html' : base + '.html';
}

function navHtml(pages, currentIndex) {
  if (pages.length < 2) return '';
  const links = pages.map((p, i) => {
    const href = pageFileName(p, i);
    const cls = i === currentIndex ? ' class="is-current"' : '';
    return '<a href="' + href + '"' + cls + '>' + escapeHtml(p.name || ('Page ' + (i + 1))) + '</a>';
  }).join('\n  ');
  return '<nav class="vb-site-nav" style="display:flex;gap:12px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid #e2e8f0;font:600 13px system-ui,sans-serif">\n  ' + links + '\n</nav>';
}

/**
 * The <head> links a document declares.
 *
 * Web fonts, icon sets and a theme colour are part of a page's identity. The
 * export used to hard-code <html lang="en"> and emit no external assets at all,
 * so an Arabic page built on Cairo/Amiri and Font Awesome came out with the
 * system font, no icons and left-to-right text.
 */
function headTagsFor(doc) {
  const head = doc.head || {};
  const lang = escapeHtml(doc.lang || 'en');
  const dir = doc.dir ? ' dir="' + escapeHtml(doc.dir) + '"' : '';
  const out = [];
  /* The page's own stylesheets and scripts come FIRST - Tailwind and friends
     generate the utilities the imported markup depends on. */
  if (Array.isArray(head.scripts)) {
    for (const src of head.scripts) if (src) out.push('<script src="' + escapeHtml(src) + '"></script>');
  }
  if (Array.isArray(head.styles)) {
    for (const s of head.styles) if (s) out.push('<style>\n' + s + '\n</style>');
  }
  if (Array.isArray(head.links)) {
    for (const href of head.links) if (href) out.push('<link rel="stylesheet" href="' + escapeHtml(href) + '">');
  }
  if (head.fonts) {
    out.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
    out.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    out.push('<link rel="stylesheet" href="' + escapeHtml(head.fonts) + '">');
  }
  if (head.iconCss) out.push('<link rel="stylesheet" href="' + escapeHtml(head.iconCss) + '">');
  if (head.themeColor) out.push('<meta name="theme-color" content="' + escapeHtml(head.themeColor) + '">');
  return { htmlTag: '<html lang="' + lang + '"' + dir + '>', tags: out.join('\n') };
}

/** Document-level typography so a page keeps its type system as a whole. */
function rootTypographyFor(doc) {
  const fonts = (doc.tokens && doc.tokens.font) || {};
  const rules = [];
  const sans = fonts.sans || 'system-ui,-apple-system,Segoe UI,sans-serif';
  const display = fonts.display || sans;
  if (doc.dir === 'rtl' || /^(ar|he|fa|ur)\b/.test(doc.lang || '')) {
    rules.push('html{direction:rtl;text-align:right}');
  }
  rules.push('body{font-family:' + sans + '}');
  rules.push('h1,h2,h3,h4,h5,h6,.vb-heading{font-family:' + display + '}');
  return rules.join('\n');
}

function htmlForPage(page, index, pages) {
  const doc = page.doc;
  const title = page.name || docTitle();
  const css = cssOnlyFor(doc);
  const body = bodyHtmlFor(doc);
  const nav = navHtml(pages, index);
  const tokenCss = tokensToCss(ensureTokens(doc));
  const threeBits = threeBitsFor(doc, body);
  const runtimeBits = runtimeBitsFor(doc, body);
  const head = headTagsFor(doc);
  return `<!DOCTYPE html>
${head.htmlTag}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${head.tags}
<style>
:root{${tokenCss}}
${rootTypographyFor(doc)}
body{margin:0;font-family:var(--font-sans,system-ui,sans-serif);color:var(--color-text,#0f172a);background:var(--color-surface,#fff)}
${css}
[data-type^="three_"],[data-type="model3d"]{position:relative;min-height:280px;overflow:hidden}
.vb-site-nav a{color:#334155;text-decoration:none}
.vb-site-nav a.is-current{color:var(--color-primary,#4f46e5)}
</style>
</head>
<body class="vbpage">
${nav}
<main class="page">
${body}
</main>
<script>
${jsOnly()}
</script>
${threeBits}
${runtimeBits}
</body>
</html>`;
}

/**
 * Breakpoints the exported page responds to.
 *
 * They match the widths the builder's own frame buttons use, nudged off the
 * exact boundary: a media query of `max-width:834px` does NOT match a viewport
 * that is exactly 834 wide, because the initial containing block the query is
 * evaluated against includes a fraction the integer frame width does not show.
 * The frame named "Tablet" has to actually light up the tablet rules.
 */
const EXPORT_BPS = [
  { key: 'laptop', max: 1200, label: 'laptop' },
  { key: 'tablet', max: 900, label: 'tablet' },
  { key: 'mobile', max: 640, label: 'mobile' },
];

/** Every per-block rule is scoped to this, so the exported page and the editor
    canvas use exactly the same selectors and neither can surprise the other. */
const VBPAGE_SCOPE = '.vbpage ';

/** '1fr 1fr 1fr' -> 3, 'repeat(3,1fr)' -> 3, undefined -> 0 */
function columnCount(style) {
  const cols = style && style.cols;
  if (!cols) return 0;
  const s = String(cols);
  const rep = /repeat\(\s*(\d+)/i.exec(s);
  if (rep) return Number(rep[1]);
  if (/display:\s*grid/i.test(s)) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isRowFlex(style) {
  return style && (style.display === 'flex' || style.display === 'inline-flex')
    && style.dir !== 'column' && style.dir !== 'column-reverse';
}

function numeric(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  return m ? Number(m[1]) : null;
}

/**
 * The responsive layer of the export.
 *
 * This used to not exist. The page carried ZERO @media rules, so choosing a
 * Phone frame in the preview changed nothing about the document: the builder
 * papered over that in the preview only, with a stylesheet full of !important
 * plus a script that scaled the whole body down. That is why the preview
 * "did not adapt to the frame" - the exported page genuinely could not.
 *
 * Two things are emitted:
 *  1. the author's own per-breakpoint overrides (block.responsive), which the
 *     inspector can already edit and which used to be thrown away entirely;
 *  2. a fluid layer that makes an ordinary desktop layout survive a narrow
 *     viewport: multi-column rows collapse to one, section gutters shrink,
 *     oversized fixed widths stop overflowing, and headings scale down.
 */
export function responsiveCssFor(doc) {
  const artboard = Number(doc.canvas && doc.canvas.width) || 1280;
  const perBp = { laptop: [], tablet: [], mobile: [] };

  const sectionish = new Set([
    'section', 'navbar', 'footer', 'header', 'container', 'card', 'hero',
    'stack', 'columns', 'frame', 'sidebar', 'wrapper', 'htmlStage',
  ]);

  for (const entry of findAll(doc)) {
    const b = entry.block;
    /* SAME selector as the base rule, including the .vbpage scope. A @media
       override with a weaker selector is simply ignored - which is exactly
       what happened when the base rules gained the scope and these did not. */
    const sel = VBPAGE_SCOPE + '.vb-' + b.type + '[data-id="' + b.id + '"]';
    const st = b.style || {};

    /* 1. the author's own overrides */
    const resp = b.responsive || {};
    for (const bp of EXPORT_BPS) {
      /* the inspector writes tablet/mobile; laptop is generated only */
      const patch = resp[bp.key];
      if (!patch) continue;
      const decls = [];
      for (const key in patch) {
        if (patch[key] == null || patch[key] === '') continue;
        if (key === 'hidden') continue;
        if (key === 'style') {
          for (const d of styleToCss(patch.style).split(';')) if (d) decls.push(d);
          continue;
        }
        decls.push(key.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + patch[key]);
      }
      if (patch.hidden) decls.push('display:none');
      if (decls.length) perBp[bp.key].push(sel + '{' + decls.join(';') + '}');
    }

    /* 2a. a row of cards becomes a stack on a phone */
    const cols = columnCount(st);
    const row = isRowFlex(st);
    if (cols > 1) {
      perBp.tablet.push(sel + '{grid-template-columns:repeat(' + Math.min(2, cols) + ',minmax(0,1fr))}');
      perBp.mobile.push(sel + '{grid-template-columns:minmax(0,1fr)}');
    } else if (row && !b.name) {
      /* a plain flex row wraps instead of overflowing */
      perBp.mobile.push(sel + '{flex-wrap:wrap}');
    }

    /* 2b. gutters shrink so content is not jammed against the screen edge */
    if (sectionish.has(b.type)) {
      const wide = ['pR', 'pL', 'mR', 'mL'].some((k) => (numeric(st[k]) || 0) >= 24);
      if (wide) {
        perBp.tablet.push(sel + '{padding-left:min(' + (numeric(st.pL) || 0) + 'px,5vw);padding-right:min(' + (numeric(st.pR) || 0) + 'px,5vw)}');
        perBp.mobile.push(sel + '{padding-left:min(' + (numeric(st.pL) || 0) + 'px,5vw);padding-right:min(' + (numeric(st.pR) || 0) + 'px,5vw)}');
      }
    }

    /* 2c. a fixed width wider than the phone must not push the page sideways */
    const w = numeric(st.w);
    if (w != null && w > EXPORT_BPS[EXPORT_BPS.length - 1].max) {
      perBp.mobile.push(sel + '{max-width:100%;width:auto}');
    }

    /* 2d. big headings scale down rather than clipping */
    const fs = numeric(st.fontSize);
    if (fs != null && fs >= 28) {
      const floor = Math.max(16, Math.round(fs * 0.42));
      perBp.tablet.push(sel + '{font-size:min(' + fs + 'px,' + Math.round(fs * 0.82) + 'px)}');
      perBp.mobile.push(sel + '{font-size:clamp(' + floor + 'px,' + Math.round(fs * 0.55) + 'vw,' + Math.round(fs * 0.7) + 'px)}');
    }

    /* 2e. anything absolutely placed in free layout is forced back into flow
       on a phone - otherwise it simply overlaps everything */
    if (st.pos === 'absolute' && !(doc.canvas && doc.canvas.mode === 'free')) {
      perBp.mobile.push(sel + '{position:relative;left:auto;top:auto}');
    }
  }

  const out = [];
  for (const bp of EXPORT_BPS) {
    if (!perBp[bp.key].length) continue;
    out.push('/* ' + bp.label + ' */');
    out.push('@media (max-width:' + bp.max + 'px){');
    out.push(perBp[bp.key].join('\n'));
    out.push('}');
  }
  return out.join('\n');
}

/**
 * Extra declarations a 3D host needs so WebGL has a real box to paint into.
 * It used to be appended to an inline style attribute; it belongs here now,
 * with everything else, so a media query can still shrink the viewer.
 */
function threeHostCss(block) {
  if (!block || !(String(block.type).indexOf('three_') === 0 || block.type === 'model3d')) return '';
  const st = block.style || {};
  const h = st.h || st.minH || 360;
  const hPx = typeof h === 'number' ? h + 'px' : String(h);
  const out = ['position:relative'];
  if (!/height/i.test(styleToCss(st))) out.push('height:' + hPx);
  out.push('min-height:' + hPx, 'overflow:hidden');
  if (!/width/i.test(styleToCss(st))) out.push('width:100%');
  return out.join(';');
}

/* Every per-block declaration lives here, and so do the @media overrides that
   override it. Nothing is written into an inline style attribute any more -
   inline styles beat every media query, which silently killed the whole
   responsive layer. */
function blockRulesFor(doc) {
  const rules = [];
  for (const entry of findAll(doc)) {
    const b = entry.block;
    /* The page's own stylesheet is scoped to .vbpage in the editor, so every
       rule set here is scoped too - otherwise a page utility outranks whatever
       the user does to the block. */
    const sel = VBPAGE_SCOPE + '.vb-' + b.type + '[data-id="' + b.id + '"]';
    /* An imported block starts with an empty style on purpose - the page's own
       stylesheet does the work - but once the user drags or resizes it, those
       values MUST be emitted, or the edit exists in the model and nowhere else. */
    /* Pro model: free keeps page-absolute left/top; flow strips absolute.
       Non-absolute free blocks stay static (no forced relative). */
    const free = doc.canvas && doc.canvas.mode === 'free';
    let styleForExport;
    if (free) {
      styleForExport = Object.assign({}, b.style);
      if (styleForExport.pos !== 'absolute') {
        delete styleForExport.pos;
        delete styleForExport.x;
        delete styleForExport.y;
      }
    } else {
      styleForExport = Object.assign({}, b.style, { pos: 'relative', x: undefined, y: undefined });
    }
    const decls = styleToCss(styleForExport);
    const wrap = isRowFlex(b.style) && !/flex-wrap/.test(decls) ? 'flex-wrap:wrap' : '';
    const extra = (b.props && b.props._css) || (b.style && b.style._css) || '';
    const all = [decls, wrap, threeHostCss(b), extra].filter(Boolean).join(';');
    if (all) rules.push(sel + '{' + all + '}');
    for (const stateName in b.states || {}) {
      const patch = b.states[stateName];
      if (!patch || !Object.keys(patch).length) continue;
      const pseudo = stateName === 'focus' ? ':focus-within' : ':' + stateName;
      const inner = Object.keys(patch).map((k) => k.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + patch[k]).join(';');
      rules.push(sel + pseudo + '{' + inner + '}');
    }
  }
  const responsive = responsiveCssFor(doc);
  if (responsive) rules.push(responsive);
  return rules.join('\n');
}

function pageShellCss(doc) {
  const w = (doc.canvas && doc.canvas.width) || 1280;
  const minH = (doc.canvas && doc.canvas.minHeight) || 720;
  const free = doc.canvas && doc.canvas.mode === 'free';
  if (free) {
    return '.page{position:relative;max-width:min(100%,' + w + 'px);width:100%;min-height:' + minH + 'px;margin:0 auto;box-sizing:border-box;overflow:visible}';
  }
  return '.page{max-width:min(100%,' + w + 'px);width:100%;margin:0 auto;box-sizing:border-box}';
}

function cssOnlyFor(doc) {
  const rules = [
    '*,*::before,*::after{box-sizing:border-box}',
    'body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:' + ((doc.canvas && doc.canvas.background) || '#fff') + '}',
    pageShellCss(doc),
    'img,video,svg{max-width:100%;height:auto}',
    '[data-type]{max-width:100%;box-sizing:border-box}',
    'html{-webkit-text-size-adjust:100%}',
    blockRulesFor(doc),
  ];
  return rules.join('\n');
}

export function cssOnly() {
  const doc = currentDoc();
  const rules = [
    '*,*::before,*::after{box-sizing:border-box}',
    'body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:' + (doc.canvas.background || '#fff') + '}',
    pageShellCss(doc),
    'img,video,svg{max-width:100%;height:auto}',
    '[class^="vb-"],[data-type]{max-width:100%;box-sizing:border-box}',
    '.vb-three-mount{position:absolute;inset:0;width:100%;height:100%}',
    'html{-webkit-text-size-adjust:100%}',
    blockRulesFor(doc),
  ];
  return rules.join('\n');
}

export function jsOnly() {
  return `(function(){
  'use strict';
  function byId(id){ return document.querySelector('[data-id="'+id+'"]'); }
  function runAction(action, value, el){
    value = value == null ? '' : String(value);
    if(action==='navigate' || action==='url'){ if(value) window.location.href = value; return; }
    if(action==='page'){ if(value) window.location.href = value.indexOf('.html')>=0 ? value : (value+'.html'); return; }
    if(action==='scroll'){
      var t = value ? (byId(value) || document.querySelector(value)) : null;
      if(t && t.scrollIntoView) t.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(action==='show'){ var s=byId(value)||document.querySelector(value); if(s){ s.style.display=''; s.hidden=false; } return; }
    if(action==='hide'){ var h=byId(value)||document.querySelector(value); if(h){ h.style.display='none'; } return; }
    if(action==='toggle'){ var g=byId(value)||document.querySelector(value); if(g){ g.style.display = (g.style.display==='none'?'':'none'); } return; }
    if(action==='setText'){ el.textContent = value; return; }
    if(action==='addClass'){ el.classList.add(value); return; }
    if(action==='removeClass'){ el.classList.remove(value); return; }
    if(action==='toggleClass'){ el.classList.toggle(value); return; }
    if(action==='animate'){
      var name = value ? ('vb-'+value) : 'vb-fade-up';
      el.style.animation='none'; void el.offsetHeight;
      el.style.animation=name+' .7s cubic-bezier(.22,1,.36,1) 1 both';
      return;
    }
    if(action==='toast'){
      var n=document.createElement('div');
      n.textContent=value||'Done';
      n.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;z-index:99999;font:14px system-ui';
      document.body.appendChild(n); setTimeout(function(){ n.remove(); },2200);
      return;
    }
    if(action==='js'){ try{ (new Function('el', value))(el); }catch(e){ console.error(e); } return; }
  }
  function bind(el){
    var raw = el.getAttribute('data-vb-events');
    if(!raw) return;
    var list; try{ list=JSON.parse(raw); }catch(e){ return; }
    if(!Array.isArray(list)) return;
    list.forEach(function(ev){
      var trigger = ev.trigger || 'click';
      var action = ev.action || 'navigate';
      var value = ev.value || '';
      if(trigger==='inview'){
        if(!('IntersectionObserver' in window)) return;
        var once=false;
        var io=new IntersectionObserver(function(entries){
          entries.forEach(function(en){ if(en.isIntersecting && !once){ once=true; runAction(action,value,el); io.disconnect(); } });
        },{threshold:0.25});
        io.observe(el);
        return;
      }
      if(trigger==='load'){ runAction(action,value,el); return; }
      el.addEventListener(trigger, function(e){
        if(action==='navigate' || action==='url' || action==='page'){ /* allow default if <a> */ }
        else { e.preventDefault(); }
        runAction(action,value,el);
      });
    });
  }
  document.querySelectorAll('[data-vb-events]').forEach(bind);
  document.querySelectorAll('[data-vb-onclick]').forEach(function(el){
    el.addEventListener('click', function(){ try{ (new Function(el.getAttribute('data-vb-onclick')))(); }catch(e){ console.error(e);} });
  });
  document.querySelectorAll('[data-vb-anim]').forEach(function(el){
    el.addEventListener('animationend', function(){ el.removeAttribute('data-vb-anim'); });
  });
  ${(currentDoc().pageJs || '').replace(/`/g, '\\`')}
})();`;
}

function isThreeBlock(b) {
  if (!b || !b.type) return false;
  const ty = String(b.type);
  return ty.indexOf('three_') === 0 || ty === 'model3d';
}

function docHasThree(doc) {
  try {
    const root = doc || currentDoc();
    // findAll returns { block, parent, depth } — not bare blocks
    const list = findAll(root) || [];
    if (list.some((entry) => isThreeBlock(entry && entry.block ? entry.block : entry))) return true;
    // Top-level + recursive children fallback
    function walk(nodes) {
      for (const n of nodes || []) {
        if (isThreeBlock(n)) return true;
        if (n.children && walk(n.children)) return true;
      }
      return false;
    }
    return walk(root.children);
  } catch (e) {
    return false;
  }
}

/** Full Three.js runtime — classic scripts (works on file:// and blob preview). */

function threeBitsFor(doc, bodyStr) {
  const need = docHasThree(doc)
    || (typeof bodyStr === 'string' && /data-type="(three_[^"]+|model3d)"/.test(bodyStr));
  return need ? threeRuntimeSnippet() : '';
}

function threeRuntimeSnippet() {
  // Classic UMD three r128 + examples/js loaders — no import maps / no type=module
  // (ES modules often fail when opening exported HTML as file:// or inside blob: preview)
  const parts = [];
  parts.push('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>');
  parts.push('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>');
  parts.push('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>');
  parts.push('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js"></script>');
  parts.push('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/MTLLoader.js"></script>');
  parts.push('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js"></script>');
  parts.push(`<script>
(function () {
  'use strict';
  /* This whole runtime lives inside a TEMPLATE LITERAL in exporter.js, so a
     backslash written as an escape in this source arrives at the exported page
     as a SINGLE backslash - which silently produced an unterminated string
     literal and turned the WHOLE script into a SyntaxError. Nothing then
     mounted, in the preview or in a browser. Build the character from its code
     point instead: that survives any number of template-literal layers. */
  var BACKSLASH = String.fromCharCode(92);
  if (typeof THREE === 'undefined') {
    console.error('[vb-3d] THREE failed to load from CDN');
    document.querySelectorAll('[data-type^="three_"],[data-type="model3d"]').forEach(function (el) {
      el.innerHTML = '<div style="padding:24px;color:#ef4444;font:14px system-ui">3D library failed to load (CDN / offline).</div>';
    });
    return;
  }

  function num(v, d) { v = Number(v); return Number.isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function readCfg(host) {
    var cfg = {};
    try {
      var raw = host.getAttribute('data-vb-3d');
      if (raw) cfg = JSON.parse(raw);
    } catch (e) { cfg = {}; }
    var type = host.getAttribute('data-type') || '';
    if (!cfg.shape && type.indexOf('three_') === 0) cfg.shape = type.replace('three_', '');
    if (!cfg.src) {
      var tag = host.querySelector('script.vb-model-src');
      if (tag) cfg.src = tag.textContent || '';
      else cfg.src = host.getAttribute('data-model-src') || '';
    }
    if (!cfg.srcName) cfg.srcName = host.getAttribute('data-model-name') || '';
    return cfg;
  }

  function geoFor(shape) {
    switch (shape) {
      case 'sphere': return new THREE.SphereGeometry(1, 48, 32);
      case 'torus': return new THREE.TorusGeometry(0.7, 0.28, 20, 64);
      case 'cylinder': return new THREE.CylinderGeometry(0.65, 0.65, 1.5, 48);
      case 'cone': return new THREE.ConeGeometry(0.75, 1.5, 48);
      case 'plane': return new THREE.PlaneGeometry(2, 2);
      case 'icosahedron': return new THREE.IcosahedronGeometry(1, 1);
      case 'dodecahedron': return new THREE.DodecahedronGeometry(1, 0);
      case 'torusKnot': return new THREE.TorusKnotGeometry(0.6, 0.2, 128, 16);
      case 'capsule':
        if (THREE.CapsuleGeometry) return new THREE.CapsuleGeometry(0.5, 0.9, 8, 16);
        return new THREE.CylinderGeometry(0.5, 0.5, 1.4, 24);
      case 'ring': return new THREE.RingGeometry(0.4, 1, 64);
      default: return new THREE.BoxGeometry(1.4, 1.4, 1.4);
    }
  }

  function fitObject(root, cfg) {
    cfg = cfg || {};
    var rx = (Number(cfg.rotX) || 0) * Math.PI / 180;
    var ry = (Number(cfg.rotY) || 0) * Math.PI / 180;
    var rz = (Number(cfg.rotZ) || 0) * Math.PI / 180;
    root.rotation.set(rx, ry, rz);
    var mode = cfg.upAxis || 'auto';
    if (mode !== 'none') {
      root.updateMatrixWorld(true);
      var box0 = new THREE.Box3().setFromObject(root);
      var size0 = box0.getSize(new THREE.Vector3());
      if (mode === 'z-up' || (mode === 'auto' && size0.z > size0.y && size0.z >= size0.x * 0.85)) {
        root.rotation.x += -Math.PI / 2;
      } else if (mode === 'x-up' || (mode === 'auto' && size0.x > size0.y && size0.x > size0.z)) {
        root.rotation.z += Math.PI / 2;
      }
    }
    root.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    var max = Math.max(size.x, size.y, size.z) || 1;
    var s = 2.4 / max;
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
    var box2 = new THREE.Box3().setFromObject(root);
    var c2 = box2.getCenter(new THREE.Vector3());
    root.position.x -= c2.x;
    root.position.z -= c2.z;
    root.position.y -= box2.min.y;
    root.traverse(function(ch) {
      if (!ch.isMesh) return;
      if (ch.geometry && !ch.geometry.attributes.normal) {
        try { ch.geometry.computeVertexNormals(); } catch (e) {}
      }
      var mats = ch.material ? (Array.isArray(ch.material) ? ch.material : [ch.material]) : [];
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i];
        if (!m) continue;
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      }
    });
  }

  function decodeDataUrlText(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:') !== 0) return dataUrl;
    var comma = dataUrl.indexOf(',');
    var meta = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      var bin = atob(payload);
      try {
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
      } catch (e) {
        return bin;
      }
    }
    try { return decodeURIComponent(payload); } catch (e2) { return payload; }
  }

  function dataUrlToArrayBuffer(dataUrl) {
    var comma = dataUrl.indexOf(',');
    var meta = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      var bin = atob(payload);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    var text = decodeURIComponent(payload);
    var out2 = new Uint8Array(text.length);
    for (var j = 0; j < text.length; j++) out2[j] = text.charCodeAt(j);
    return out2.buffer;
  }

  function applyTintOpacity(model, cfg) {
    if (cfg.tint && cfg.tint !== 'none' && cfg.tintColor) {
      model.traverse(function (ch) {
        if (!ch.isMesh || !ch.material) return;
        var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach(function (m) { if (m.color) m.color = new THREE.Color(cfg.tintColor); });
      });
    }
    if (cfg.modelOpacity != null && Number(cfg.modelOpacity) < 1) {
      model.traverse(function (ch) {
        if (!ch.isMesh || !ch.material) return;
        var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach(function (m) { m.transparent = true; m.opacity = Number(cfg.modelOpacity); });
      });
    }
  }

  function loadModel(host, cfg, mat, done) {
    var modelSrc = cfg.src || '';
    var kind = (host.getAttribute('data-model-kind') || '').toLowerCase();
    var nameHint = host.getAttribute('data-model-name') || cfg.srcName || '';
    if (!kind) {
      if (/\\.obj$/i.test(nameHint) || /model\\/obj/i.test(modelSrc.slice(0, 64))) kind = 'obj';
      else if (/\\.stl$/i.test(nameHint) || /model\\/stl/i.test(modelSrc.slice(0, 64))) kind = 'stl';
      else kind = 'gltf';
    }

    function fail(err) {
      console.warn('[vb-3d] model load failed', err);
      var mesh = new THREE.Mesh(geoFor('box'), mat);
      done(mesh);
    }

    if (kind === 'obj') {
      try {
        var objText = decodeDataUrlText(modelSrc);
        var materials = null;
        var mtlSrc = host.getAttribute('data-model-mtl') || '';
        var mtlTag = host.querySelector('script.vb-model-mtl');
        if (mtlTag) mtlSrc = mtlTag.textContent || mtlSrc;
        if (mtlSrc && THREE.MTLLoader) {
          try {
            var mtlText = decodeDataUrlText(mtlSrc);
            var mtlLoader = new THREE.MTLLoader();
            var texTag = host.querySelector('script.vb-model-textures');
            var texMap = null;
            if (texTag) {
              try { texMap = JSON.parse(texTag.textContent || '{}'); } catch (te) { texMap = null; }
            }
            if (texMap && typeof texMap === 'object') {
              var mgr = new THREE.LoadingManager();
              mgr.setURLModifier(function(url) {
                var base = (url || '').split('/').pop().split(BACKSLASH).pop().toLowerCase();
                if (texMap[base]) return texMap[base];
                if (texMap[url]) return texMap[url];
                for (var k in texMap) {
                  if (base && (k.indexOf(base) >= 0 || base.indexOf(k) >= 0)) return texMap[k];
                }
                return url;
              });
              mtlLoader.manager = mgr;
            }
            materials = mtlLoader.parse(mtlText, '');
            if (materials && materials.preload) materials.preload();
          } catch (me) { console.warn('[vb-3d] MTL', me); }
        }
        var objLoader = new THREE.OBJLoader();
        if (materials) {
          try { objLoader.setMaterials(materials); } catch (e) {}
        }
        var model = objLoader.parse(objText);
        done(model);
      } catch (err) { fail(err); }
      return;
    }

    if (kind === 'stl' && THREE.STLLoader) {
      try {
        var stlLoader = new THREE.STLLoader();
        if (/^data:/i.test(modelSrc)) {
          var geom = stlLoader.parse(dataUrlToArrayBuffer(modelSrc));
          done(new THREE.Mesh(geom, mat));
        } else {
          stlLoader.load(modelSrc, function (geom) { done(new THREE.Mesh(geom, mat)); }, undefined, fail);
        }
      } catch (err) { fail(err); }
      return;
    }

    // gltf / glb
    if (!THREE.GLTFLoader) { fail(new Error('no GLTFLoader')); return; }
    var loader = new THREE.GLTFLoader();
    if (/^data:/i.test(modelSrc)) {
      try {
        var buf = dataUrlToArrayBuffer(modelSrc);
        loader.parse(buf, '', function (gltf) {
          done(gltf.scene || (gltf.scenes && gltf.scenes[0]));
        }, fail);
      } catch (err) { fail(err); }
    } else {
      loader.load(modelSrc, function (gltf) {
        done(gltf.scene || (gltf.scenes && gltf.scenes[0]));
      }, undefined, fail);
    }
  }

  function mountEl(host) {
    if (!host || host.__threeMounted) return;
    host.__threeMounted = true;
    var cfg = readCfg(host);

    host.style.position = 'relative';
    host.style.overflow = 'hidden';
    var minH = num(cfg.h, 0) || parseInt(host.style.minHeight, 10) || parseInt(host.style.height, 10) || 360;
    if (!host.style.minHeight) host.style.minHeight = minH + 'px';
    if (!host.style.height) host.style.height = minH + 'px';

    var mount = document.createElement('div');
    mount.className = 'vb-three-mount';
    mount.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#0f172a;';
    host.appendChild(mount);

    var w = Math.max(64, mount.clientWidth || host.clientWidth || 400);
    var h = Math.max(64, mount.clientHeight || host.clientHeight || minH);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      mount.innerHTML = '<div style="padding:20px;color:#fbbf24;font:13px system-ui">WebGL unavailable</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = cfg.shadows !== false;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
    mount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var bg = cfg.bg || '#eef2f7';
    scene.background = new THREE.Color(bg);
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = num(cfg.exposure, 1.1);
    }

    var camera = new THREE.PerspectiveCamera(clamp(num(cfg.fov, 45), 12, 100), w / Math.max(h, 1), 0.05, 200);
    camera.position.set(num(cfg.camX, 0), num(cfg.camY, 1.3), num(cfg.camDist, 4.4));
    var target = new THREE.Vector3(num(cfg.targetX, 0), num(cfg.targetY, 0), 0);
    camera.lookAt(target);

    scene.add(new THREE.AmbientLight(new THREE.Color(cfg.ambientColor || '#ffffff'), clamp(num(cfg.ambient, 1.0), 0, 4)));
    var key = new THREE.DirectionalLight(new THREE.Color(cfg.keyColor || '#ffffff'), clamp(num(cfg.key, 1.4), 0, 6));
    key.position.set(3, 5, 4);
    scene.add(key);
    var fill = new THREE.DirectionalLight(new THREE.Color(cfg.fillColor || '#e0e7ff'), clamp(num(cfg.fill, 0.7), 0, 6));
    fill.position.set(-3, 2, -2);
    scene.add(fill);
    var hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.45);
    scene.add(hemi);

    if (cfg.ground !== false) {
      var grid = new THREE.GridHelper(num(cfg.groundSize, 14), num(cfg.gridLines, 26), 0x334155, 0x1e293b);
      grid.position.y = -0.01;
      scene.add(grid);
    }

    var group = new THREE.Group();
    scene.add(group);

    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cfg.color || '#6366f1'),
      metalness: clamp(num(cfg.metalness, 0.25), 0, 1),
      roughness: clamp(num(cfg.roughness, 0.45), 0, 1),
      flatShading: !!cfg.flatShading,
      wireframe: !!cfg.wireframe,
      transparent: num(cfg.opacity, 1) < 1,
      opacity: clamp(num(cfg.opacity, 1), 0, 1),
      side: THREE.DoubleSide
    });

    var type = host.getAttribute('data-type') || '';
    var controls = null;
    if (THREE.OrbitControls && cfg.orbit !== false) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enableDamping = true;
      controls.autoRotate = !!cfg.autoRotate;
      controls.autoRotateSpeed = num(cfg.orbitSpeed, 1.2);
    }

    function startLoop(spinDefault) {
      var spin = cfg.spin != null ? !!cfg.spin : spinDefault;
      var spinSpeed = num(cfg.spinSpeed, 0.6);
      var wobble = !!cfg.wobble;
      var wobbleAmount = num(cfg.wobbleAmount, 0.6);
      var t0 = performance.now();
      function tick(now) {
        var t = (now - t0) / 1000;
        if (spin) group.rotation.y += 0.01 * spinSpeed;
        if (wobble) group.position.y = Math.sin(t * 1.4) * 0.15 * wobbleAmount;
        if (controls) controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function onResize() {
      var nw = Math.max(64, mount.clientWidth || 400);
      var nh = Math.max(64, mount.clientHeight || minH);
      camera.aspect = nw / Math.max(nh, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    }
    window.addEventListener('resize', onResize);

    if ((type === 'model3d' || cfg.src) && cfg.src) {
      loadModel(host, cfg, mat, function (model) {
        if (!model) {
          group.add(new THREE.Mesh(geoFor('box'), mat));
        } else {
          fitObject(model, cfg);
          applyTintOpacity(model, cfg);
          group.add(model);
        }
        startLoop(false);
        onResize();
      });
    } else {
      var shape = cfg.shape || (type.indexOf('three_') === 0 ? type.replace('three_', '') : 'box');
      var mesh = new THREE.Mesh(geoFor(shape), mat);
      var sc = num(cfg.scale, 1);
      mesh.scale.set(sc, sc, sc);
      group.add(mesh);
      if (type === 'three_scene') {
        var count = clamp(num(cfg.count, 6), 1, 24);
        var spread = num(cfg.spread, 2);
        for (var i = 1; i < count; i++) {
          var m2 = new THREE.Mesh(geoFor(shape), mat.clone());
          m2.position.set((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 2);
          m2.scale.setScalar(0.4 + Math.random() * 0.8);
          group.add(m2);
        }
      }
      startLoop(true);
      onResize();
    }
  }

  function boot() {
    var nodes = document.querySelectorAll('[data-type^="three_"],[data-type="model3d"]');
    if (!nodes.length) console.warn('[vb-3d] no 3D hosts in page');
    for (var i = 0; i < nodes.length; i++) mountEl(nodes[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`);

  return parts.join(String.fromCharCode(10));
}

export function htmlBundle() {
  const pages = allPages();
  // Single page → classic one-file export. Multi-page → export current page with site nav.
  if (pages.length <= 1) {
    const doc = currentDoc();
    // Prefer LIVE canvas children — never stale pageHtml after clear/edit
    const hasBlocks = Array.isArray(doc.children) && doc.children.length > 0;
    if (!hasBlocks && doc.pageHtml) return String(doc.pageHtml);
    // If the only content is htmlStage/htmlEmbed, prefer its stored full HTML when present
    if (hasBlocks && doc.children.length === 1) {
      const only = doc.children[0];
      if (only && only.type === 'htmlStage' && only.props) {
        const css = String(only.props.headCss || '');
        const body = String(only.props.bodyHtml || '');
        if (body) {
          return `<!DOCTYPE html>
<html lang="en"${only.props.dir ? ' dir="' + escapeHtml(only.props.dir) + '"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(docTitle())}</title>
${css ? '<style>\n' + css + '\n</style>' : ''}
</head>
<body class="vbpage">
${body}
</body>
</html>`;
        }
      }
      if (only && only.type === 'htmlEmbed' && only.props && only.props.html) {
        const raw = String(only.props.html);
        if (/<!DOCTYPE|<html[\s>]/i.test(raw)) return raw;
      }
    }
    const title = docTitle();
    const css = cssOnly();
    const body = bodyHtml();
    const threeBits = threeBitsFor(doc, body);
    const runtimeBits = runtimeBitsFor(doc, body);
    const head = headTagsFor(doc);
    const tokenCss = tokensToCss(ensureTokens(doc));
    return `<!DOCTYPE html>
${head.htmlTag}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${head.tags}
<style>
:root{${tokenCss}}
${rootTypographyFor(doc)}
${css}
[data-type^="three_"],[data-type="model3d"]{position:relative;min-height:280px;overflow:hidden}
.vb-three-mount{position:absolute;inset:0}
</style>
</head>
<body class="vbpage">
<main class="page">
${body}
</main>
<script>
${jsOnly()}
</script>
${threeBits}
${runtimeBits}
</body>
</html>`;
  }
  const idx = Math.max(0, pages.findIndex((p) => p.id === state.pageId));
  return htmlForPage(pages[idx], idx, pages);
}

export function htmlSiteZipEntries() {
  const pages = allPages();
  const entries = [];
  pages.forEach((page, i) => {
    entries.push({ name: pageFileName(page, i), data: htmlForPage(page, i, pages) });
  });
  entries.push({ name: 'project.json', data: json() });
  entries.push({
    name: 'README.txt',
    data: (pages[0] && pages[0].name ? pages[0].name : 'Site') + '\nGenerated by Eagle Visual Builder\n\n'
      + pages.map((p, i) => '  ' + pageFileName(p, i) + '  —  ' + (p.name || 'Page')).join('\n')
      + '\n\nOpen index.html in a browser.\n',
  });
  return entries;
}

export function indexHtmlLinked() {
  const title = docTitle();
  const doc = currentDoc();
  const body = bodyHtml();
  const threeBits = threeBitsFor(doc, body);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="styles.css">
<style>
[data-type^="three_"],[data-type="model3d"]{position:relative;min-height:280px;overflow:hidden}
</style>
</head>
<body class="vbpage">
<main class="page">
${body}
</main>
<script src="app.js"></script>
${threeBits}
</body>
</html>`;
}

function inlineStyle(b) {
  const doc = currentDoc();
  const s = Object.assign({}, b.style, { pos: 'relative', x: undefined, y: undefined });
  const css = styleToCss(s);
  return css ? ' style={{' + reactStyle(css) + '}}' : '';
}

function reactStyle(css) {
  return css.split(';').filter(Boolean).map((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return '';
    const key = decl.slice(0, i).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
    const value = decl.slice(i + 1);
    return key + ": '" + value.replace(/'/g, "\\'") + "'";
  }).filter(Boolean).join(', ');
}

function inlineHtmlAttr(b) {
  const doc = currentDoc();
  const s = Object.assign({}, b.style, { pos: 'relative', x: undefined, y: undefined });
  const css = styleToCss(s);
  return css ? ' style="' + css + '"' : '';
}

export function react() {
  const title = docTitle();
  const body = (currentDoc().children || [])
    .map((b) => '      <div key="' + b.id + '" className="vb-' + b.type + '"' + inlineStyle(b) + '>\n        ' + innerReact(b) + '\n      </div>')
    .join('\n');
  return `import React from 'react';

export default function Page() {
  return (
    <main className="page">
${body}
    </main>
  );
}

// ${title} — generated by Eagle Visual Builder`;
}

function innerReact(b) {
  const def = getDef(b.type);
  if (!def || !def.render) return '';
  let html = '';
  try {
    html = def.render(b.props || {}, b.style || {}, b) || '';
  } catch (err) {
    html = '';
  }
  return html.replace(/class="/g, 'className="').replace(/ for="/g, ' htmlFor="').replace(/ tabindex=/g, ' tabIndex=');
}

export function vue() {
  const title = docTitle();
  return `<template>
  <main class="page">
${(currentDoc().children || []).map((b) => '    <div class="vb-' + b.type + '"' + inlineHtmlAttr(b) + '>' + innerVue(b) + '</div>').join('\n')}
  </main>
</template>

<script setup>
export default { name: 'Page' }
</script>

<style scoped>
${cssOnly()}
</style>

<!-- ${title} — generated by Eagle Visual Builder -->`;
}

function innerVue(b) {
  const def = getDef(b.type);
  if (!def || !def.render) return '';
  try {
    return def.render(b.props || {}, b.style || {}, b) || '';
  } catch (err) {
    return '';
  }
}

export function svelte() {
  const title = docTitle();
  return `<script>
  let data = {};
</script>

<main class="page">
${(currentDoc().children || []).map((b) => '  <div class="vb-' + b.type + '"' + inlineHtmlAttr(b) + '>' + innerVue(b) + '</div>').join('\n')}
</main>

<style>
${cssOnly()}
</style>

<!-- ${title} — generated by Eagle Visual Builder -->`;
}

export function astro() {
  const title = docTitle();
  return `---
const title = ${JSON.stringify(title)};
---

<main class="page">
${(currentDoc().children || []).map((b) => '  <div class="vb-' + b.type + '"' + inlineHtmlAttr(b) + '>' + innerVue(b) + '</div>').join('\n')}
</main>

<style is:global>
${cssOnly()}
</style>`;
}

export function tailwind() {
  const doc = currentDoc();
  const lines = (doc.children || []).map((b) => {
    const s = b.style || {};
    const cls = [];
    cls.push('block');
    if (s.bg) cls.push('bg-[color:' + s.bg + ']');
    if (s.color) cls.push('text-[color:' + s.color + ']');
    if (s.radius) cls.push('rounded-[length:' + s.radius + 'px]');
    if (s.pT || s.pR || s.pB || s.pL) {
      cls.push('p-[' + (s.pT || 0) + 'px_' + (s.pR || 0) + 'px_' + (s.pB || 0) + 'px_' + (s.pL || 0) + 'px]');
    }
    if (s.gap) cls.push('gap-[' + s.gap + 'px]');
    if (s.display === 'flex') cls.push('flex');
    if (s.dir) cls.push('flex-' + s.dir);
    return '  <div class="' + cls.join(' ') + '">' + innerVue(b) + '</div>';
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(docTitle())}</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="antialiased">
<main class="page mx-auto">
${lines.join('\n')}
</main>
</body>
</html>`;
}

export function json() {
  return JSON.stringify(project.serialize(), null, 2);
}

export function generate(format) {
  switch (format) {
    case 'css': return cssOnly();
    case 'js': return jsOnly();
    case 'split': return indexHtmlLinked();
    case 'react': return react();
    case 'vue': return vue();
    case 'svelte': return svelte();
    case 'astro': return astro();
    case 'tailwind': return tailwind();
    case 'json': return json();
    default: return htmlBundle();
  }
}

function readme() {
  return `${docTitle()}
Generated by Eagle Visual Builder

Files
  index.html   markup
  styles.css   styles
  app.js       behaviour

Open index.html in any browser, or run: npx serve .
`;
}

async function downloadZip() {
  const pages = allPages();
  let files;
  if (pages.length > 1) {
    // Full multi-page site (each HTML embeds Three runtime + model data when needed)
    files = htmlSiteZipEntries();
  } else {
    // Prefer single self-contained HTML for 3D sites so models (data URLs) + runtime work offline-capable via CDN
    const has3d = docHasThree(currentDoc());
    if (has3d) {
      files = [
        { name: 'index.html', data: htmlBundle() },
        { name: 'project.json', data: json() },
        {
          name: 'README.txt',
          data: (docTitle() || 'Site') + '\nGenerated by Eagle Visual Builder\n\n'
            + 'Open index.html in a modern browser (Chrome / Edge / Firefox).\n'
            + '3D uses Three.js from CDN + models embedded in the page.\n'
            + 'Needs network once for three.js libraries; models are inline.\n',
        },
      ];
    } else {
      files = [
        { name: 'index.html', data: indexHtmlLinked() },
        { name: 'styles.css', data: cssOnly() },
        { name: 'app.js', data: jsOnly() },
        { name: 'project.json', data: json() },
        { name: 'README.txt', data: readme() },
      ];
    }
  }
  const blob = buildZip(files);
  const name = slug(docTitle() || 'site') + '.zip';
  const saved = await host.saveBytes(name, await blobToB64(blob));
  if (!saved) download(name, blob);
  return name;
}

export function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      resolve(btoa(bin));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

async function downloadSingle(format) {
  // JSON always includes every page via project.serialize()
  if (format === 'json') {
    const code = json();
    const name = slug(docTitle() || 'project') + '.eagle.json';
    const saved = await host.saveText(name, code);
    if (!saved) download(name, code, 'application/json');
    return name;
  }

  // Multi-page HTML → download a ZIP of the whole site instead of a single page
  const pages = allPages();
  if ((format === 'html' || format === 'split' || !format) && pages.length > 1) {
    return downloadZip();
  }

  const code = generate(format);
  const map = {
    html: ['.html', 'text/html'],
    split: ['.html', 'text/html'],
    css: ['.css', 'text/css'],
    js: ['.js', 'text/javascript'],
    react: ['.jsx', 'text/plain'],
    vue: ['.vue', 'text/plain'],
    svelte: ['.svelte', 'text/plain'],
    astro: ['.astro', 'text/plain'],
    tailwind: ['.html', 'text/html'],
    json: ['.json', 'application/json'],
  };
  const [ext, mime] = map[format] || ['.txt', 'text/plain'];
  const name = slug(docTitle()) + ext;
  const saved = await host.saveText(name, code);
  if (!saved) download(name, code, mime);
  return name;
}

export function previewPage() {
  return host.preview(htmlBundle());
}

void state;

export { downloadZip, downloadSingle };
