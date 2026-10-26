import { def, category } from './registry.js';
import { listFrameworks } from '../lib/frameworks.js';

/*
 * FRAMEWORK BLOCKS
 * ================
 * React, Vue, Svelte and Vanilla Web Component blocks.
 *
 * These are NOT placeholders. Each one IS a real custom element on the canvas:
 * the framework host registers the tag, loads the runtime from a CDN and
 * mounts the author's real component, so what you see while editing is what
 * the exported page will show.
 *
 * No compilation step and no JSX:
 *  - React uses htm tagged templates over React.createElement
 *  - Vue uses the in-browser template compiler
 *  - Svelte is compiled in the browser at runtime
 *  - Vanilla is a native Custom Element
 */




category('Frameworks', 'cube');

const FRAMEWORK_OPTIONS = listFrameworks().map((f) => f.id);

function frameworkDefaults(fw, tagName, source) {
  return {
    props: {
      framework: fw.id,
      tagName: tagName,
      source: source,
      title: fw.name + ' component',
      props: '{}',
    },
    style: {
      display: 'block',
      dir: 'column',
      gap: 12,
      w: 320,
      h: 200,
      minW: 140,
      minH: 90,
      p: 12,
      bg: 'var(--bg-2, #f8fafc)',
      border: '1px solid var(--line, #e2e8f0)',
      radius: 10,
    },
  };
}

const FRAMEWORK_FIELDS = [
  { k: 'framework', l: 'Framework', t: 'select', opts: FRAMEWORK_OPTIONS },
  { k: 'tagName', l: 'Element tag', t: 'text' },
  { k: 'props', l: 'Props (JSON)', t: 'textarea' },
  { k: 'source', l: 'Component source', t: 'code' },
];

/* One block per framework, pre-filled with a working starter component. */
for (const fw of listFrameworks()) {
  const tag = fw.id + '-component';
  def({
    type: fw.id + 'Component',
    label: fw.name,
    cat: 'Frameworks',
    icon: fw.id,
    tag: 'div',
    customTag: true,
    container: false,
    keywords: fw.name.toLowerCase() + ' framework component web component ' + fw.tagline,
    defaults: frameworkDefaults(fw, tag, fw.starter),
    fields: FRAMEWORK_FIELDS,
    render: () => '',
  });
}

/* A blank component the author fills in from scratch. */
def({
  type: 'framework',
  label: 'Custom element',
  cat: 'Frameworks',
  icon: 'cube',
  tag: 'div',
  customTag: true,
  container: false,
  keywords: 'custom element component web component blank',
  defaults: frameworkDefaults(listFrameworks()[3], 'my-element', listFrameworks()[3].starter),
  fields: FRAMEWORK_FIELDS,
  render: () => '',
});





