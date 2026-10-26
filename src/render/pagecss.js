/**
 * PAGE CSS - an imported page's own stylesheet, applied to the canvas only.
 *
 * Why this exists: an imported page is styled by Tailwind + web fonts + Font
 * Awesome, applied to its own class names. The editor document has none of
 * those, so drawing the imported blocks as native elements produced a pile of
 * unstyled text - nothing like the page the user is editing.
 *
 * The obvious fix - loading Tailwind into the editor document - is not safe:
 * its preflight restyles the editor's own chrome, and its utility classes
 * would compete with the builder's stylesheet.
 *
 * So the page's CSS is fetched, rewritten so every selector is scoped under
 * #canvas, and injected into one <style>. The canvas then renders the page
 * exactly like a browser does, while staying NATIVE - so dragging, resizing,
 * the selection box, flow and free all keep working.
 */

const ID = 'vb-page-css';
let styleEl = null;
let appliedKey = '';
let loading = false;

function sheet() {
  if (styleEl && styleEl.isConnected) return styleEl;
  styleEl = document.getElementById(ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = ID;
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

const AT_BLOCK = /^@(media|supports|layer|container|scope|document)\b/i;
const AT_PASSTHROUGH = /^@(keyframes|font-face|charset|import|page|namespace|property|counter-style)\b/i;

/**
 * Prefix every selector in a stylesheet with `#canvas `.
 *
 * At-rules that contain other rules (@media, @supports, @layer) are recursed
 * into; at-rules that do not (@keyframes, @font-face, @charset, @import) are
 * emitted untouched. Prefixing a @keyframes NAME would break every animation
 * on the page, and prefixing a selector inside @media is what makes the
 * responsive rules work.
 */
/* Classes the page keeps on <html> - currently the class-based dark mode.
   They live on the canvas element too, but a scoped `.dark .x{}` becomes
   `.vbpage .dark .x{}`, which needs .dark to be a DESCENDANT of .vbpage. Since
   they are on the SAME element, the class has to be folded into the scope:
   `.vbpage.dark .x{}`, which still outranks the light `.vbpage .x{}`. */
let ROOT_CLASSES = [];

export function setRootClasses(list) {
  ROOT_CLASSES = (list || []).filter(Boolean);
}

/**
 * Prefix every selector in a stylesheet with `#canvas `.
 *
 * At-rules that contain other rules (@media, @supports, @layer) are recursed
 * into; at-rules that do not (@keyframes, @font-face, @charset, @import) are
 * emitted untouched. Prefixing a @keyframes NAME would break every animation
 * on the page, and prefixing a selector inside @media is what makes the
 * responsive rules work.
 */
export function scopeCss(css, prefix) {
  /* The scope must be a CLASS, never an id. `#canvas .w-full` is (1,1,0) and
     would outrank every builder rule such as `.vb-frame[data-id="x"]` at
     (0,2,0), so a resize wrote style.w and nothing happened - the page rule
     simply won, whatever the cascade order. */
  const p = prefix || '.vbpage ';
  const src = String(css || '');
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    // skip whitespace
    while (i < n && /\s/.test(src[i])) i += 1;
    if (i >= n) break;

    if (src[i] === '@') {
      const braceAt = src.indexOf('{', i);
      const semiAt = src.indexOf(';', i);
      const isBlock = braceAt >= 0 && (semiAt < 0 || braceAt < semiAt);
      if (AT_PASSTHROUGH.test(src.slice(i, i + 40))) {
        // no nested rules: copy through to the matching ; or {..}
        if (!isBlock) {
          out += src.slice(i, semiAt + 1) + '\n';
          i = semiAt + 1;
        } else {
          let depth = 0;
          let j = braceAt;
          for (; j < n; j += 1) {
            if (src[j] === '{') depth += 1;
            else if (src[j] === '}') { depth -= 1; if (depth === 0) break; }
          }
          out += src.slice(i, j + 1) + '\n';
          i = j + 1;
        }
        continue;
      }
      if (AT_BLOCK.test(src.slice(i, i + 40)) && isBlock) {
        // find the block end
        let depth = 0;
        let j = braceAt;
        for (; j < n; j += 1) {
          if (src[j] === '{') depth += 1;
          else if (src[j] === '}') { depth -= 1; if (depth === 0) break; }
        }
        const head = src.slice(i, braceAt + 1);
        const body = src.slice(braceAt + 1, j);
        out += head + '\n' + scopeCss(body, p) + '}\n';
        i = j + 1;
        continue;
      }
      // an unknown at-rule: copy verbatim to the next ; or }
      const end = Math.min(
        semiAt >= 0 ? semiAt : n,
        braceAt >= 0 ? braceAt : n
      );
      out += src.slice(i, end + 1) + '\n';
      i = end + 1;
      continue;
    }

    // a normal rule: selector { body }
    const braceAt = src.indexOf('{', i);
    if (braceAt < 0) { out += src.slice(i); break; }
    let depth = 0;
    let j = braceAt;
    for (; j < n; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') { depth -= 1; if (depth === 0) break; }
    }
    const sel = src.slice(i, braceAt).trim();
    const body = src.slice(braceAt + 1, j);
    const scoped = sel.split(',').map((one) => {
      const s = one.trim();
      if (!s) return '';
      if (s === 'html' || s === 'body' || s === ':root' || s === '*') return p + '*';
      /* fold a root class (.dark …) into the scope and REMOVE it from the
         selector, otherwise `.dark .x` becomes `.vbpage.dark .dark .x` and
         matches nothing */
      let scope = p;
      let rest = s;
      const first = /^([^\s>+~]+)/.exec(s);
      if (first && ROOT_CLASSES.length) {
        const head = first[1];
        const classes = head.split('.');
        const folded = ROOT_CLASSES.filter((rc) => classes.indexOf(rc) >= 0);
        if (folded.length) {
          scope = p.trim() + folded.map((rc) => '.' + rc).join('') + ' ';
          const kept = classes.filter((c) => ROOT_CLASSES.indexOf(c) < 0);
          rest = kept.join('.') + s.slice(head.length);
          if (!rest || /^\s*$/.test(rest)) return scope.trim();
        }
      }
      return scope + rest;
    }).filter(Boolean).join(',');
    out += scoped + ' {' + body + '}\n';
    i = j + 1;
  }
  return out;
}

function fetchText(url) {
  /* Never let a slow or unreachable CDN leave the canvas unstyled forever:
     an unbounded fetch that hangs means the promise never settles, the style
     element is never created, and the page silently renders unstyled. */
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
  return fetch(url, { credentials: 'omit', signal: ctl ? ctl.signal : undefined })
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '')
    .then((text) => { if (timer) clearTimeout(timer); return text; });
}

/** Everything the document declares, as one scoped stylesheet. */
export function pageCssFor(doc) {
  const head = (doc && doc.head) || {};
  const inline = (head.styles || []).filter((s) => s && !/tailwind\s*\.\s*config/.test(s));
  const remote = (head.links || []).slice();
  if (head.fonts) remote.push(head.fonts);
  if (head.iconCss) remote.push(head.iconCss);
  const key = inline.length + '|' + remote.join('|');
  return { inline, remote, key };
}

/**
 * Inject the page's CSS, scoped to the canvas.
 *
 * The page's own <style> blocks are applied SYNCHRONOUSLY, so the canvas is
 * never blank-styled; the remote stylesheets and the Tailwind build are added
 * when (and if) they arrive.
 */
export function applyPageCss(doc) {
  const { inline, remote, key } = pageCssFor(doc);
  setRootClasses(String((doc.head && doc.head.htmlClass) || '').split(/\s+/));
  const el = sheet();
  const base = scopeCss(inline.join('\n'));
  if (key === appliedKey) return false;
  appliedKey = key;
  loading = false;

  /* immediate: what needs no network */
  el.textContent = base;

  if (!remote.length && !(doc.head && doc.head.scripts || []).length) return true;

  loading = true;
  const tailwind = (doc.head && doc.head.scripts || []).filter((s) => /tailwind/i.test(s));
  Promise.all(remote.map(fetchText)).then((parts) => {
    let extra = '';
    for (const text of parts) if (text) extra += scopeCss(text) + '\n';
    const finish = () => {
      /* Tailwind's CDN build injects its own <style>. Collect EVERY sheet that
         carries Tailwind's markers and scope them all - taking the first match
         and stopping found the BUILDER's own stylesheet first (it has no id and
         contains `.flex{`), so the real utilities were never copied and every
         md:/dark: variant silently did nothing. */
      let tail = '';
      const seen = new Set();
      for (const s of document.querySelectorAll('style')) {
        if (s.id === ID || s.id === 'vb-doc-css' || seen.has(s)) continue;
        seen.add(s);
        const text = s.textContent || '';
        if (text.length < 4000) continue;
        if (!/--tw-/.test(text)) continue;
        tail += '\n' + scopeCss(text) + '\n';
      }
      el.textContent = base + '\n' + extra + '\n' + tail;
      loading = false;
    };
    if (tailwind.length && !document.querySelector('script[data-vb-tailwind]')) {
      const s = document.createElement('script');
      s.src = tailwind[0];
      s.dataset.vbTailwind = '1';
      s.onload = () => setTimeout(finish, 250);
      s.onerror = () => { el.textContent = base + '\n' + extra; loading = false; };
      document.head.appendChild(s);
      /* never block on it: apply whatever we have now */
      setTimeout(finish, 6000);
      return;
    }
    finish();
  }).catch(() => { loading = false; });
  return true;
}

export function clearPageCss() {
  appliedKey = '';
  const s = sheet();
  s.textContent = '';
}