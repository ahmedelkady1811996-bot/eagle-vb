/*
 * FRAMEWORK RUNTIME REGISTRY
 * ===========================
 * React, Vue, Svelte and plain Web Components that run in the BROWSER with
 * no build step, no bundler and no JSX.
 *
 * Why this shape:
 *  - Every framework is reached through an ES-module CDN import, so the
 *    exported page is a plain .html file that runs from file:// or any host.
 *  - React is used WITHOUT JSX. `htm` gives JSX-like tagged templates on top
 *    of React.createElement, so the author writes real JavaScript.
 *  - Vue runs its own in-browser template compiler (the full esm-browser
 *    build), so a component is an object literal with a `template` string.
 *  - Svelte is compiled in the browser at runtime - exactly what the Svelte
 *    REPL does - and mounted inside a custom element.
 *  - Vanilla needs nothing at all: it is a native Custom Element.
 *
 * Every framework is wrapped in a Custom Element so the builder can place it
 * on the canvas, style it like any other block, and re-parent it freely.
 *
 * The author's source is evaluated in a module that ALREADY carries the
 * framework runtime (the `preamble`), so `React`, `html`, `ref` and friends
 * are in scope exactly as they would be in a normal project. This is the
 * single most important detail: without it the author's code references
 * identifiers that do not exist and the component never mounts.
 */

/** Escape a string so it can be embedded inside a <script> element. */
export function safeScript(text) {
  return String(text == null ? '' : text)
    .replace(/</script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');
}

/** "react-component" -> "ReactComponent" (a valid JavaScript identifier). */
export function toPascal(tagName) {
  return String(tagName || 'component')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'Component';
}

/** The class name of the generated custom element. */
export function toClassName(tagName) {
  return toPascal(tagName) + 'Element';
}

const REACT_URL = 'https://esm.sh/react@18.3.1';
const REACT_DOM_URL = 'https://esm.sh/react-dom@18.3.1/client';
const HTM_URL = 'https://esm.sh/htm@3.1.1';
const VUE_URL = 'https://esm.sh/vue@3.4.21/dist/vue.esm-browser.js';
const SVELTE_URL = 'https://esm.sh/svelte@4.2.19';
const SVELTE_INTERNAL_URL = 'https://esm.sh/svelte@4.2.19/internal';
const SVELTE_COMPILER_URL = 'https://esm.sh/svelte@4.2.19/compiler';

/* ------------------------------------------------------------------ */
/* React — htm templates, no JSX, no build step                       */
/* ------------------------------------------------------------------ */
const REACT_PREAMBLE = [
  "import React from '" + REACT_URL + "';",
  "import htm from '" + HTM_URL + "';",
  'const html = htm.bind(React.createElement);',
];

/* ------------------------------------------------------------------ */
/* Vue 3 — in-browser template compiler                                */
/* ------------------------------------------------------------------ */
const VUE_PREAMBLE = [
  "import { createApp, ref, reactive, computed, watch, onMounted } from '" + VUE_URL + "';",
];

/* ------------------------------------------------------------------ */
/* Svelte — compiled in the browser at runtime                         */
/* ------------------------------------------------------------------ */
const SVELTE_PREAMBLE = [
  "import { onMount, afterUpdate, beforeUpdate, tick } from '" + SVELTE_URL + "';",
];

export const FRAMEWORKS = [
  {
    id: 'react',
    name: 'React',
    tagline: 'htm templates — real JavaScript, no JSX, no build step',
    accent: '#61dafb',
    kind: 'react',
    preamble: REACT_PREAMBLE,
    starter: [
      '// React without JSX. `html` is htm bound to React.createElement.',
      '// The component must be named App.',
      '',
      'function Counter() {',
      '  const [count, setCount] = React.useState(0);',
      '  return html`',
      '    <div class="counter">',
      '      <strong>${count}</strong>',
      '      <button onClick=${() => setCount(count + 1)}>Count +1</button>',
      '    </div>`;',
      '}',
      '',
      'function App() {',
      '  return html`<${Counter} />`;',
      '}',
    ].join('\n'),
    /** The module the exported page carries. */
    emit(tagName, source, props) {
      return [
        "import React from '" + REACT_URL + "';",
        "import { createRoot } from '" + REACT_DOM_URL + "';",
        "import htm from '" + HTM_URL + "';",
        'const html = htm.bind(React.createElement);',
        '',
        safeScript(source || ''),
        '',
        'const __vbProps = ' + JSON.stringify(props || {}) + ';',
        'const __vbComponent = (typeof App !== "undefined") ? App',
        '  : (typeof Component !== "undefined") ? Component',
        '  : null;',
        'if (!__vbComponent) throw new Error("Define a component named App");',
        '',
        'class ' + toClassName(tagName) + ' extends HTMLElement {',
        '  connectedCallback() {',
        '    if (this.__vbRoot) return;',
        '    this.__vbRoot = createRoot(this);',
        '    this.__vbRoot.render(html`<${__vbComponent} ...${__vbProps} />`);',
        '  }',
        '  disconnectedCallback() {',
        '    if (this.__vbRoot) { try { this.__vbRoot.unmount(); } catch (e) {} this.__vbRoot = null; }',
        '  }',
        '}',
        'if (!customElements.get(' + JSON.stringify(tagName) + ')) customElements.define('
          + JSON.stringify(tagName) + ', ' + toClassName(tagName) + ');',
      ].join('\n');
    },
  },
  {
    id: 'vue',
    name: 'Vue 3',
    tagline: 'single-file feel — a component object with a template string',
    accent: '#42b883',
    kind: 'vue',
    preamble: VUE_PREAMBLE,
    starter: [
      '// Vue 3 with the in-browser template compiler.',
      '// The component must be named App.',
      '',
      'const App = {',
      '  data() { return { count: 0 }; },',
      '  template: `',
      '    <div class="counter">',
      '      <strong>{{ count }}</strong>',
      '      <button @click="count++">Count +1</button>',
      '    </div>`',
      '};',
    ].join('\n'),
    emit(tagName, source, props) {
      return [
        "import { createApp, ref, reactive, computed, watch, onMounted } from '" + VUE_URL + "';",
        '',
        safeScript(source || ''),
        '',
        'const __vbProps = ' + JSON.stringify(props || {}) + ';',
        'const __vbComponent = (typeof App !== "undefined") ? App',
        '  : (typeof Component !== "undefined") ? Component',
        '  : null;',
        'if (!__vbComponent) throw new Error("Define a component named App");',
        '',
        'class ' + toClassName(tagName) + ' extends HTMLElement {',
        '  connectedCallback() {',
        '    if (this.__vbApp) return;',
        '    this.__vbApp = createApp(__vbComponent, __vbProps);',
        '    this.__vbApp.mount(this);',
        '  }',
        '  disconnectedCallback() {',
        '    if (this.__vbApp) { try { this.__vbApp.unmount(); } catch (e) {} this.__vbApp = null; }',
        '  }',
        '}',
        'if (!customElements.get(' + JSON.stringify(tagName) + ')) customElements.define('
          + JSON.stringify(tagName) + ', ' + toClassName(tagName) + ');',
      ].join('\n');
    },
  },
  {
    id: 'svelte',
    name: 'Svelte',
    tagline: 'compiled in the browser — no bundler, no .svelte build step',
    accent: '#ff3e00',
    kind: 'svelte',
    preamble: SVELTE_PREAMBLE,
    starter: [
      '<!-- A Svelte component. It is compiled in the browser at runtime. -->',
      '<script>',
      '  let count = 0;',
      '</script>',
      '',
      '<div class="counter">',
      '  <strong>{count}</strong>',
      '  <button on:click={() => count += 1}>Count +1</button>',
      '</div>',
    ].join('\n'),
    emit(tagName, source, props) {
      return [
        "import { compile } from '" + SVELTE_COMPILER_URL + "';",
        '',
        'const __vbProps = ' + JSON.stringify(props || {}) + ';',
        'const __vbSource = ' + JSON.stringify(source || '') + ';',
        '',
        'class ' + toClassName(tagName) + ' extends HTMLElement {',
        '  connectedCallback() {',
        '    if (this.__vbApp) return;',
        '    (async () => {',
        '      const __out = compile(__vbSource, {',
        '        name: ' + JSON.stringify(toPascal(tagName)) + ',',
        '        generate: "dom",',
        '        css: "injected",',
        '      });',
        '      /* Svelte 4 returns { js: { code, map } } - the code is one level down. */',
        '      const __js = (__out && __out.js && __out.js.code) || (__out && __out.js) || "";',
        '      /* the compiled module imports the bare specifier "svelte/internal"',
        '         (and "svelte/internal/disclose-version"); a blob module cannot',
        '         resolve a bare specifier, so point every "svelte..." specifier at',
        '         the CDN the page already loads. */',
        /* NB: the backreferences have to be doubled here. Inside a quoted
           string "\\1" is the two characters \1, while "\1" would collapse to
           the digit 1 and quietly break the back-reference. */
        '      const code = __js.replace(/(["\'])svelte(\\/[^"\']*)?\\1/g,',
        '        (m, q, rest) => q + ' + JSON.stringify(SVELTE_URL) + ' + (rest || "") + q);',
        '      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));',
        '      const mod = await import(url);',
        '      URL.revokeObjectURL(url);',
        '      this.__vbApp = new mod.default({ target: this, props: __vbProps });',
        '    })().catch((e) => {',
        '      this.textContent = "Svelte error: " + (e && e.message ? e.message : e);',
        '      console.error("[vb:svelte]", e);',
        '    });',
        '  }',
        '  disconnectedCallback() {',
        '    if (this.__vbApp) { try { this.__vbApp.$destroy(); } catch (e) {} this.__vbApp = null; }',
        '  }',
        '}',
        'if (!customElements.get(' + JSON.stringify(tagName) + ')) customElements.define('
          + JSON.stringify(tagName) + ', ' + toClassName(tagName) + ');',
      ].join('\n');
    },
  },
  {
    id: 'vanilla',
    name: 'Vanilla WC',
    tagline: 'a native Custom Element — zero dependencies',
    accent: '#f7df1e',
    kind: 'vanilla',
    preamble: [],
    starter: [
      '// A native Custom Element. The builder registers the tag for you,',
      '// so do not call customElements.define() here.',
      'export default class MyWidget extends HTMLElement {',
      '  connectedCallback() {',
      '    this.innerHTML = `<button>Hello</button>`;',
      '    this.querySelector("button").onclick = () => {',
      '      const n = (Number(this.dataset.count) || 0) + 1;',
      '      this.dataset.count = String(n);',
      '      this.querySelector("button").textContent = "Hello " + n;',
      '    };',
      '  }',
      '}',
    ].join('\n'),
    emit(tagName, source) {
      /* The author's source is a module (`export default class X`). The export
         is a CLASSIC script, so the `export default` has to become a plain
         class declaration and the builder has to know its name. */
      const raw = String(source || '');
      const m = /export\s+default\s+class\s+([A-Za-z_$][\w$]*)/.exec(raw);
      const className = m ? m[1] : '';
      const body = stripDefine(raw).replace(/export\s+default\s+class\s+[A-Za-z_$][\w$]*/, 'class ' + (className || 'VbVanillaElement'));
      return [
        body,
        '',
        'if (!customElements.get(' + JSON.stringify(tagName) + ')) {',
        '  if (typeof ' + (className || 'VbVanillaElement') + ' !== "function") {',
        '    throw new Error("export default a class that extends HTMLElement");',
        '  }',
        '  customElements.define(' + JSON.stringify(tagName) + ', ' + (className || 'VbVanillaElement') + ');',
        '}',
      ].join('\n');
    },
  },
];

/**
 * Remove a user-authored customElements.define - the builder owns the tag.
 *
 * The pattern must NOT match `customElements.define()` with an EMPTY argument
 * list: a source that merely MENTIONS the call in a comment
 * ("do not call customElements.define() here") would otherwise be rewritten
 * from that point to the next semicolon - which swallowed the whole class body
 * and left a dangling "}". The argument list therefore has to be non-empty,
 * and it may not cross a closing parenthesis.
 */
export function stripDefine(source) {
  return String(source || '').replace(
    /\bcustomElements\s*\.\s*define\s*\(\s*[^)\s][^)]*\)/g,
    '/* customElements.define(...) — the builder registers this tag for you */'
  );
}

export function getFramework(id) {
  return FRAMEWORKS.find((f) => f.id === id) || null;
}

export function listFrameworks() {
  return FRAMEWORKS;
}

/**
 * The module the author's source is evaluated in. It carries the framework
 * runtime, so `React`, `html`, `ref` and friends are in scope.
 */
export function sourceModule(framework, source, tagName) {
  const fw = getFramework(framework);
  if (!fw) return String(source || '');
  if (fw.kind === 'vanilla') {
    /* The vanilla source already carries `export default class ...`, so the
       class IS the module's default export. Appending another default export
       here would be a SyntaxError. */
    return stripDefine(source || '');
  }
  if (fw.kind === 'svelte') {
    /* A Svelte component is compiled, not imported: the source is markup. */
    return String(source || '');
  }
  return [
    fw.preamble.join('\n'),
    source || '',
    'export default (typeof App !== "undefined") ? App',
    '  : (typeof Component !== "undefined") ? Component',
    '  : null;',
  ].join('\n');
}

/**
 * Collect every framework actually used by a document.
 * @param {Array} blocks flat list of blocks
 */
export function usedFrameworks(blocks) {
  const out = [];
  const seen = new Set();
  const walk = (list) => {
    for (const b of list || []) {
      if (!b) continue;
      const props = b.props || {};
      if (props.framework && props.tagName && !seen.has(props.tagName)) {
        seen.add(props.tagName);
        out.push({
          framework: props.framework,
          tagName: props.tagName,
          source: props.source || '',
          props: parseProps(props.props),
        });
      }
      walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

/** The block stores props as a JSON string; a bad value must not break the page. */
export function parseProps(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const v = JSON.parse(String(raw));
    return (v && typeof v === 'object') ? v : {};
  } catch (e) {
    return {};
  }
}

/**
 * The runtime <script> blocks for a set of framework components.
 * Each component gets its own module so a failure in one cannot take the
 * whole page down.
 */
export function frameworkScripts(components) {
  const parts = [];
  for (const c of components || []) {
    const fw = getFramework(c.framework);
    if (!fw) continue;
    const code = fw.emit(c.tagName, c.source, c.props);
    parts.push('<script type="module">\n' + safeScript(code) + '\n</script>');
  }
  return parts.join('\n');
}
