import * as ops from '../model/ops.js';
import { h } from '../core/dom.js';
import { state } from '../core/store.js';
import { emit } from '../core/bus.js';

export const SWATCHES = [
  '#000000', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#4f46e5', '#4338ca', '#312e81', '#7c3aed', '#6d28d9', '#be185d', '#9d174d', '#a16207',
];

export function iconName() {
  const names = ['spark', 'bolt', 'shield', 'star', 'heart', 'check', 'arrow', 'globe', 'clock',
    'layers', 'chat', 'user', 'users', 'mail', 'phone', 'pin', 'lock', 'chart', 'menu', 'close',
    'plus', 'play', 'search'];
  const box = h('div', { class: 'swatches' });
  for (const n of names) {
    const b = h('button', { class: 'pick', type: 'button', title: n, style: { minWidth: '34px' } }, n);
    b.addEventListener('click', () => emit('field:icon', n));
    box.appendChild(b);
  }
  return box;
}

function commit(target, key, value, live) {
  if (!target) return;
  if (target.kind === 'style') ops.setStyleProp(target.id, key, value);
  else if (target.kind === 'root') ops.setProp(target.id, key, value);
  else if (target.kind === 'props') ops.setProp(target.id, key, value);
  else if (target.kind === 'a11y') ops.setProp(target.id, 'a11y', { [key]: value });
  else if (target.kind === 'state') {
    const b = ops.findBlock(target.id);
    if (b) {
      b.states = b.states || {};
      b.states[target.state] = Object.assign({}, b.states[target.state], { [key]: value });
    }
  } else if (target.kind === 'responsive') {
    const b = ops.findBlock(target.id);
    if (b) {
      b.responsive = b.responsive || {};
      b.responsive[target.bp] = Object.assign({}, b.responsive[target.bp], { [key]: value });
    }
  }
  emit('field:changed', { id: target.id, key, live: live !== false });
}

export function field(target, spec) {
  const k = spec.k;
  const label = spec.l || k;
  const type = spec.t || 'text';
  const read = () => target.read(k);

  const row = (control, sub) => h('div', { class: 'row' }, [
    h('label', { class: 'row__label' }, label),
    control,
    sub || null,
  ]);

  switch (type) {
    case 'textarea': {
      const ta = h('textarea', { rows: spec.rows || 3, spellcheck: 'false' });
      ta.value = read() == null ? '' : String(read());
      ta.addEventListener('input', () => commit(target, k, ta.value, true));
      ta.addEventListener('change', () => commit(target, k, ta.value));
      return row(ta);
    }

    case 'number': {
      const input = h('input', { type: 'number', step: spec.step || 1, min: spec.min, max: spec.max });
      input.value = read() == null ? '' : String(read());
      input.addEventListener('input', () => commit(target, k, input.value === '' ? '' : Number(input.value), true));
      input.addEventListener('change', () => commit(target, k, input.value === '' ? '' : Number(input.value)));
      return row(input);
    }

    case 'slider': {
      const range = h('input', { type: 'range', min: spec.min != null ? spec.min : 0, max: spec.max != null ? spec.max : 100, step: spec.step || 1 });
      const out = h('span', { class: 'slider__val' });
      range.value = read() == null ? spec.min || 0 : read();
      out.textContent = String(range.value);
      range.addEventListener('input', () => {
        out.textContent = range.value;
        commit(target, k, Number(range.value), true);
      });
      range.addEventListener('change', () => commit(target, k, Number(range.value)));
      return row(h('div', { class: 'slider' }, [range, out]));
    }

    case 'color': {
      const dot = h('span', { class: 'field__dot', title: read() || '' });
      dot.style.background = read() || 'transparent';
      const text = h('input', { type: 'text', spellcheck: 'false' });
      text.value = read() == null ? '' : String(read());
      const set = (val, live) => {
        dot.style.background = val || 'transparent';
        text.value = val;
        commit(target, k, val, live);
      };
      dot.addEventListener('click', (ev) => emit('field:color', { anchor: dot, current: read(), onPick: (v) => set(v) }));
      text.addEventListener('input', () => {
        dot.style.background = text.value;
        commit(target, k, text.value, true);
      });
      text.addEventListener('change', () => commit(target, k, text.value));
      return row(h('div', { class: 'field field--color' }, [dot, text]));
    }

    case 'check': {
      const el = h('button', { class: 'check' + (read() ? ' is-on' : ''), type: 'button' }, [
        h('span', { class: 'row__label', style: { color: 'var(--text-2)' } }, label),
        h('span', { class: 'switch-ui' }),
      ]);
      el.addEventListener('click', () => {
        const next = !el.classList.contains('is-on');
        el.classList.toggle('is-on', next);
        commit(target, k, next);
      });
      return el;
    }

    case 'select': {
      const opts = spec.opts || spec.o || [];
      const sel = h('select');
      for (const opt of opts) {
        const value = typeof opt === 'object' ? opt.v : opt;
        const text = typeof opt === 'object' ? opt.l : opt;
        sel.appendChild(h('option', { value }, text));
      }
      sel.value = read() == null ? '' : String(read());
      sel.addEventListener('change', () => commit(target, k, sel.value));
      return row(sel);
    }

    case 'seg': {
      const wrap = h('div', { class: 'seg-full' });
      for (const opt of spec.opts || spec.o || []) {
        const value = typeof opt === 'object' ? opt.v : opt;
        const text = typeof opt === 'object' ? opt.l : opt;
        const b = h('button', { type: 'button', class: String(read()) === String(value) ? 'is-on' : '' }, text);
        b.addEventListener('click', () => {
          wrap.querySelectorAll('button').forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on');
          commit(target, k, value);
        });
        wrap.appendChild(b);
      }
      return row(wrap);
    }

    case 'icon': {
      const b = h('button', { class: 'pick', type: 'button' }, String(read() || 'spark'));
      b.addEventListener('click', () => emit('field:iconPick', { anchor: b, current: read(), onPick: (v) => commit(target, k, v) }));
      return row(b);
    }

    case 'asset': {
      const b = h('button', { class: 'pick', type: 'button' }, read() ? 'Replace' : 'Choose file');
      b.addEventListener('click', () => emit('field:asset', {
        anchor: b,
        accept: spec.accept || 'image',
        onPick: (v) => commit(target, k, v),
      }));
      const clear = h('button', { class: 'listrow__del', type: 'button', title: 'Clear' }, '×');
      clear.addEventListener('click', () => commit(target, k, ''));
      return row(h('div', { class: 'pickrow' }, [b, clear]));
    }

    case 'model': {
      const b = h('button', { class: 'pick', type: 'button' }, read() ? 'Replace model file' : 'Choose file from device');
      b.addEventListener('click', () => emit('field:model', {
        anchor: b,
        onPick: (result) => {
          if (!result) return;
          commit(target, k, result.src);
          commit(target, 'srcName', result.name);
          if (result.companions) commit(target, 'companions', result.companions);
          else commit(target, 'companions', null);
        },
      }));
      const info = h('div', { class: 'row__label', style: { color: 'var(--text-3)' } },
        read() ? String(target.read('srcName') || 'model loaded') : 'Select .glb, or .obj+.mtl(+textures) together, or .stl/.fbx');
      const clear = h('button', { class: 'listrow__del', type: 'button', title: 'Remove model' }, '×');
      clear.addEventListener('click', () => {
        commit(target, k, '');
        commit(target, 'srcName', '');
      });
      return row(h('div', { class: 'pickrow' }, [b, clear]), info);
    }

    case 'list': {
      const wrap = h('div', { class: 'listrows' });
      const values = Array.isArray(read()) ? read().slice() : [];
      const paint = () => {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        values.forEach((val, i) => {
          const input = h('input', { type: 'text', value: String(val) });
          input.addEventListener('input', () => {
            values[i] = input.value;
            commit(target, k, values.slice(), true);
          });
          input.addEventListener('change', () => commit(target, k, values.slice()));
          const up = h('button', { class: 'listrow__del', type: 'button', title: 'Move up' }, '↑');
          up.addEventListener('click', () => {
            if (i === 0) return;
            const tmp = values[i - 1];
            values[i - 1] = values[i];
            values[i] = tmp;
            commit(target, k, values.slice());
            paint();
          });
          const del = h('button', { class: 'listrow__del', type: 'button' }, '×');
          del.addEventListener('click', () => {
            values.splice(i, 1);
            commit(target, k, values.slice());
            paint();
          });
          wrap.appendChild(h('div', { class: 'listrow' }, [input, up, del]));
        });
        const add = h('button', { class: 'pick', type: 'button' }, '+ Add item');
        add.addEventListener('click', () => {
          values.push('');
          commit(target, k, values.slice());
          paint();
        });
        wrap.appendChild(add);
      };
      paint();
      return row(wrap);
    }

    case 'multiline': {
      const arr = String(read() == null ? '' : read()).split('\n');
      const wrap = h('div', { class: 'listrows' });
      const paint = () => {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        arr.forEach((val, i) => {
          const ta = h('textarea', { rows: 2, spellcheck: 'false' });
          ta.value = val;
          ta.addEventListener('change', () => {
            arr[i] = ta.value;
            commit(target, k, arr.join('\n'));
          });
          const del = h('button', { class: 'listrow__del', type: 'button' }, '×');
          del.addEventListener('click', () => {
            arr.splice(i, 1);
            commit(target, k, arr.join('\n'));
            paint();
          });
          wrap.appendChild(h('div', { class: 'listrow' }, [ta, del]));
        });
        const add = h('button', { class: 'pick', type: 'button' }, '+ Add line');
        add.addEventListener('click', () => {
          arr.push('');
          commit(target, k, arr.join('\n'));
          paint();
        });
        wrap.appendChild(add);
      };
      paint();
      return row(wrap);
    }

    case 'csv': {
      /* A list editor for a SEPARATOR-JOINED STRING. */
      const wrap = h('div', { class: 'listrows' });
      const sep = spec.sep != null ? String(spec.sep) : ',';
      const pair = spec.pair ? String(spec.pair) : '';
      const toArr = () => {
        const raw = read();
        if (raw == null) return [];
        if (Array.isArray(raw)) return raw.map((x) => String(x));
        const s = String(raw);
        if (!s.trim()) return [];
        return s.split(sep).map((x) => x.trim()).filter((x) => x !== '');
      };
      const fromArr = (arr) => arr.join(sep);
      const values = toArr();
      const paint = () => {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        values.forEach((val, i) => {
          const line = h('div', { class: 'listrow' });
          if (pair) {
            const bits = String(val).split(pair);
            const a = h('input', { type: 'text', value: bits[0] != null ? bits[0] : '' });
            const b = h('input', { type: 'text', value: bits[1] != null ? bits[1] : '' });
            const save = () => {
              values[i] = a.value + pair + b.value;
              commit(target, k, fromArr(values));
            };
            a.addEventListener('input', save);
            b.addEventListener('input', save);
            a.addEventListener('change', save);
            b.addEventListener('change', save);
            a.style.flex = '1 1 40%';
            b.style.flex = '1 1 60%';
            line.appendChild(a);
            line.appendChild(b);
          } else {
            const input = h('input', { type: 'text', value: String(val) });
            input.addEventListener('input', () => {
              values[i] = input.value;
              commit(target, k, fromArr(values), true);
            });
            input.addEventListener('change', () => commit(target, k, fromArr(values)));
            line.appendChild(input);
          }
          const up = h('button', { class: 'listrow__del', type: 'button', title: 'Move up' }, '\u2191');
          up.addEventListener('click', () => {
            if (i === 0) return;
            const tmp = values[i - 1];
            values[i - 1] = values[i];
            values[i] = tmp;
            commit(target, k, fromArr(values));
            paint();
          });
          const del = h('button', { class: 'listrow__del', type: 'button', title: 'Remove' }, '\u00d7');
          del.addEventListener('click', () => {
            values.splice(i, 1);
            commit(target, k, fromArr(values));
            paint();
          });
          line.appendChild(up);
          line.appendChild(del);
          wrap.appendChild(line);
        });
        const add = h('button', { class: 'pick', type: 'button' }, spec.addLabel || ('+ Add ' + (spec.item || 'item')));
        add.addEventListener('click', () => {
          values.push(spec.blank != null ? spec.blank : (pair ? pair : ''));
          commit(target, k, fromArr(values));
          paint();
        });
        wrap.appendChild(add);
      };
      paint();
      return row(wrap);
    }

    case 'grid': {
      /* The TABLE editor: a real rows x columns grid. */
      const headKey = spec.head || 'head';
      const rowsKey = spec.rows || 'rows';
      const sep = spec.sep || ',';
      const wrap = h('div', { class: 'vb-grid-editor' });
      const readHead = () => {
        const raw = read(headKey);
        const s = raw == null ? '' : String(raw);
        return s.trim() ? s.split(sep).map((x) => x.trim()) : [];
      };
      const readRows = () => {
        const raw = read(rowsKey);
        const s = raw == null ? '' : String(raw);
        return s.trim()
          ? s.split('\n').map((r) => r.trim()).filter(Boolean).map((r) => r.split(sep).map((c) => c.trim()))
          : [];
      };
      const writeHead = (arr) => commit(target, headKey, arr.join(sep));
      const writeRows = (arr) => commit(target, rowsKey, arr.map((r) => r.join(sep)).join('\n'));
      const paint = () => {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        const head = readHead();
        const rows = readRows();
        const cols = Math.max(head.length, rows.reduce((m, r) => Math.max(m, r.length), 0), 1);

        const table = h('div', { class: 'vb-grid' });
        table.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(90px,1fr))';

        const hrow = h('div', { class: 'vb-grid__row vb-grid__row--head' });
        for (let c = 0; c < cols; c += 1) {
          const input = h('input', { type: 'text', value: head[c] != null ? head[c] : '', placeholder: 'Column ' + (c + 1) });
          input.addEventListener('input', () => {
            const next = readHead();
            while (next.length < cols) next.push('');
            next[c] = input.value;
            writeHead(next);
          });
          hrow.appendChild(input);
        }
        table.appendChild(hrow);

        rows.forEach((row, r) => {
          const line = h('div', { class: 'vb-grid__row' });
          for (let c = 0; c < cols; c += 1) {
            const input = h('input', { type: 'text', value: row[c] != null ? row[c] : '' });
            input.addEventListener('input', () => {
              const next = readRows();
              if (!next[r]) next[r] = [];
              next[r][c] = input.value;
              writeRows(next);
            });
            line.appendChild(input);
          }
          table.appendChild(line);
        });
        wrap.appendChild(table);

        const bar = h('div', { class: 'vb-grid__bar' });
        const addRow = h('button', { class: 'pick', type: 'button' }, '+ Row');
        addRow.addEventListener('click', () => {
          const next = readRows();
          const blank = [];
          for (let c = 0; c < cols; c += 1) blank.push('');
          next.push(blank);
          writeRows(next);
          paint();
        });
        const delRow = h('button', { class: 'pick', type: 'button' }, '- Row');
        delRow.addEventListener('click', () => {
          const next = readRows();
          if (!next.length) return;
          next.pop();
          writeRows(next);
          paint();
        });
        const addCol = h('button', { class: 'pick', type: 'button' }, '+ Column');
        addCol.addEventListener('click', () => {
          const nextHead = readHead();
          while (nextHead.length < cols) nextHead.push('');
          nextHead.push('Column ' + (nextHead.length + 1));
          writeHead(nextHead);
          const nextRows = readRows();
          nextRows.forEach((r) => { r.push(''); });
          writeRows(nextRows);
          paint();
        });
        const delCol = h('button', { class: 'pick', type: 'button' }, '- Column');
        delCol.addEventListener('click', () => {
          const nextHead = readHead();
          if (nextHead.length <= 1) return;
          nextHead.pop();
          writeHead(nextHead);
          const nextRows = readRows();
          nextRows.forEach((r) => { r.pop(); });
          writeRows(nextRows);
          paint();
        });
        bar.appendChild(addRow);
        bar.appendChild(delRow);
        bar.appendChild(addCol);
        bar.appendChild(delCol);
        wrap.appendChild(bar);
      };
      paint();
      return row(wrap);
    }

    case 'items': {
      /* A structured list: every row has its own fields (JSON storage). */
      const wrap = h('div', { class: 'listrows' });
      const sub = spec.fields || [];
      const toArr = () => {
        const raw = read();
        if (Array.isArray(raw)) return raw;
        try {
          const v = JSON.parse(raw == null ? '[]' : String(raw));
          return Array.isArray(v) ? v : [];
        } catch (e) {
          return [];
        }
      };
      const values = toArr();
      const paint = () => {
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        values.forEach((item, i) => {
          const box = h('div', { class: 'vb-itemrow' });
          const grid = h('div', { class: 'vb-itemrow__fields' });
          sub.forEach((f) => {
            const cell = h('div', { class: 'vb-itemrow__field' });
            cell.appendChild(h('label', { class: 'row__label' }, f.l || f.k));
            let input;
            if (f.t === 'textarea') {
              input = h('textarea', { rows: 2, spellcheck: 'false' });
              input.value = item[f.k] == null ? '' : String(item[f.k]);
            } else if (f.t === 'select') {
              input = h('select');
              for (const o of (f.opts || [])) {
                const opt = h('option', { value: o }, o);
                if (String(item[f.k]) === String(o)) opt.selected = true;
                input.appendChild(opt);
              }
            } else {
              input = h('input', { type: 'text', spellcheck: 'false' });
              input.value = item[f.k] == null ? '' : String(item[f.k]);
            }
            const save = () => {
              values[i] = Object.assign({}, values[i]);
              values[i][f.k] = input.value;
              commit(target, k, JSON.stringify(values));
            };
            input.addEventListener('input', save);
            input.addEventListener('change', save);
            cell.appendChild(input);
            grid.appendChild(cell);
          });
          box.appendChild(grid);
          const tools = h('div', { class: 'vb-itemrow__tools' });
          const up = h('button', { class: 'listrow__del', type: 'button', title: 'Move up' }, '\u2191');
          up.addEventListener('click', () => {
            if (i === 0) return;
            const tmp = values[i - 1];
            values[i - 1] = values[i];
            values[i] = tmp;
            commit(target, k, JSON.stringify(values));
            paint();
          });
          const del = h('button', { class: 'listrow__del', type: 'button', title: 'Remove' }, '\u00d7');
          del.addEventListener('click', () => {
            values.splice(i, 1);
            commit(target, k, JSON.stringify(values));
            paint();
          });
          tools.appendChild(up);
          tools.appendChild(del);
          box.appendChild(tools);
          wrap.appendChild(box);
        });
        const add = h('button', { class: 'pick', type: 'button' }, spec.addLabel || ('+ Add ' + (spec.item || 'item')));
        add.addEventListener('click', () => {
          const fresh = {};
          sub.forEach((f) => { fresh[f.k] = f.blank != null ? f.blank : ''; });
          values.push(fresh);
          commit(target, k, JSON.stringify(values));
          paint();
        });
        wrap.appendChild(add);
      };
      paint();
      return row(wrap);
    }

    default: {
      const input = h('input', { type: 'text', spellcheck: 'false' });
      input.value = read() == null ? '' : String(read());
      input.addEventListener('input', () => commit(target, k, input.value, true));
      input.addEventListener('change', () => commit(target, k, input.value));
      return row(input);
    }
  }
}

export function pair(specs, target) {
  return h('div', { class: 'row-grid' }, specs.map((s) => field(target, s)));
}

export function stateTarget(id) {
  return { id, kind: 'state', state: 'hover', read: () => '' };
}

export function currentTab() {
  return state.ui.tab;
}