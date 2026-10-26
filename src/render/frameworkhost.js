import { getFramework, sourceModule, parseProps, toPascal } from '../lib/frameworks.js';

/*
 * FRAMEWORK HOST
 * ==============
 * Runs React / Vue / Svelte / Vanilla components INSIDE the builder canvas so
 * the author sees the real component while editing, not a grey box.
 *
 * How it works
 * ------------
 *  - Each component lives in a registry keyed by its custom-element tag.
 *  - A generic Custom Element class is defined once per tag; its
 *    connectedCallback asks the registry for the current source and mounts it.
 *  - Changing the source bumps a version and every live instance is remounted,
 *    so editing the code updates the canvas immediately.
 *  - The framework runtime is imported lazily, once, straight from a CDN as an
 *    ES module. There is no build step and no bundler involved.
 *
 * The author's source is evaluated in a module that already carries the
 * framework runtime (see sourceModule in lib/frameworks.js), so `React`,
 * `html` and `ref` are in scope exactly as they would be in a real project.
 */



const REGISTRY_KEY = '__vbFrameworkRegistry';
const RUNTIMES = new Map();

function reg() {
  if (!window[REGISTRY_KEY]) window[REGISTRY_KEY] = {};
  return window[REGISTRY_KEY];
}

/* ------------------------------------------------------------------ */
/* Runtime loading                                                     */
/* ------------------------------------------------------------------ */

export function ensureRuntime(framework) {
  if (RUNTIMES.has(framework)) return RUNTIMES.get(framework);
  let p;
  if (framework === 'react') {
    p = Promise.all([
      import('https://esm.sh/react@18.3.1'),
      import('https://esm.sh/react-dom@18.3.1/client'),
      import('https://esm.sh/htm@3.1.1'),
    ]).then(([react, dom, htm]) => {
      const R = react.default || react;
      return {
        React: R,
        createRoot: dom.createRoot,
        html: (htm.default || htm).bind(R.createElement),
      };
    });
  } else if (framework === 'vue') {
    p = import('https://esm.sh/vue@3.4.21/dist/vue.esm-browser.js').then((m) => ({
      createApp: m.createApp,
      ref: m.ref,
      reactive: m.reactive,
      computed: m.computed,
    }));
  } else if (framework === 'svelte') {
    p = Promise.all([
      import('https://esm.sh/svelte@4.2.19'),
      import('https://esm.sh/svelte@4.2.19/compiler'),
    ]).then(([svelte, compiler]) => ({
      /* Svelte 4 has no mount()/unmount(): a component is constructed with
         new Component({ target, props }) and torn down with $destroy(). */
      SvelteComponent: svelte.default,
      compile: compiler.compile,
    }));
  } else {
    p = Promise.resolve({});
  }
  const wrapped = p.catch((e) => {
    RUNTIMES.delete(framework);
    throw e;
  });
  RUNTIMES.set(framework, wrapped);
  return wrapped;
}

/* ------------------------------------------------------------------ */
/* Source evaluation                                                   */
/* ------------------------------------------------------------------ */

function blobModule(code) {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  return import(url).finally(() => {
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { void e; } }, 4000);
  });
}

function evalSource(entry) {
  const fw = getFramework(entry.framework);
  if (!fw) throw new Error('Unknown framework ' + entry.framework);
  if (fw.kind === 'svelte') {
    /* Svelte source is markup: it has to be COMPILED, not imported. */
    return ensureRuntime('svelte').then((rt) => {
      const out = rt.compile(entry.source || '', {
        name: toPascal(entry.tagName),
        generate: 'dom',
        css: 'injected',
      });
      /* Svelte 4 returns { js: { code, map } } - the code is one level down. */
      const js = (out && out.js && out.js.code) || (out && out.js) || '';
      /* The compiled module imports the bare specifier "svelte/internal"
         (and "svelte/internal/disclose-version"); a blob module cannot
         resolve a bare specifier, so point every "svelte..." specifier at
         the CDN. */
      const code = js.replace(/(["'])svelte(\/[^"']*)?\1/g,
        (m, q, rest) => q + 'https://esm.sh/svelte@4.2.19' + (rest || '') + q);
      return blobModule(code);
    });
  }
  return blobModule(sourceModule(entry.framework, entry.source, entry.tagName));
}

/* ------------------------------------------------------------------ */
/* Mounting                                                            */
/* ------------------------------------------------------------------ */

async function mountInto(el, entry) {
  const fw = getFramework(entry.framework);
  if (!fw) throw new Error('Unknown framework');

  if (fw.kind === 'vanilla') {
    const mod = await blobModule(sourceModule('vanilla', entry.source, entry.tagName));
    const Ctor = mod.default;
    if (typeof Ctor !== 'function') {
      throw new Error('export default a class that extends HTMLElement');
    }
    /* An HTMLElement subclass that is NOT registered cannot be constructed
       with `new` - the browser throws "Illegal constructor". It has to be
       registered under a name first and then CREATED with createElement,
       which is also what upgrades it.
       The builder already owns the author's tag (it hosts the generic
       wrapper), so the user's class gets an internal tag of its own. */
    const innerTag = 'vb-fw-' + String(entry.tagName || 'x').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!customElements.get(innerTag)) {
      try { customElements.define(innerTag, Ctor); }
      catch (e) { void e; }
    }
    const inner = document.createElement(innerTag);
    el.appendChild(inner);
    return () => { try { inner.remove(); } catch (e) { void e; } };
  }

  if (fw.kind === 'react') {
    const rt = await ensureRuntime('react');
    const mod = await blobModule(sourceModule('react', entry.source, entry.tagName));
    const Component = mod.default;
    if (!Component) throw new Error('Define a component named App');
    const root = rt.createRoot(el);
    root.render(rt.html`<${Component} ...${entry.props || {}} />`);
    return () => root.unmount();
  }

  if (fw.kind === 'vue') {
    const rt = await ensureRuntime('vue');
    const mod = await blobModule(sourceModule('vue', entry.source, entry.tagName));
    const options = mod.default;
    if (!options) throw new Error('Define a component named App');
    const app = rt.createApp(options, entry.props || {});
    app.mount(el);
    return () => { try { app.unmount(); } catch (e) { void e; } };
  }

  if (fw.kind === 'svelte') {
    const rt = await ensureRuntime('svelte');
    const mod = await evalSource(entry);
    const Component = mod.default;
    if (!Component) throw new Error('The Svelte component has no default export');
    const instance = new Component({ target: el, props: entry.props || {} });
    return () => { try { instance.$destroy(); } catch (e) { void e; } };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Custom element plumbing                                             */
/* ------------------------------------------------------------------ */

const DEFINED = new Set();

function defineElement(tagName) {
  if (DEFINED.has(tagName)) return;
  DEFINED.add(tagName);
  const Ctor = class extends HTMLElement {
    connectedCallback() {
      const entry = reg()[this.localName];
      if (!entry) return;
      this.__vbUnmount = null;
      /* On the canvas the component lives inside the block's content wrapper
         (.vb-c); in the exported page there is no wrapper, so it mounts into
         the element itself. */
      const target = this.querySelector(':scope > .vb-c') || this;
      mountInto(target, entry)
        .then((unmount) => { this.__vbUnmount = unmount; })
        .catch((e) => {
          target.innerHTML = '';
          const pre = document.createElement('pre');
          pre.textContent = String((e && e.message) || e);
          pre.style.cssText = 'margin:0;font:11px ui-monospace,monospace;color:#b91c1c;white-space:pre-wrap;background:#fef2f2;padding:8px;border-radius:6px';
          target.appendChild(pre);
        });
    }
    disconnectedCallback() {
      if (this.__vbUnmount) { try { this.__vbUnmount(); } catch (e) { void e; } }
      this.__vbUnmount = null;
    }
  };
  if (!customElements.get(tagName)) customElements.define(tagName, Ctor);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Register (or update) a framework component and remount live instances.
 *
 * The remount only happens when the source really changed. This function is
 * called on EVERY canvas repaint, and remounting unconditionally would tear
 * down and rebuild every live component (and lose its state) on each mouse
 * move.
 */
export function registerComponent(tagName, framework, source, props) {
  const tag = String(tagName || '').trim();
  if (!tag) return;
  defineElement(tag);
  const r = reg();
  const prev = r[tag];
  const nextSource = String(source || '');
  const changed = !prev
    || prev.source !== nextSource
    || prev.framework !== (framework || 'vanilla')
    || JSON.stringify(prev.props || {}) !== JSON.stringify(props || {});
  r[tag] = {
    tagName: tag,
    framework: framework || 'vanilla',
    source: nextSource,
    props: props || {},
    version: (prev ? prev.version : 0) + (changed ? 1 : 0),
  };
  if (changed) remount(tag);
}

/** Re-mount every live instance of a tag (after a source edit). */
export function remount(tagName) {
  const nodes = document.querySelectorAll(tagName);
  for (const node of nodes) {
    if (node.__vbUnmount) { try { node.__vbUnmount(); } catch (e) { void e; } }
    node.__vbUnmount = null;
    /* Force connectedCallback to run again. */
    const parent = node.parentNode;
    if (!parent) continue;
    const placeholder = document.createComment('vb-fw');
    parent.replaceChild(placeholder, node);
    parent.replaceChild(node, placeholder);
  }
}

/** Register every framework component found in a document. */
export function syncDocument(blocks) {
  const seen = new Set();
  const walk = (list) => {
    for (const b of list || []) {
      if (!b) continue;
      const p = b.props || {};
      if (p.framework && p.tagName && !seen.has(p.tagName)) {
        seen.add(p.tagName);
        registerComponent(p.tagName, p.framework, p.source || '', parseProps(p.props));
      }
      walk(b.children);
    }
  };
  walk(blocks);
  return seen;
}

export function isReady() {
  return Object.keys(reg()).length > 0;
}
