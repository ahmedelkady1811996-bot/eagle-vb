import * as ops from '../model/ops.js';
import * as components from '../model/components.js';
import { h, clear, $ } from '../core/dom.js';
import { state, currentDoc, find, ancestors } from '../core/store.js';
import { emit, on } from '../core/bus.js';
import { get as getDef, isContainer, canHaveChildren } from '../model/catalog.js';
import { field, pair } from './fields.js';
import { iconFor } from './palette.js';
import { renderLayers } from './layers.js';
import { DISPLAY, FLEX_DIR, JUSTIFY, ALIGN, FONTS, FONT_WEIGHT, FONT_STYLE, TEXT_ALIGN, TEXT_CASE, DECOR, OBJECT_FIT, BLEND, SHADOWS, GRADIENTS, FILTERS, ANIMATIONS, EASES, loadDeviceFonts } from '../model/options.js';

void isContainer;







const TABS = [
  { id: 'design', label: 'Design' },
  { id: 'content', label: 'Content' },
  { id: 'motion', label: 'Motion' },
  { id: 'events', label: 'Events' },
  { id: 'advanced', label: 'Advanced' },
];

const EVENT_TRIGGERS = [
  { v: 'click', l: 'Click' },
  { v: 'dblclick', l: 'Double click' },
  { v: 'mouseenter', l: 'Hover enter' },
  { v: 'mouseleave', l: 'Hover leave' },
  { v: 'focus', l: 'Focus' },
  { v: 'blur', l: 'Blur' },
  { v: 'change', l: 'Change (inputs)' },
  { v: 'submit', l: 'Submit (forms)' },
  { v: 'inview', l: 'Scroll into view' },
  { v: 'load', l: 'When page loads' },
];

const EVENT_ACTIONS = [
  { v: 'navigate', l: 'Open URL' },
  { v: 'page', l: 'Go to page' },
  { v: 'scroll', l: 'Scroll to element' },
  { v: 'show', l: 'Show element' },
  { v: 'hide', l: 'Hide element' },
  { v: 'toggle', l: 'Toggle visibility' },
  { v: 'setText', l: 'Set text content' },
  { v: 'addClass', l: 'Add CSS class' },
  { v: 'removeClass', l: 'Remove CSS class' },
  { v: 'toggleClass', l: 'Toggle CSS class' },
  { v: 'animate', l: 'Play animation' },
  { v: 'toast', l: 'Show toast message' },
  { v: 'js', l: 'Run custom JavaScript' },
];

const closed = new Set();

function propTarget(block) {
  return { id: block.id, kind: 'props', read: (k) => (block.props || {})[k] };
}

function styleTarget(block) {
  return { id: block.id, kind: 'style', read: (k) => (block.style || {})[k] };
}

function rootTarget(block) {
  return { id: block.id, kind: 'root', read: (k) => block[k] };
}

function a11yTarget(block) {
  block.a11y = block.a11y || {};
  return { id: block.id, kind: 'a11y', read: (k) => (block.a11y || {})[k] };
}

function hoverTarget(block) {
  block.states = block.states || { hover: {}, focus: {} };
  block.states.hover = block.states.hover || {};
  return { id: block.id, kind: 'state', state: 'hover', read: (k) => (block.states.hover || {})[k] };
}

function section(title, children, key) {
  const isClosed = closed.has(key || title);
  const caret = h('span', { class: 'caret' }, '▾');
  const head = h('button', { class: 'sec__head', type: 'button' }, [caret, title]);
  const body = h('div', { class: 'sec__body' }, children.filter(Boolean));
  const wrap = h('div', { class: 'sec' + (isClosed ? ' is-closed' : '') }, [head, body]);
  head.addEventListener('click', () => {
    const id = key || title;
    if (closed.has(id)) closed.delete(id);
    else closed.add(id);
    wrap.classList.toggle('is-closed');
  });
  return wrap;
}


function autoLayoutPresets(block) {
  const presets = [
    { name: 'Vertical stack', style: { display: 'flex', dir: 'column', gap: 16, align: 'stretch', w: '100%' } },
    { name: 'Horizontal row', style: { display: 'flex', dir: 'row', gap: 12, align: 'center', w: '100%' } },
    { name: 'Space between', style: { display: 'flex', dir: 'row', justify: 'space-between', align: 'center', w: '100%' } },
    { name: 'Center content', style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', w: '100%', minH: 120 } },
    { name: '2-column grid', style: { display: 'grid', gridCols: 2, gap: 16, w: '100%' } },
    { name: '3-column grid', style: { display: 'grid', gridCols: 3, gap: 16, w: '100%' } },
    { name: 'Card padding', style: { pT: 24, pR: 24, pB: 24, pL: 24, radius: 16 } },
    { name: 'Full width section', style: { display: 'flex', dir: 'column', w: '100%', pT: 48, pB: 48, pL: 32, pR: 32, gap: 24 } },
  ];
  const wrap = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } });
  for (const p of presets) {
    const b = h('button', { class: 'tb-btn', type: 'button' }, p.name);
    b.addEventListener('click', () => {
      block.style = Object.assign({}, block.style || {}, p.style);
      emit('doc');
      emit('inspector:rerender');
    });
    wrap.appendChild(b);
  }
  wrap.appendChild(h('div', { style: { width: '100%', fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' } },
    'Applies flex/grid layout in one click. Refine below. Works best on frames, stacks, and sections.'));
  return [wrap];
}

function designTab(block) {
  const s = styleTarget(block);
  const free = currentDoc().canvas && currentDoc().canvas.mode === 'free';
  const def = getDef(block.type);
  const out = [];

  // Type-specific property groups first (adaptive to the selected component)
  if (def && def.groups && def.groups.length) {
    const p = propTarget(block);
    for (const group of def.groups) {
      if (!group || !group.fields) continue;
      out.push(section(group.title || 'Properties', group.fields.map((f) => field(p, f)), 'g:' + (group.key || group.title)));
    }
  }

  // Nesting / children controls for containers & frames
  if (def && (def.container || canHaveChildren(block))) {
    const kids = block.children || [];
    const nestBtns = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } });
    const addChild = h('button', { class: 'tb-btn', type: 'button' }, 'Add child frame');
    addChild.addEventListener('click', () => {
      ops.addBlock('frame', { parentId: block.id });
      emit('doc');
      emit('inspector:rerender');
    });
    nestBtns.appendChild(addChild);
    if (kids.length) {
      const selFirst = h('button', { class: 'tb-btn', type: 'button' }, 'Select first child');
      selFirst.addEventListener('click', () => {
        ops.select(kids[0].id);
        emit('selection');
      });
      nestBtns.appendChild(selFirst);
    }
    const tip = h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' } },
      'Tip: Alt+click a child to select its parent container. Drag children inside frames as one unit when the frame is selected.');
    out.push(section('Contents (' + kids.length + ')', [nestBtns, tip], 'nest'));
  }

  out.push(section('Auto-layout presets', autoLayoutPresets(block), 'autoLay'));

  out.push(section('Layout', [
    field(s, { k: 'display', l: 'Display', t: 'select', opts: DISPLAY }),
    field(s, { k: 'dir', l: 'Direction', t: 'seg', opts: FLEX_DIR }),
    field(s, { k: 'justify', l: 'Justify', t: 'seg', opts: JUSTIFY }),
    field(s, { k: 'align', l: 'Align', t: 'seg', opts: ALIGN }),
    field(s, { k: 'gap', l: 'Gap', t: 'number' }),
  ], 'layout'));

  out.push(section('Size', [
    pair([
      { k: 'w', l: 'Width', t: 'text' },
      { k: 'h', l: 'Height', t: 'text' },
    ], s),
    pair([
      { k: 'minW', l: 'Min width', t: 'text' },
      { k: 'maxW', l: 'Max width', t: 'text' },
    ], s),
    pair([
      { k: 'minH', l: 'Min height', t: 'text' },
      { k: 'maxH', l: 'Max height', t: 'text' },
    ], s),
    field(s, { k: 'grow', l: 'Flex grow', t: 'slider', min: 0, max: 8, step: 1 }),
  ], 'size'));

  out.push(section('Spacing', [
    h('div', { class: 'row-grid--3 row-grid' }, ['Top', 'Right', 'Bottom', 'Left'].map((side, i) => {
      const key = ['mT', 'mR', 'mB', 'mL'][i];
      return field(s, { k: key, l: side, t: 'number' });
    })),
    h('div', { class: 'row-grid--3 row-grid' }, ['Top', 'Right', 'Bottom', 'Left'].map((side, i) => {
      const key = ['pT', 'pR', 'pB', 'pL'][i];
      return field(s, { k: key, l: side, t: 'number' });
    })),
  ], 'spacing'));

  out.push(section('Background', [
    field(s, { k: 'bg', l: 'Colour', t: 'color' }),
    field(s, { k: 'bgImage', l: 'Gradient', t: 'select', opts: GRADIENTS }),
    field(s, { k: 'bgSize', l: 'Size', t: 'text' }),
    field(s, { k: 'bgPos', l: 'Position', t: 'text' }),
    field(s, { k: 'bgRepeat', l: 'Repeat', t: 'seg', opts: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] }),
  ], 'bg'));

  out.push(section('Border & shadow', [
    field(s, { k: 'borderW', l: 'Border width', t: 'number' }),
    field(s, { k: 'borderStyle', l: 'Border style', t: 'seg', opts: ['solid', 'dashed', 'dotted', 'none'] }),
    field(s, { k: 'borderColor', l: 'Border colour', t: 'color' }),
    field(s, { k: 'radius', l: 'Radius', t: 'number' }),
    field(s, { k: 'shadow', l: 'Shadow', t: 'select', opts: SHADOWS }),
  ], 'border'));

  const textLike = block.type !== 'image' && block.type !== 'video' && block.type !== 'divider';
  if (textLike) {
    out.push(section('Typography', [
      field(s, { k: 'fontFamily', l: 'Font', t: 'select', opts: FONTS }),
      h('div', { class: 'row-grid' }, [
        field(s, { k: 'fontSize', l: 'Size', t: 'number' }),
        field(s, { k: 'fontWeight', l: 'Weight', t: 'select', opts: FONT_WEIGHT }),
      ]),
      h('div', { class: 'row-grid' }, [
        field(s, { k: 'fontStyle', l: 'Style', t: 'select', opts: FONT_STYLE }),
        field(s, { k: 'textAlign', l: 'Align', t: 'seg', opts: TEXT_ALIGN }),
      ]),
      h('div', { class: 'row-grid' }, [
        field(s, { k: 'lineHeight', l: 'Line height', t: 'number' }),
        field(s, { k: 'letterSpacing', l: 'Letter spacing', t: 'number' }),
      ]),
      field(s, { k: 'color', l: 'Colour', t: 'color' }),
      field(s, { k: 'textAlign', l: 'Align', t: 'seg', opts: TEXT_ALIGN }),
      h('div', { class: 'row-grid' }, [
        field(s, { k: 'textCase', l: 'Case', t: 'select', opts: TEXT_CASE }),
        field(s, { k: 'decoration', l: 'Decoration', t: 'select', opts: DECOR }),
      ]),
    ], 'typo'));
  }

  if (def && (def.type === 'image')) {
    out.push(section('Media', [field(propTarget(block), { k: 'fit', l: 'Object fit', t: 'select', opts: OBJECT_FIT })], 'media'));
  }

  out.push(section('Effects', [
    field(s, { k: 'opacity', l: 'Opacity', t: 'slider', min: 0, max: 1, step: 0.01 }),
    field(s, { k: 'blend', l: 'Blend mode', t: 'select', opts: BLEND }),
    field(s, { k: 'filter', l: 'Filter', t: 'select', opts: FILTERS }),
    field(s, { k: 'backdropFilter', l: 'Backdrop blur', t: 'select', opts: FILTERS }),
    field(s, { k: 'transform', l: 'Transform', t: 'text' }),
    field(s, { k: 'transformOrigin', l: 'Transform origin', t: 'text' }),
    field(s, { k: 'overflow', l: 'Overflow', t: 'seg', opts: ['visible', 'hidden', 'auto'] }),
  ], 'fx'));

  if (free) {
    out.push(section('Position (free mode)', [
      pair([{ k: 'x', l: 'X', t: 'number' }, { k: 'y', l: 'Y', t: 'number' }], s),
    ], 'pos'));
  }

  return out;
}


function quickStyleBtn(block, label, patch) {
  const b = h('button', { class: 'tb-btn', type: 'button' }, label);
  b.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const host = document.getElementById('inspector');
    const body = host && host.querySelector('.insp-body');
    const scrollTop = body ? body.scrollTop : 0;
    // Persist via ops so undo/history + canvas repaint stay in sync
    const stylePatch = Object.assign({}, patch);
    if (stylePatch.decoration != null) stylePatch.textDecor = stylePatch.decoration;
    if (stylePatch.textDecor != null && stylePatch.decoration == null) stylePatch.decoration = stylePatch.textDecor;
    block.style = Object.assign({}, block.style || {}, stylePatch);
    for (const key of Object.keys(stylePatch)) {
      try { ops.setStyleProp(block.id, key, stylePatch[key]); } catch (e) { void e; }
    }
    emit('doc');
    emit('inspector:rerender');
    requestAnimationFrame(() => {
      const nb = document.getElementById('inspector') && document.getElementById('inspector').querySelector('.insp-body');
      if (nb) nb.scrollTop = scrollTop;
    });
  });
  return b;
}

function deviceFontsBtn() {
  const b = h('button', { class: 'tb-btn', type: 'button', style: { width: '100%', marginTop: '6px' } }, 'Load fonts from this device');
  b.addEventListener('click', async () => {
    try {
      const list = await loadDeviceFonts();
      // Mutate FONTS array in place so selects pick up new options after rerender
      FONTS.length = 0;
      for (const f of list) FONTS.push(f);
      emit('inspector:rerender');
    } catch (e) {
      console.warn(e);
    }
  });
  return b;
}

function contentTab(block) {
  const p = propTarget(block);
  const out = [];
  const def = getDef(block.type);

  out.push(section('Element', [
    field(rootTarget(block), { k: 'name', l: 'Layer name', t: 'text' }),
    field(p, { k: 'text', l: 'Text / label', t: 'text' }),
    field(p, { k: 'href', l: 'Link URL', t: 'text' }),
    field(p, { k: 'target', l: 'Link target', t: 'select', opts: ['_self', '_blank', '_parent'] }),
    field(p, { k: 'placeholder', l: 'Placeholder', t: 'text' }),
    field(p, { k: 'value', l: 'Value', t: 'text' }),
    field(p, { k: 'alt', l: 'Image alt text', t: 'text' }),
    field(p, { k: 'src', l: 'Media / model source', t: 'text' }),
  ], 'elem'));

  const s = styleTarget(block);
  out.push(section('Typography', [
    field(s, { k: 'fontFamily', l: 'Font family', t: 'select', opts: FONTS }),
    h('div', { class: 'row-grid' }, [
      field(s, { k: 'fontSize', l: 'Size (px)', t: 'number' }),
      field(s, { k: 'fontWeight', l: 'Weight', t: 'select', opts: FONT_WEIGHT }),
    ]),
    h('div', { class: 'row-grid' }, [
      field(s, { k: 'fontStyle', l: 'Style', t: 'select', opts: FONT_STYLE }),
      field(s, { k: 'textAlign', l: 'Align', t: 'seg', opts: TEXT_ALIGN }),
    ]),
    h('div', { class: 'row-grid' }, [
      field(s, { k: 'lineHeight', l: 'Line height', t: 'number' }),
      field(s, { k: 'letterSpacing', l: 'Letter spacing', t: 'number' }),
    ]),
    field(s, { k: 'textCase', l: 'Case', t: 'select', opts: TEXT_CASE }),
    field(s, { k: 'decoration', l: 'Decoration', t: 'select', opts: DECOR }),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' } }, [
      quickStyleBtn(block, 'Bold', { fontWeight: '700' }),
      quickStyleBtn(block, 'Italic', { fontStyle: 'italic' }),
      quickStyleBtn(block, 'Underline', { decoration: 'underline' }),
      quickStyleBtn(block, 'Regular', { fontWeight: '400', fontStyle: 'normal', decoration: 'none' }),
    ]),
    deviceFontsBtn(),
  ], 'typo'));

  const schemaFields = (def && def.fields) || [];
  if (schemaFields.length) {
    out.push(section((def.label || block.type) + ' properties', schemaFields.map((f) => field(p, f)), 'schema'));
  }

  if (def && def.groups) {
    for (const group of def.groups) {
      if (!group || !group.fields) continue;
      out.push(section(group.title || 'More', group.fields.map((f) => field(p, f)), 'cg:' + (group.key || group.title)));
    }
  }

  out.push(section('Visibility', [
    field(rootTarget(block), { k: 'hidden', l: 'Hidden', t: 'check' }),
    field(rootTarget(block), { k: 'locked', l: 'Locked', t: 'check' }),
  ], 'vis'));

  // Component instance controls
  const isInst = !!(block.props && block.props.__instance && block.props.__componentId);
  const master = isInst ? components.getComponent(block.props.__componentId) : null;
  if (isInst) {
    const row = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    row.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--text-2)' } },
      'Instance of «' + ((master && master.name) || 'Component') + '»'));
    const sync = h('button', { class: 'tb-btn', type: 'button' }, 'Sync from master');
    sync.addEventListener('click', () => {
      components.syncInstances(block.props.__componentId);
      emit('doc');
      emit('inspector:rerender');
    });
    const det = h('button', { class: 'tb-btn', type: 'button' }, 'Detach instance');
    det.addEventListener('click', () => {
      components.detachInstance(block);
      emit('inspector:rerender');
    });
    row.appendChild(sync);
    row.appendChild(det);
    out.push(section('Component', [row], 'cmp'));
  } else {
    const make = h('button', { class: 'tb-btn tb-btn--primary', type: 'button', style: { width: '100%' } }, 'Create component from this');
    make.addEventListener('click', () => {
      const name = window.prompt('Component name', block.name || block.type || 'Component');
      if (name == null) return;
      components.createFromSelection(block, name.trim() || 'Component');
      emit('inspector:rerender');
    });
    out.push(section('Component', [make,
      h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } }, 'Reusable across the project. Edit one instance + Sync to update all.')
    ], 'cmp'));
  }

  // CMS / data binding
  out.push(section('CMS / Data binding', [
    field(p, { k: 'cmsCollection', l: 'Collection name', t: 'text' }),
    field(p, { k: 'cmsField', l: 'Field key', t: 'text' }),
    field(p, { k: 'cmsFallback', l: 'Fallback text', t: 'text' }),
    h('div', { style: { fontSize: '11px', color: 'var(--text-3)', lineHeight: '1.4' } },
      'Bind this element to a CMS field (e.g. posts.title). Preview via Studio → CMS. Export keeps data attributes for your headless CMS.'),
  ], 'cms'));

  return out;
}

function motionTab(block) {
  const s = styleTarget(block);
  const hv = hoverTarget(block);
  const playBtn = h('button', { class: 'tb-btn tb-btn--primary', type: 'button', style: { width: '100%', marginTop: '6px' } }, '▶ Test animation');
  playBtn.addEventListener('click', () => {
    const el = document.querySelector('[data-id="' + block.id + '"]');
    if (!el) return;
    const st = block.style || {};
    const name = st.anim && st.anim !== 'none' ? 'vb-' + st.anim : 'vb-fade-up';
    const dur = (st.animDur == null ? 0.6 : Number(st.animDur)) + 's';
    const ease = st.animEase || 'cubic-bezier(.22,1,.36,1)';
    // Force restart
    el.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.style.animation = name + ' ' + dur + ' ' + ease + ' 0s 1 both';
    const done = () => {
      el.style.animation = '';
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
  });
  return [
    section('Entrance animation', [
      field(s, { k: 'anim', l: 'Animation', t: 'select', opts: ANIMATIONS }),
      h('div', { class: 'row-grid' }, [
        field(s, { k: 'animDur', l: 'Duration (s)', t: 'number' }),
        field(s, { k: 'animDelay', l: 'Delay (s)', t: 'number' }),
      ]),
      field(s, { k: 'animEase', l: 'Easing', t: 'select', opts: EASES }),
      h('div', { class: 'row-grid' }, [
        field(s, { k: 'animIter', l: 'Repeat', t: 'select', opts: ['1', '2', '3', 'infinite'] }),
        field(s, { k: 'animFill', l: 'Fill', t: 'select', opts: ['both', 'none', 'forwards', 'backwards'] }),
      ]),
      playBtn,
    ], 'anim'),

    section('Hover state', [
      field(hv, { k: 'bg', l: 'Background', t: 'color' }),
      field(hv, { k: 'color', l: 'Text colour', t: 'color' }),
      field(hv, { k: 'transform', l: 'Transform', t: 'text' }),
      field(hv, { k: 'shadow', l: 'Shadow', t: 'select', opts: SHADOWS }),
      field(hv, { k: 'opacity', l: 'Opacity', t: 'slider', min: 0, max: 1, step: 0.01 }),
      field(hv, { k: 'scale', l: 'Scale', t: 'number' }),
    ], 'hover'),

    section('Transition', [
      field(s, { k: 'transition', l: 'CSS transition', t: 'text' }),
      field(s, { k: 'transform', l: 'Transform', t: 'text' }),
      field(s, { k: 'opacity', l: 'Opacity', t: 'slider', min: 0, max: 1, step: 0.01 }),
    ], 'trans'),

    section('3D / continuous spin (if supported)', [
      field(propTarget(block), { k: 'spin', l: 'Auto spin', t: 'check' }),
      field(propTarget(block), { k: 'spinSpeed', l: 'Spin speed', t: 'number' }),
      field(propTarget(block), { k: 'autoRotate', l: 'Orbit auto-rotate', t: 'check' }),
    ], 'spin3d'),

    section('Variant presets', variantPresets(block), 'variants'),
  ];
}

function variantPresets(block) {
  const presets = [
    { name: 'Lift on hover', hover: { transform: 'translateY(-4px)', shadow: 'lg' } },
    { name: 'Scale on hover', hover: { transform: 'scale(1.03)' } },
    { name: 'Glow on hover', hover: { shadow: 'glow', opacity: 1 } },
    { name: 'Fade in up', style: { anim: 'fade-up', animDur: 0.7 } },
    { name: 'Soft press', hover: { transform: 'scale(0.98)' } },
  ];
  const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
  for (const preset of presets) {
    const b = h('button', { class: 'tb-btn', type: 'button', style: { width: '100%', textAlign: 'left' } }, preset.name);
    b.addEventListener('click', () => {
      if (preset.hover) {
        block.states = block.states || {};
        block.states.hover = Object.assign({}, block.states.hover || {}, preset.hover);
      }
      if (preset.style) {
        block.style = Object.assign({}, block.style || {}, preset.style);
      }
      ops.setProp(block.id, 'states', block.states);
      emit('doc');
      emit('inspector:rerender');
    });
    wrap.appendChild(b);
  }
  wrap.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-3)' } },
    'One-click hover / entrance presets. Fine-tune above after applying.'));
  return [wrap];
}

function eventsTab(block) {
  block.events = Array.isArray(block.events) ? block.events : [];
  const out = [];
  const listHost = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });

  const paintList = () => {
    clear(listHost);
    if (!block.events.length) {
      listHost.appendChild(h('div', { style: { fontSize: '12px', color: 'var(--text-3)' } },
        'No interactions yet. Add events so this element reacts to clicks, hover, scroll, and more — exported sites run them too.'));
      return;
    }
    block.events.forEach((ev, index) => {
      const card = h('div', { class: 'sec', style: { padding: '8px', border: '1px solid var(--line)', borderRadius: '8px' } });
      const trig = h('select');
      EVENT_TRIGGERS.forEach((t) => {
        const o = h('option', { value: t.v }, t.l);
        if (ev.trigger === t.v) o.selected = true;
        trig.appendChild(o);
      });
      const act = h('select');
      EVENT_ACTIONS.forEach((t) => {
        const o = h('option', { value: t.v }, t.l);
        if (ev.action === t.v) o.selected = true;
        act.appendChild(o);
      });
      const val = h('input', { type: 'text', value: ev.value || '', placeholder: 'URL, page id, selector, text, class, or JS…' });
      val.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;border:1px solid var(--line);background:var(--input);color:var(--text)';
      trig.style.cssText = val.style.cssText;
      act.style.cssText = val.style.cssText;

      const save = () => {
        const next = block.events.slice();
        next[index] = { trigger: trig.value, action: act.value, value: val.value };
        ops.setProp(block.id, 'events', next);
        emit('inspector:rerender');
      };
      trig.addEventListener('change', save);
      act.addEventListener('change', save);
      val.addEventListener('change', save);

      const del = h('button', { class: 'tb-btn', type: 'button' }, 'Remove');
      del.addEventListener('click', () => {
        const next = block.events.slice();
        next.splice(index, 1);
        ops.setProp(block.id, 'events', next);
        emit('inspector:rerender');
      });

      card.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' } }, 'Event #' + (index + 1)));
      card.appendChild(h('div', { class: 'row__label' }, 'When'));
      card.appendChild(trig);
      card.appendChild(h('div', { class: 'row__label' }, 'Do'));
      card.appendChild(act);
      card.appendChild(h('div', { class: 'row__label' }, 'Value'));
      card.appendChild(val);
      card.appendChild(h('div', { style: { marginTop: '6px' } }, del));
      listHost.appendChild(card);
    });
  };

  paintList();

  const addBtn = h('button', { class: 'tb-btn tb-btn--primary', type: 'button', style: { width: '100%' } }, '+ Add interaction');
  addBtn.addEventListener('click', () => {
    const next = (block.events || []).concat([{ trigger: 'click', action: 'navigate', value: 'https://' }]);
    ops.setProp(block.id, 'events', next);
    emit('inspector:rerender');
  });

  const tip = h('div', { style: { fontSize: '11px', color: 'var(--text-3)', lineHeight: '1.45' } },
    'Examples: Click → Open URL → https://… · Click → Go to page → page2 · Click → Toggle visibility → other-block-id · Scroll into view → Play animation → fade-up');

  out.push(section('Interactions', [listHost, addBtn, tip], 'evlist'));

  out.push(section('Quick actions', [
    field(propTarget(block), { k: 'href', l: 'Default link (href)', t: 'text' }),
    field(propTarget(block), { k: 'onclick', l: 'Inline onclick (advanced)', t: 'text' }),
  ], 'qev'));

  return out;
}

function advancedTab(block) {
  const a = a11yTarget(block);
  const doc = currentDoc();
  const out = [];

  out.push(section('Accessibility', [
    field(a, { k: 'label', l: 'ARIA label', t: 'text' }),
    field(a, { k: 'role', l: 'Role', t: 'text' }),
    h('div', { class: 'row-grid' }, [
      field(a, { k: 'tabIndex', l: 'Tab index', t: 'number' }),
      field(a, { k: 'id', l: 'HTML id', t: 'text' }),
    ]),
  ], 'a11y'));

  out.push(stateSection(block));
  out.push(responsiveSection(block));

  out.push(section('Nesting', [
    h('div', { class: 'pickrow' }, [
      h('button', { class: 'pick', type: 'button', disabled: !isContainer(block.type) }, isContainer(block.type) ? 'Accepts children' : 'Leaf element'),
      h('button', {
        class: 'pick',
        type: 'button',
        disabled: !find(doc, block.id) || !ancestors(doc, block.id).length,
      }, 'Move to page root'),
    ]),
  ], 'nest'));

  out.push(section('Custom CSS', [
    field(propTarget(block), { k: '_css', l: 'Extra CSS for this block', t: 'textarea', rows: 4 }),
  ], 'css'));

  out.push(section('Reset', [
    h('button', { class: 'pick', type: 'button' }, "Clear this block's overrides"),
  ], 'reset'));

  return out;
}

const STATE_NAMES = [
  { key: 'hover', label: 'Hover' },
  { key: 'focus', label: 'Focus' },
  { key: 'active', label: 'Active' },
  { key: 'visited', label: 'Visited' },
  { key: 'disabled', label: 'Disabled' },
];

function stateSection(block) {
  const block2 = block;
  block2.states = block2.states || {};
  let active = block2.__activeState;
  if (!active || !STATE_NAMES.some((s) => s.key === active)) active = 'hover';

  const picker = h('div', { class: 'seg-full' });
  const holder = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

  const paint = () => {
    picker.innerHTML = '';
    holder.innerHTML = '';
    for (const s of STATE_NAMES) {
      const b = h('button', { type: 'button', class: active === s.key ? 'is-on' : '' }, s.label);
      b.addEventListener('click', () => {
        active = s.key;
        block2.__activeState = active;
        paint();
      });
      picker.appendChild(b);
    }
    const target = { id: block2.id, kind: 'state', state: active, read: (k) => ((block2.states || {})[active] || {})[k] };
    holder.appendChild(field(target, { k: 'bg', l: 'Background', t: 'color' }));
    holder.appendChild(field(target, { k: 'color', l: 'Text colour', t: 'color' }));
    holder.appendChild(field(target, { k: 'shadow', l: 'Shadow', t: 'select', opts: SHADOWS }));
    holder.appendChild(field(target, { k: 'transform', l: 'Transform', t: 'text' }));
    holder.appendChild(field(target, { k: 'opacity', l: 'Opacity', t: 'slider', min: 0, max: 1, step: 0.01 }));
    holder.appendChild(field(target, { k: 'borderColor', l: 'Border colour', t: 'color' }));
    holder.appendChild(field(target, { k: 'radius', l: 'Radius', t: 'number' }));
    holder.appendChild(field(target, { k: 'filter', l: 'Filter', t: 'select', opts: FILTERS }));
    const clear = h('button', { class: 'pick', type: 'button' }, 'Clear ' + active + ' state');
    clear.addEventListener('click', () => {
      block2.states[active] = {};
      emit('doc');
    });
    holder.appendChild(clear);
  };
  paint();

  return section('Interaction states', [picker, holder], 'states');
}

const BP_TABS = [
  { key: 'tablet', label: 'Tablet' },
  { key: 'mobile', label: 'Mobile' },
];

function responsiveSection(block) {
  block.responsive = block.responsive || {};
  let bp = block.__activeBp;
  if (!bp || !BP_TABS.some((b) => b.key === bp)) bp = 'tablet';

  const picker = h('div', { class: 'seg-full' });
  const holder = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

  const paint = () => {
    picker.innerHTML = '';
    holder.innerHTML = '';
    for (const item of BP_TABS) {
      const b = h('button', { type: 'button', class: bp === item.key ? 'is-on' : '' }, item.label);
      b.addEventListener('click', () => {
        bp = item.key;
        block.__activeBp = bp;
        paint();
      });
      picker.appendChild(b);
    }
    const target = {
      id: block.id,
      kind: 'responsive',
      bp,
      read: (k) => ((block.responsive || {})[bp] || {})[k],
    };
    holder.appendChild(h('p', { class: 'row__label', style: { color: 'var(--text-3)' } },
      bp === 'tablet' ? 'Applies below 834px' : 'Applies below 390px'));
    holder.appendChild(field(target, { k: 'hidden', l: 'Hide at this size', t: 'check' }));
    holder.appendChild(h('div', { class: 'row-grid' }, [
      field(target, { k: 'fontSize', l: 'Font size', t: 'number' }),
      field(target, { k: 'w', l: 'Width', t: 'text' }),
      field(target, { k: 'gap', l: 'Gap', t: 'number' }),
      field(target, { k: 'dir', l: 'Direction', t: 'select', opts: ['column', 'row', 'row-reverse'] }),
      field(target, { k: 'pT', l: 'Pad top', t: 'number' }),
      field(target, { k: 'pL', l: 'Pad left', t: 'number' }),
      field(target, { k: 'cols', l: 'Grid columns', t: 'text' }),
      field(target, { k: 'textAlign', l: 'Text align', t: 'select', opts: ['left', 'center', 'right'] }),
    ]));
    const clear = h('button', { class: 'pick', type: 'button' }, 'Clear ' + bp + ' overrides');
    clear.addEventListener('click', () => {
      block.responsive[bp] = {};
      emit('doc');
    });
    holder.appendChild(clear);
  };
  paint();

  return section('Responsive', [picker, holder], 'responsive');
}

function headFor(block) {
  const def = getDef(block.type);
  const doc = currentDoc();
  const chain = ancestors(doc, block.id);
  const path = chain.map((b) => (b.name || (getDef(b.type) || {}).label || b.type)).join(' / ');
  return h('div', { class: 'insp-head' }, [
    h('span', { class: 'insp-head__ico' }, iconNode(def)),
    h('span', { class: 'insp-head__meta' }, [
      h('div', { class: 'insp-head__type' }, (def && def.label) || block.type),
      h('div', { class: 'insp-head__path' }, path || 'Page root'),
    ]),
  ]);
}

function iconNode(def) {
  const span = h('span', { class: 'ic' });
  span.style.backgroundImage = 'url("IMAGES/' + iconFor(def ? def.type : 'shapes', def) + '")';
  return span;
}

let lastSelectionKey = '';
let preservedScroll = 0;

export function render() {
  const host = $('inspector');
  if (!host) return;

  const ids = Array.from(state.selection);
  const selectionKey = ids.join(',') + '|' + (state.ui.tab || 'design');
  const selectionChanged = selectionKey !== lastSelectionKey;
  const prevBody = host.querySelector('.insp-body');
  if (!selectionChanged && prevBody) preservedScroll = prevBody.scrollTop;
  lastSelectionKey = selectionKey;

  clear(host);

  const tabs = h('div', { class: 'insp-tabs' });
  for (const t of TABS) {
    const b = h('button', { class: 'insp-tab' + (state.ui.tab === t.id ? ' is-on' : ''), type: 'button' }, t.label);
    b.addEventListener('click', () => {
      state.ui.tab = t.id;
      emit('inspector:rerender');
    });
    tabs.appendChild(b);
  }
  host.appendChild(tabs);

  // Properties body scrolls independently; layers sit in a fixed bottom pane
  const body = h('div', { class: 'insp-body' });
  const layersPane = h('div', { class: 'insp-layers-pane' });

  if (!ids.length) {
    body.appendChild(h('div', { class: 'insp-empty' }, [
      h('div', { style: { fontSize: '30px', opacity: '.35' } }, '◧'),
      h('div', { style: { fontWeight: '700', color: 'var(--text-2)' } }, 'Nothing selected'),
      h('div', { class: 'insp-empty__hint' }, 'Click any element on the canvas, or drag a block from the left panel. Hold Shift to select more.'),
    ]));
  } else {
    const doc = currentDoc();
    const blocks = ids.map((id) => find(doc, id)).filter(Boolean);
    if (blocks.length > 1) {
      body.appendChild(h('div', { class: 'insp-head' }, [
        h('span', { class: 'insp-head__ico' }, '⧉'),
        h('span', { class: 'insp-head__meta' }, [
          h('div', { class: 'insp-head__type' }, blocks.length + ' elements selected'),
        ]),
      ]));
      body.appendChild(section('Align', [
        h('div', { class: 'pickrow' }, ['left', 'center-x', 'right', 'top', 'center-y', 'bottom'].map((mode) => {
          const b = h('button', { class: 'pick', type: 'button' }, mode.replace('center-', ''));
          b.addEventListener('click', () => {
            ops.align(ids, mode);
            emit('doc');
          });
          return b;
        })),
        h('div', { class: 'pickrow' }, [
          h('button', { class: 'pick', type: 'button' }, 'Distribute H'),
          h('button', { class: 'pick', type: 'button' }, 'Distribute V'),
        ]),
      ], 'align'));
    } else if (blocks[0]) {
      const block = blocks[0];
      body.appendChild(headFor(block));
      if (state.ui.tab === 'design') body.appendChild(h('div', {}, designTab(block)));
      else if (state.ui.tab === 'content') body.appendChild(h('div', {}, contentTab(block)));
      else if (state.ui.tab === 'motion') body.appendChild(h('div', {}, motionTab(block)));
      else if (state.ui.tab === 'events') body.appendChild(h('div', {}, eventsTab(block)));
      else body.appendChild(h('div', {}, advancedTab(block)));
    }
  }

  host.appendChild(body);
  layersPane.appendChild(h('div', { class: 'insp-head insp-head--layers' }, [
    h('span', { class: 'insp-head__meta' }, h('div', { class: 'insp-head__type' }, 'Layers & project')),
  ]));
  const layersHost = h('div', { class: 'layers' });
  layersPane.appendChild(layersHost);
  host.appendChild(layersPane);
  renderLayers(layersHost);

  // Restore scroll only when editing the same selection; reset on new selection
  requestAnimationFrame(() => {
    const nb = host.querySelector('.insp-body');
    if (!nb) return;
    nb.scrollTop = selectionChanged ? 0 : preservedScroll;
  });
}

export function init() {
  render();
  on('selection', render);
  on('inspector:rerender', render);
  on('doc', () => render());
}
