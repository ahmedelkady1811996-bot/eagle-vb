import { makeBlock } from '../core/store.js';
import { get as getDef, createBlock } from '../model/catalog.js';
import { escapeHtml } from '../core/util.js';

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'head', 'title', 'svg', 'path', 'symbol', 'defs', 'br']);

const TAG_MAP = {
  header: 'navbar', nav: 'navbar', footer: 'footer', section: 'section',
  main: 'section', article: 'card', aside: 'sidebar', form: 'form',
  h1: 'heading', h2: 'subheading', h3: 'subheading', h4: 'label', h5: 'label', h6: 'label',
  p: 'paragraph', blockquote: 'quote', pre: 'code', code: 'code',
  ul: 'list', ol: 'list', table: 'table', img: 'image', picture: 'image',
  video: 'video', audio: 'audio', iframe: 'youtube', canvas: 'image',
  input: 'input', textarea: 'textarea', select: 'select', button: 'button', a: 'link',
};

const CLASS_HINTS = [
  { re: /\b(hero|jumbotron|banner|masthead|cover)\b/i, type: 'hero' },
  { re: /\b(feature|benefit|advantage)\b/i, type: 'featureCard' },
  { re: /\b(testimonial|review|quote)\b/i, type: 'testimonialCard' },
  { re: /\b(pricing|price-card|plan)\b/i, type: 'pricingCard' },
  { re: /\b(product|shop|item-card)\b/i, type: 'productCard' },
  { re: /\b(team|member|author)\b/i, type: 'teamCard' },
  { re: /\b(stat|metric|kpi)\b/i, type: 'statCard' },
  { re: /\b(faq|question)\b/i, type: 'faqItem' },
  { re: /\b(timeline|step)\b/i, type: 'timelineItem' },
  { re: /\b(alert|notice|banner|toast)\b/i, type: 'alert' },
  { re: /\b(container|wrapper|inner|box)\b/i, type: 'frame' },
  { re: /\b(row|flex|grid|col)\b/i, type: 'columns' },
  { re: /\b(card|panel|tile|box)\b/i, type: 'card' },
  { re: /\b(btn|button|cta)\b/i, type: 'button' },
  { re: /\b(footer)\b/i, type: 'footer' },
  { re: /\b(nav|header|menu|navbar)\b/i, type: 'navbar' },
];

const STYLE_FROM_CLASS = [
  { re: /^p-(\d+)$/, apply: (s, v) => { s.pT = s.pR = s.pB = s.pL = +v; } },
  { re: /^px-(\d+)$/, apply: (s, v) => { s.pT = s.pB = +v; } },
  { re: /^py-(\d+)$/, apply: (s, v) => { s.pR = s.pL = +v; } },
  { re: /^pt-(\d+)$/, apply: (s, v) => { s.pT = +v; } },
  { re: /^pr-(\d+)$/, apply: (s, v) => { s.pR = +v; } },
  { re: /^pb-(\d+)$/, apply: (s, v) => { s.pB = +v; } },
  { re: /^pl-(\d+)$/, apply: (s, v) => { s.pL = +v; } },
  { re: /^m-(\d+)$/, apply: (s, v) => { s.mT = s.mR = s.mB = s.mL = +v; } },
  { re: /^mt-(\d+)$/, apply: (s, v) => { s.mT = +v; } },
  { re: /^mb-(\d+)$/, apply: (s, v) => { s.mB = +v; } },
  { re: /^text-(xs|sm|lg|xl|\dxl|2xl|3xl|4xl|5xl)$/, apply: (s, v) => { s.fontSize = ({ xs: 12, sm: 14, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48 })[v]; } },
  { re: /^font-(bold|semibold|medium|normal|light)$/, apply: (s, v) => { s.fontWeight = ({ light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 })[v]; } },
  { re: /^rounded(-none|-sm|-md|-lg|-xl|-full)?$/, apply: (s, v) => { s.radius = ({ undefined: 8, '-none': 0, '-sm': 4, '-md': 8, '-lg': 14, '-xl': 22, '-full': 999 })[v.replace('rounded', '')] || 8; } },
  { re: /^text-(left|center|right|justify)$/, apply: (s, v) => { s.textAlign = v; } },
  { re: /^items-(start|center|end)$/, apply: (s, v) => { s.align = ({ start: 'flex-start', center: 'center', end: 'flex-end' })[v]; } },
  { re: /^justify-(start|center|end|between)$/, apply: (s, v) => { s.justify = ({ start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' })[v]; } },
  { re: /^gap-(\d+)$/, apply: (s, v) => { s.gap = +v; } },
  { re: /^shadow(-sm|-md|-lg|-xl)?$/, apply: (s, v) => { s.shadow = ({ undefined: '0 1px 2px rgba(0,0,0,.08)', '-sm': '0 1px 2px rgba(0,0,0,.08)', '-md': '0 6px 16px rgba(0,0,0,.12)', '-lg': '0 14px 32px rgba(0,0,0,.16)', '-xl': '0 24px 56px rgba(0,0,0,.20)' })[v.replace('shadow', '')]; } },
  { re: /^text-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose)-\d{2,3}$/, apply: (s, v) => { s.color = tailwindColor(v.replace('text-', '')); } },
  { re: /^bg-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose)-\d{2,3}$/, apply: (s, v) => { s.bg = tailwindColor(v.replace('bg-', '')); } },
  { re: /^flex-(row|col|row-reverse|col-reverse)$/, apply: (s, v) => { s.display = 'flex'; s.dir = v; } },
  { re: /^grid$/, apply: (s) => { s.display = 'grid'; s.cols = 'repeat(auto-fit,minmax(220px,1fr))'; } },
  { re: /^hidden$/, apply: (s) => { s.hiddenMobile = true; } },
];

const TW = {
  white: '#ffffff', black: '#000000',
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827' },
  slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' },
  red: { 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
  orange: { 500: '#f97316' }, amber: { 500: '#f59e0b' }, yellow: { 500: '#eab308' },
  green: { 500: '#22c55e' }, emerald: { 500: '#10b981' }, teal: { 500: '#14b8a6' },
  cyan: { 500: '#06b6d4' }, sky: { 500: '#0ea5e9' }, blue: { 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  indigo: { 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
  violet: { 500: '#8b5cf6' }, purple: { 500: '#a855f7' },
  pink: { 500: '#ec4899' }, rose: { 500: '#f43f5e' },
};

function tailwindColor(token) {
  const [name, shade] = token.split('-');
  const group = TW[name];
  if (!group) return null;
  if (typeof group === 'string') return group;
  return group[shade] || group[500] || null;
}

const BOOTSTRAP_MAP = [
  [/^btn(-primary|-secondary|-success|-danger|-warning|-light|-dark|-outline-primary)?$/, (cls) => {
    const map = {
      'btn': { bg: '#6c757d', color: '#ffffff' },
      'btn-primary': { bg: '#0d6efd', color: '#ffffff' },
      'btn-secondary': { bg: '#6c757d', color: '#ffffff' },
      'btn-success': { bg: '#198754', color: '#ffffff' },
      'btn-danger': { bg: '#dc3545', color: '#ffffff' },
      'btn-warning': { bg: '#ffc107', color: '#000000' },
      'btn-light': { bg: '#f8f9fa', color: '#000000' },
      'btn-dark': { bg: '#212529', color: '#ffffff' },
    };
    return map[cls] || map.btn;
  }],
  [/^(bg|text)-(\w+)$/, (cls, m) => {
    const bs = {
      primary: '#0d6efd', secondary: '#6c757d', success: '#198754', danger: '#dc3545',
      warning: '#ffc107', info: '#0dcaf0', light: '#f8f9fa', dark: '#212529', white: '#ffffff', black: '#000000',
    };
    const v = bs[m[2]];
    return v ? { [m[1] === 'bg' ? 'bg' : 'color']: v } : null;
  }],
];

function pickType(el) {
  const tag = el.tagName.toLowerCase();
  const cls = (el.className && String(el.className)) || '';

  if (tag === 'div' || tag === 'span') {
    for (const hint of CLASS_HINTS) {
      if (hint.re.test(cls)) return hint.type;
    }
  }
  if (TAG_MAP[tag]) return TAG_MAP[tag];
  if (tag === 'div') return 'frame';
  return 'frame';
}

function styleFromClasses(classes) {
  const style = {};
  for (const raw of classes) {
    const cls = raw.trim();
    if (!cls) continue;
    for (const rule of STYLE_FROM_CLASS) {
      const m = rule.re.exec(cls);
      if (m) {
        /* Hand the rule the captured group when it has one, otherwise the
           whole class token. Several rules have an OPTIONAL group
           (/^rounded(-sm|...)?$/) and then call v.replace(...), so a bare
           "rounded" or "shadow" class passed undefined and threw - which
           aborted the entire import, not just that one element. */
        rule.apply(style, m[1] !== undefined ? m[1] : cls);
        break;
      }
    }
    for (const [re, fn] of BOOTSTRAP_MAP) {
      const m = re.exec(cls);
      if (m) {
        const got = fn.apply(null, [cls].concat(m.slice(1)));
        if (got) Object.assign(style, got);
        break;
      }
    }
  }
  return style;
}

function styleFromCS(cs) {
  if (!cs) return null;
  const style = {};
  const map = {
    color: 'color', backgroundColor: 'bg', fontSize: 'fontSize', fontWeight: 'fontWeight',
    fontFamily: 'fontFamily', lineHeight: 'lineHeight', letterSpacing: 'letterSpacing',
    textAlign: 'textAlign', borderRadius: 'radius', opacity: 'opacity', display: 'display',
    flexDirection: 'dir', justifyContent: 'justify', alignItems: 'align', gap: 'gap',
    maxWidth: 'maxW', minHeight: 'minH', overflow: 'overflow', boxShadow: 'shadow',
    backgroundImage: 'bgImage', backgroundSize: 'bgSize', backgroundPosition: 'bgPos',
  };
  for (const prop in map) {
    const v = cs[prop];
    if (!v || v === 'initial' || v === 'normal' || v === 'none' || v === 'auto' || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') continue;
    // Skip default browser values that noise the style
    if (prop === 'display' && (v === 'block' || v === 'inline' || v === 'inline-block')) continue;
    if (prop === 'fontWeight' && (v === '400' || v === 'normal')) continue;
    if (prop === 'opacity' && v === '1') continue;
    style[map[prop]] = v;
  }
  const px = (v) => {
    if (!v || v === '0px') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom), pl = px(cs.paddingLeft);
  if (pt != null) style.pT = pt;
  if (pr != null) style.pR = pr;
  if (pb != null) style.pB = pb;
  if (pl != null) style.pL = pl;
  const mt = px(cs.marginTop), mr = px(cs.marginRight), mb = px(cs.marginBottom), ml = px(cs.marginLeft);
  if (mt != null) style.mT = mt;
  if (mr != null) style.mR = mr;
  if (mb != null) style.mB = mb;
  if (ml != null) style.mL = ml;
  if (cs.width && cs.width !== 'auto' && cs.width !== '0px') style.w = cs.width;
  if (cs.height && cs.height !== 'auto' && cs.height !== '0px') style.h = cs.height;
  if (cs.borderTopWidth && parseFloat(cs.borderTopWidth) > 0) {
    style.borderW = parseFloat(cs.borderTopWidth);
    style.borderColor = cs.borderTopColor;
    style.borderStyle = cs.borderTopStyle || 'solid';
  }
  return Object.keys(style).length ? style : null;
}

function styleFromInline(el) {
  // Prefer inline style attribute first (author intent)
  const inline = styleFromCS(el.style);
  // Then merge computed styles from a live host when possible
  let computed = null;
  try {
    if (el.isConnected && window.getComputedStyle) {
      computed = styleFromCS(window.getComputedStyle(el));
    }
  } catch (e) {
    void e;
  }
  if (!inline && !computed) return null;
  return Object.assign({}, computed || {}, inline || {});
}

function propsFromElement(el, type) {
  const p = {};
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  switch (type) {
    case 'heading':
    case 'subheading':
    case 'label':
    case 'paragraph':
      p.text = text.slice(0, 400);
      if (type === 'heading') p.tag = el.tagName.toLowerCase();
      break;
    case 'quote':
      p.text = text.slice(0, 400);
      p.author = el.querySelector('cite, footer, .author') ? (el.querySelector('cite, footer, .author').textContent || '').trim() : '';
      break;
    case 'button':
      p.text = text.slice(0, 60) || 'Button';
      p.href = el.getAttribute('href') || '';
      break;
    case 'link':
      p.text = text.slice(0, 80) || 'Link';
      p.href = el.getAttribute('href') || '';
      break;
    case 'image':
      p.src = el.currentSrc || el.getAttribute('src') || '';
      p.alt = el.getAttribute('alt') || '';
      break;
    case 'video':
      p.src = el.getAttribute('src') || (el.querySelector('source') ? el.querySelector('source').getAttribute('src') : '') || '';
      break;
    case 'input':
      p.label = el.getAttribute('placeholder') || el.getAttribute('name') || 'Input';
      p.placeholder = el.getAttribute('placeholder') || '';
      p.inputType = el.getAttribute('type') || 'text';
      break;
    case 'textarea':
      p.label = el.getAttribute('placeholder') || 'Message';
      p.placeholder = el.getAttribute('placeholder') || '';
      break;
    case 'list':
      p.items = Array.from(el.children).map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30);
      p.style = el.tagName.toLowerCase() === 'ol' ? 'number' : 'bullet';
      break;
    case 'code':
      p.code = el.textContent || '';
      break;
    default:
      break;
  }
  return p;
}

function makeFromElement(el, index) {
  const tag = el.tagName.toLowerCase();
  const type = pickType(el);
  const def = getDef(type);
  const block = createBlock(type);
  const classes = (el.className && String(el.className).split(/\s+/)) || [];

  /* ---- Keep the element's own markup. -----------------------------------
     This is the difference between importing a page and importing a
     SKELETON of it. The original design is produced by the page's own CSS
     (Tailwind, in the NUR platform's case) applied to its own class names.
     Rebuilding every element from the builder's block defaults threw all of
     that away, so an imported page came out as generic indigo Cards labelled
     "Card title" with "Button" and "Input" in them - not like the browser at
     all. So: the original class list, the original inline declarations and
     (for a leaf) the original inner HTML are kept on the block, and the page's
     own stylesheet travels with the export. The block wrapper still gives the
     user something to select, drag, restyle, save as a library block and bind
     events to - it just stops inventing the content. */
  const cls = (el.getAttribute && el.getAttribute('class')) || '';
  if (cls) block.props._cls = cls;
  const inlineAttr = (el.getAttribute && el.getAttribute('style')) || '';
  if (inlineAttr) block.props._css = inlineAttr;
  block.props._tag = tag;
  block.props._imported = 1;

  Object.assign(block.props, propsFromElement(el, type));

  /* An imported block carries NO derived style.
     The guesses made here (computed styles read from a document whose CDN
     stylesheet had not loaded, plus the block type's own defaults) are worse
     than nothing: emitting them meant the page lost its design AND the builder
     could no longer style the block, so dragging and resizing silently did
     nothing. Starting from an empty style makes the page's own stylesheet the
     single source of truth until the user actually changes something. */
  block.style = {};

  // Prefer meaningful names for layers panel (id / aria / first heading)
  block.name = (el.getAttribute('data-vb-name') || el.id || el.getAttribute('aria-label') || '').slice(0, 48);
  if (!block.name) {
    const h = el.querySelector && el.querySelector('h1,h2,h3,h4,.title,.brand');
    if (h && h.textContent) block.name = String(h.textContent).replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  block.locked = false;

  /* Keep the element's id. It used to be read for the layer name and then
     thrown away, so an imported page arrived with every id gone: nothing could
     be anchored, no #link resolved, and page scripts that drive the UI by id
     (a counter, a slider, a prayer card grid) had nothing to bind to. That is
     why an imported design exported as a picture instead of a working page. */
  if (el.id) {
    block.a11y = block.a11y || {};
    block.a11y.id = el.id;
  }
  const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
  if (ariaLabel && !block.a11y) block.a11y = { label: ariaLabel };
  const elDir = el.getAttribute && el.getAttribute('dir');
  if (elDir && !block.style.dir) block.style.dir = elDir === 'rtl' ? 'row-reverse' : 'row';

  const kidBlocks = [];
  const inlineHtml = [];
  for (const child of el.children) {
    const childTag = child.tagName.toLowerCase();
    if (SKIP_TAGS.has(childTag)) continue;
    /* Inline-level children stay as MARKUP. An <i class="fa-solid fa-book-open">
       is not a block - it is a glyph the parent renders. Promoting it to a
       block produced an empty element, so every icon in the page silently
       disappeared. */
    if (INLINE_TAGS.has(childTag)) {
      try { inlineHtml.push(child.outerHTML); } catch (e) { void e; }
      continue;
    }
    const made = makeFromElement(child, index + 1);
    if (made) kidBlocks.push(made);
  }

  // Always host children when possible so nested pieces stay selectable (Mobirise-like)
  const defCanHost = def && def.container;
  if (kidBlocks.length && defCanHost) {
    block.children = kidBlocks;
    /* Do NOT force display/dir/gap on an imported element.
     *
     * It looks like a safe default, but the native canvas writes block styles
     * as an INLINE style attribute, and an inline style outranks every
     * stylesheet rule - including the page's own `@media (min-width:1024px){
     * .lg\:hidden{display:none} }`. Forcing `display:flex` therefore made the
     * mobile bottom nav (`lg:hidden fixed bottom-0`) render as a 186px column
     * inside the header, and forcing `flex-direction:column` stacked the
     * desktop nav that the page lays out as a row.
     *
     * The page's own classes already describe its layout: `flex-row`/`grid`/
     * `items-*`/`justify-*`/`gap-*` are read into style by TW_PATTERNS, and
     * plain `flex`, `hidden` and the responsive variants come from the scoped
     * page stylesheet. Staying out of the way is what preserves the design. */
    delete block.props._html;
  } else if (kidBlocks.length) {
    /* The element has children, but its block type cannot host them. The
       wrapper BECOMES the original element (same tag, same classes, same
       inline style) and the children become its content.
       It used to also emit a "leaf" copy of the element, but that copy had no
       kept markup, so it fell through to the block default - which is how a
       stock white "Button" and "Input" panel ended up in the middle of a
       carefully designed Arabic toolbar. */
    const wrapper = createBlock('frame');
    wrapper.name = block.name || 'Group';
    wrapper.locked = false;
    /* Keep the element's OWN text nodes. A nav tab is
       <button><i class="fa-solid fa-book-open"></i> المصحف الشريف</button> - the
       label is a text node, so dropping it left a row of unlabelled icons. */
    wrapper.props = Object.assign({}, block.props, { _html: inlineHtml.join('') + ownTextHtml(el) });
    if (block.props && block.props.text) wrapper.props.text = block.props.text;
    wrapper.style = Object.assign({}, block.style || {});
    /* Same reason as above: no forced `display`. A `<nav class="hidden lg:flex">`
       that cannot host children would otherwise arrive with an inline
       `display:block`, which permanently defeats its own `hidden`. */
    wrapper.children = kidBlocks;
    return wrapper;
  } else {
    /* A LEAF keeps its original inner markup - this is the text and the icons
       the user actually came for. Scripts and styles are stripped (they are
       carried once, at document level). */
    block.props._html = inlineHtml.length
      ? inlineHtml.join('') + ownTextHtml(el)
      : originalInnerHtml(el);
  }

  void tag;
  return block;
}

const MAX_LEAF_HTML = 24000;

/** The element's own text nodes (not its children's). */
function ownTextHtml(el) {
  try {
    let out = '';
    for (const n of Array.prototype.slice.call(el.childNodes || [])) {
      if (n.nodeType === 3) out += n.nodeValue || '';
    }
    return out.replace(/\s+/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

/** Tags that can never have children - they need no inner markup at all. */
const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'source', 'track', 'area', 'col', 'embed', 'wbr', 'meta', 'link']);

/** Inline-level tags: they stay as markup inside their parent, never blocks. */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'big', 'cite', 'code', 'data', 'del', 'dfn',
  'em', 'i', 'img', 'input', 'kbd', 'label', 'mark', 'output', 'q', 's', 'samp',
  'select', 'small', 'span', 'strong', 'sub', 'sup', 'textarea', 'time', 'u',
  'var', 'wbr', 'picture', 'source', 'small',
]);

function originalInnerHtml(el) {
  try {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script,noscript,template,style').forEach((n) => n.remove());
    const html = clone.innerHTML || '';
    return html.length > MAX_LEAF_HTML ? html.slice(0, MAX_LEAF_HTML) : html;
  } catch (e) {
    try { return el.innerHTML || ''; } catch (e2) { return ''; }
  }
}

/**
 * Everything a page needs in <head> to look like itself: its own <style>
 * blocks, its remote stylesheets, and its scripts (Tailwind and friends).
 *
 * Without these, keeping the class names is worthless - the utilities that
 * produce the design never load. This is the same contract a browser has.
 */
export function htmlAssets(html) {
  const out = { styles: [], links: [], scripts: [], title: '', lang: '', dir: '', htmlClass: '' };
  let doc = null;
  try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (e) { void e; }
  if (!doc) return out;
  const htmlEl = doc.documentElement;
  out.lang = (htmlEl && htmlEl.getAttribute('lang')) || '';
  out.dir = (htmlEl && htmlEl.getAttribute('dir')) || '';
  /* The <html> class list is what drives a class-based dark mode.
     Tailwind's `dark:` variants compile to `.dark .x{}`, so the canvas needs the
     same class on it or every dark variant silently does nothing - which is how
     a dark Arabic platform rendered as a white page inside the editor. */
  out.htmlClass = (htmlEl && htmlEl.getAttribute('class')) || '';
  out.title = (doc.querySelector('title') || {}).textContent || '';
  doc.querySelectorAll('style').forEach((s) => {
    const t = (s.textContent || '').trim();
    if (t) out.styles.push(t);
  });
  doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => {
    const href = l.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) out.links.push(href);
  });
  doc.querySelectorAll('script[src]').forEach((s) => {
    const src = s.getAttribute('src') || '';
    if (/^https?:\/\//i.test(src)) out.scripts.push(src);
  });
  /* tailwind.config is inline and must run BEFORE the CDN script */
  doc.querySelectorAll('script:not([src])').forEach((s) => {
    const t = s.textContent || '';
    if (/tailwind\s*\.\s*config/.test(t)) out.styles.push(t);
  });
  return out;
}

function extractHeadCss(parseDoc) {
  const parts = [];
  try {
    const styles = parseDoc.querySelectorAll('style');
    for (const s of styles) {
      const t = (s.textContent || '').trim();
      if (t) parts.push(t);
    }
    const links = parseDoc.querySelectorAll('link[rel="stylesheet"][href]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) parts.push('@import url("' + href.replace(/"/g, '') + '");');
    }
  } catch (e) {
    void e;
  }
  return parts.join('\n\n');
}

function extractBodyHtml(scope) {
  if (!scope) return '';
  try {
    const clone = scope.cloneNode(true);
    clone.querySelectorAll('script,noscript,template').forEach((n) => n.remove());
    return clone.innerHTML || '';
  } catch (e) {
    return scope.innerHTML || '';
  }
}

/**
 * Default: one high-fidelity htmlStage (browser-like look + editable as a block).
 * Pass options.structure = true for Mobirise-style structural block tree.
 */
export function htmlToBlocks(html, options) {
  const opts = options || {};
  const raw = String(html || '');

  let hostDoc = null;
  let iframe = null;
  try {
    iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:1440px;height:900px;opacity:0;pointer-events:none;border:0';
    document.body.appendChild(iframe);
    hostDoc = iframe.contentDocument;
    hostDoc.open();
    hostDoc.write(raw);
    hostDoc.close();
  } catch (e) {
    hostDoc = null;
  }

  const parseDoc = hostDoc || new DOMParser().parseFromString(raw, 'text/html');
  let scope = opts.selector ? parseDoc.querySelector(opts.selector) : parseDoc.body;
  /* document.write() + close() does NOT block on remote <script>/<link>, so a
     page that pulls Tailwind (or any CDN) off the network frequently still has
     an EMPTY body at this point - and the import silently returned nothing.
     That is why importing a real, complete page produced zero blocks and the
     caller quietly fell back to its own hand-built approximation.
     DOMParser is synchronous and always yields the full tree, so use it as the
     fallback whenever the live document came back empty. */
  if ((!scope || !scope.children || !scope.children.length) && hostDoc) {
    try {
      const viaParser = new DOMParser().parseFromString(raw, 'text/html');
      const alt = opts.selector ? viaParser.querySelector(opts.selector) : viaParser.body;
      if (alt && alt.children && alt.children.length) scope = alt;
    } catch (e) { void e; }
  }
  if (!scope) {
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return [];
  }

  const fidelity = opts.fidelity !== false && opts.structure !== true;
  if (fidelity) {
    const headCss = extractHeadCss(parseDoc);
    let bodyHtml = extractBodyHtml(scope);
    try {
      const htmlEl = parseDoc.documentElement;
      const dir = (htmlEl && htmlEl.getAttribute('dir')) || scope.getAttribute('dir') || '';
      const htmlClass = (htmlEl && htmlEl.getAttribute('class')) || '';
      const bodyClass = scope.getAttribute('class') || '';
      const bodyStyle = scope.getAttribute('style') || '';
      const wrapAttrs = [];
      if (dir) wrapAttrs.push('dir="' + dir.replace(/"/g, '') + '"');
      const cls = [htmlClass, bodyClass].filter(Boolean).join(' ').trim();
      if (cls) wrapAttrs.push('class="' + cls.replace(/"/g, '') + '"');
      if (bodyStyle) wrapAttrs.push('style="' + bodyStyle.replace(/"/g, '&quot;') + '"');
      if (wrapAttrs.length) {
        bodyHtml = '<div ' + wrapAttrs.join(' ') + '>' + bodyHtml + '</div>';
      }
    } catch (e) {
      void e;
    }

    const stage = createBlock('htmlStage');
    stage.locked = false;
    stage.name = String(opts.sourceName || 'Imported page').slice(0, 48);
    stage.props.bodyHtml = bodyHtml;
    stage.props.headCss = headCss;
    stage.props.sourceName = opts.sourceName || '';
    stage.props.editable = true;
    stage.style = Object.assign({}, stage.style, {
      w: '100%',
      minH: 900,
      overflow: 'auto',
      bg: 'transparent',
    });

    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return [stage];
  }

  const roots = [];
  /* Exact tag match, NOT a prefix pattern.
     /^...|head|.../i matches "header" too - "^head" only needs the first four
     characters - so every <header> in every imported page was silently
     dropped, which is why the starter page came in without its navigation bar.
     SKIP_TAGS already lists these; keep the guard anchored at both ends. */
  const noisy = /^(?:script|style|noscript|template|link|meta|head|title|svg|iframe|canvas|video|audio|source|track|param|map|area|object|embed|base|form)$/i;

  const walk = (el, depth) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag) || noisy.test(tag)) continue;
      const cls = (child.className && String(child.className)) || '';
      const id = child.id || '';
      if (
        depth < 3 &&
        /^(div|main)$/i.test(tag) &&
        /^(container|wrapper|inner|content|main|body|page|app|root)$/i.test(cls.trim() || id) &&
        child.children.length
      ) {
        walk(child, depth + 1);
        continue;
      }
      roots.push(child);
    }
  };
  walk(scope, 0);

  try {
    void (iframe && iframe.contentWindow && iframe.contentWindow.getComputedStyle(scope).display);
  } catch (e) {
    void e;
  }

  const blocks = roots.map((el, i) => makeFromElement(el, i)).filter(Boolean);
  if (opts.maxDepth) {
    const prune = (b, depth) => {
      if (depth > opts.maxDepth) {
        b.children = [];
        return;
      }
      for (const c of b.children || []) prune(c, depth + 1);
    };
    for (const b of blocks) prune(b, 1);
  }

  if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
  return blocks;
}

export function blocksToHtml(blocks, doc) {
  return blocks.map((b) => {
    const def = getDef(b.type);
    const tag = def ? def.tag : 'div';
    const s = Object.assign({}, b.style);
    delete s.pos;
    const decls = [];
    for (const key in s) {
      if (s[key] == null || s[key] === '') continue;
      decls.push(key.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + s[key]);
    }
    const inner = def && def.render ? def.render(b.props || {}, b.style || {}, b) : '';
    const kids = (b.children || []).map((c) => blocksToHtml([c], doc)).join('');
    return '<' + tag + ' style="' + decls.join(';') + '">' + inner + kids + '</' + tag + '>';
  }).join('\n');
}



export { escapeHtml, makeBlock };
