/*
 * COMPONENT ACTIONS
 * =================
 * What a particular component can do that a plain block cannot.
 *
 * The context bar under the selected element used to be entirely generic
 * (rename, colour, duplicate, z-order, typography). The legacy builder had a
 * per-type section there - a table offered "+Row / +Col / -Row / -Col", tabs
 * offered "+Tab / -Tab", a stepper offered "Next / Prev" - and that is what
 * was missing.
 *
 * Each action is:
 *   { id, label, title, icon, run(block) }
 * `run` receives the selected block and mutates it through the model API, so
 * the change is undoable and the canvas repaints.
 */

import * as ops from './ops.js';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Read a separator-joined string prop as an array. */
function readCsv(block, key, sep) {
  const raw = block && block.props ? block.props[key] : '';
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  const s = String(raw);
  if (!s.trim()) return [];
  return s.split(sep || ',').map((x) => x.trim()).filter((x) => x !== '');
}

function writeCsv(block, key, arr, sep) {
  ops.setProp(block.id, key, arr.join(sep || ','));
}

/** Read a newline-joined string prop as an array of lines. */
function readLines(block, key) {
  const raw = block && block.props ? block.props[key] : '';
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  const s = String(raw);
  if (!s.trim()) return [];
  return s.split('\n').map((x) => x.trim()).filter((x) => x !== '');
}

function writeLines(block, key, arr) {
  ops.setProp(block.id, key, arr.join('\n'));
}

/** Read/write an array prop. */
function readArr(block, key) {
  const raw = block && block.props ? block.props[key] : [];
  return Array.isArray(raw) ? raw.slice() : [];
}

function writeArr(block, key, arr) {
  ops.setProp(block.id, key, arr);
}

/**
 * Build a "+ item / - item" pair for a collection prop.
 * @param {object} cfg { key, sep, lines, item, short, blank }
 */
function collectionActions(cfg) {
  const read = cfg.lines ? (b) => readLines(b, cfg.key) : (b) => readCsv(b, cfg.key, cfg.sep);
  const write = cfg.lines ? (b, a) => writeLines(b, cfg.key, a) : (b, a) => writeCsv(b, cfg.key, a, cfg.sep);
  const item = cfg.item || 'item';
  return [
    {
      id: 'add-' + cfg.key,
      label: '+' + (cfg.short || item),
      title: 'Add ' + item,
      icon: 'plus',
      run(block) {
        const arr = read(block);
        arr.push(cfg.blank != null ? cfg.blank : '');
        write(block, arr);
      },
    },
    {
      id: 'del-' + cfg.key,
      label: '-' + (cfg.short || item),
      title: 'Remove the last ' + item,
      icon: 'close',
      run(block) {
        const arr = read(block);
        if (!arr.length) return;
        arr.pop();
        write(block, arr);
      },
    },
  ];
}

/* ------------------------------------------------------------------ *
 * The table: rows and columns
 * ------------------------------------------------------------------ */

function tableHead(block) {
  const raw = block && block.props ? block.props.head : '';
  const s = raw == null ? '' : String(raw);
  return s.trim() ? s.split(',').map((x) => x.trim()) : [];
}

function tableRows(block) {
  const raw = block && block.props ? block.props.rows : '';
  const s = raw == null ? '' : String(raw);
  return s.trim()
    ? s.split('\n').map((r) => r.trim()).filter(Boolean).map((r) => r.split(',').map((c) => c.trim()))
    : [];
}

function writeTableHead(block, arr) {
  ops.setProp(block.id, 'head', arr.join(','));
}

function writeTableRows(block, arr) {
  ops.setProp(block.id, 'rows', arr.map((r) => r.join(',')).join('\n'));
}

const TABLE_ACTIONS = [
  {
    id: 'table-row-add',
    label: '+Row',
    title: 'Add a row',
    icon: 'plus',
    run(block) {
      const rows = tableRows(block);
      const cols = Math.max(tableHead(block).length, 1);
      const blank = [];
      for (let c = 0; c < cols; c += 1) blank.push('');
      rows.push(blank);
      writeTableRows(block, rows);
    },
  },
  {
    id: 'table-row-del',
    label: '-Row',
    title: 'Remove the last row',
    icon: 'close',
    run(block) {
      const rows = tableRows(block);
      if (!rows.length) return;
      rows.pop();
      writeTableRows(block, rows);
    },
  },
  {
    id: 'table-col-add',
    label: '+Col',
    title: 'Add a column',
    icon: 'plus',
    run(block) {
      const head = tableHead(block);
      const rows = tableRows(block);
      const cols = Math.max(head.length, rows.reduce((m, r) => Math.max(m, r.length), 0), 1);
      while (head.length < cols) head.push('');
      head.push('Column ' + (head.length + 1));
      writeTableHead(block, head);
      rows.forEach((r) => { r.push(''); });
      writeTableRows(block, rows);
    },
  },
  {
    id: 'table-col-del',
    label: '-Col',
    title: 'Remove the last column',
    icon: 'close',
    run(block) {
      const head = tableHead(block);
      if (head.length <= 1) return;
      head.pop();
      writeTableHead(block, head);
      const rows = tableRows(block);
      rows.forEach((r) => { r.pop(); });
      writeTableRows(block, rows);
    },
  },
];

/* ------------------------------------------------------------------ *
 * The registry
 * ------------------------------------------------------------------ */

export const COMP_ACTIONS = {
  table: TABLE_ACTIONS,

  tabs: collectionActions({ key: 'items', short: 'Tab', item: 'tab' }),
  accordion: collectionActions({ key: 'items', short: 'Item', item: 'item', lines: true }),
  breadcrumb: collectionActions({ key: 'items', short: 'Crumb', item: 'crumb' }),
  stepper: collectionActions({ key: 'steps', short: 'Step', item: 'step' }),
  select: collectionActions({ key: 'options', short: 'Option', item: 'option' }),
  buttonGroup: collectionActions({ key: 'labels', short: 'Btn', item: 'button' }),
  logoCloud: collectionActions({ key: 'names', short: 'Brand', item: 'brand' }),
  logoCloudSection: collectionActions({ key: 'names', short: 'Brand', item: 'brand' }),
  chart: collectionActions({ key: 'series', short: 'Value', item: 'value' }),
  donut: collectionActions({ key: 'parts', short: 'Part', item: 'part' }),
  sparkline: collectionActions({ key: 'series', short: 'Value', item: 'value' }),
  pricingCard: collectionActions({ key: 'features', short: 'Feature', item: 'feature', lines: true }),
  faqSection: collectionActions({ key: 'items', short: 'Item', item: 'item', lines: true }),
  sidebar: collectionActions({ key: 'items', short: 'Item', item: 'item', lines: true }),

  list: [
    {
      id: 'list-add',
      label: '+Item',
      title: 'Add a list item',
      icon: 'plus',
      run(block) {
        const arr = readArr(block, 'items');
        arr.push('New item');
        writeArr(block, 'items', arr);
      },
    },
    {
      id: 'list-del',
      label: '-Item',
      title: 'Remove the last list item',
      icon: 'close',
      run(block) {
        const arr = readArr(block, 'items');
        if (!arr.length) return;
        arr.pop();
        writeArr(block, 'items', arr);
      },
    },
  ],

  gallery: [
    {
      id: 'gallery-more',
      label: '+Image',
      title: 'Add an image',
      icon: 'plus',
      run(block) {
        const n = Math.max(1, Math.min(24, (Number(block.props.count) || 6) + 1));
        ops.setProp(block.id, 'count', n);
      },
    },
    {
      id: 'gallery-less',
      label: '-Image',
      title: 'Remove an image',
      icon: 'close',
      run(block) {
        const n = Math.max(1, (Number(block.props.count) || 6) - 1);
        ops.setProp(block.id, 'count', n);
      },
    },
  ],

  columns: [
    {
      id: 'columns-more',
      label: '+Col',
      title: 'Add a column',
      icon: 'plus',
      run(block) {
        const n = Math.max(1, Math.min(12, (Number(block.props.count) || 3) + 1));
        ops.setProp(block.id, 'count', n);
        ops.setStyleProp(block.id, 'cols', 'repeat(' + n + ', 1fr)');
      },
    },
    {
      id: 'columns-less',
      label: '-Col',
      title: 'Remove a column',
      icon: 'close',
      run(block) {
        const n = Math.max(1, (Number(block.props.count) || 3) - 1);
        ops.setProp(block.id, 'count', n);
        ops.setStyleProp(block.id, 'cols', 'repeat(' + n + ', 1fr)');
      },
    },
  ],

  pagination: [
    {
      id: 'page-next',
      label: 'Next',
      title: 'Go to the next page',
      icon: 'arrow',
      run(block) {
        const total = Math.max(1, Number(block.props.total) || 5);
        const cur = Math.min(total, (Number(block.props.current) || 1) + 1);
        ops.setProp(block.id, 'current', cur);
      },
    },
    {
      id: 'page-prev',
      label: 'Prev',
      title: 'Go to the previous page',
      icon: 'arrow',
      run(block) {
        const cur = Math.max(1, (Number(block.props.current) || 1) - 1);
        ops.setProp(block.id, 'current', cur);
      },
    },
  ],

  stepper: [
    {
      id: 'step-next',
      label: 'Next',
      title: 'Go to the next step',
      icon: 'arrow',
      run(block) {
        const total = Math.max(1, readCsv(block, 'steps').length);
        const cur = Math.min(total, (Number(block.props.current) || 1) + 1);
        ops.setProp(block.id, 'current', cur);
      },
    },
    {
      id: 'step-prev',
      label: 'Prev',
      title: 'Go to the previous step',
      icon: 'arrow',
      run(block) {
        const cur = Math.max(1, (Number(block.props.current) || 1) - 1);
        ops.setProp(block.id, 'current', cur);
      },
    },
  ],

  progress: [
    {
      id: 'progress-up',
      label: '+10%',
      title: 'Increase the value',
      icon: 'plus',
      run(block) {
        const max = Number(block.props.max) || 100;
        const v = Math.min(max, (Number(block.props.value) || 0) + Math.round(max * 0.1));
        ops.setProp(block.id, 'value', v);
      },
    },
    {
      id: 'progress-down',
      label: '-10%',
      title: 'Decrease the value',
      icon: 'close',
      run(block) {
        const max = Number(block.props.max) || 100;
        const v = Math.max(0, (Number(block.props.value) || 0) - Math.round(max * 0.1));
        ops.setProp(block.id, 'value', v);
      },
    },
  ],

  counter: [
    {
      id: 'counter-up',
      label: '+1',
      title: 'Add one to the counter',
      icon: 'plus',
      run(block) {
        ops.setProp(block.id, 'value', (Number(block.props.value) || 0) + 1);
      },
    },
    {
      id: 'counter-down',
      label: '-1',
      title: 'Take one off the counter',
      icon: 'close',
      run(block) {
        ops.setProp(block.id, 'value', Math.max(0, (Number(block.props.value) || 0) - 1));
      },
    },
  ],

  rating: [
    {
      id: 'rating-up',
      label: '+',
      title: 'Raise the rating',
      icon: 'star',
      run(block) {
        const max = Number(block.props.max) || 5;
        ops.setProp(block.id, 'value', Math.min(max, (Number(block.props.value) || 0) + 1));
      },
    },
    {
      id: 'rating-down',
      label: '-',
      title: 'Lower the rating',
      icon: 'star',
      run(block) {
        ops.setProp(block.id, 'value', Math.max(0, (Number(block.props.value) || 0) - 1));
      },
    },
  ],
};

/** The actions a given block type offers. */
export function actionsFor(type) {
  return COMP_ACTIONS[type] || null;
}
