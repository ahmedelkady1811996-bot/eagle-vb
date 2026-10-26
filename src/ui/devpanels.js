import * as ops from '../model/ops.js';
import * as workspace from './workspace.js';
import { h, clear } from '../core/dom.js';
import { emit } from '../core/bus.js';
import { currentDoc, snapshot, state } from '../core/store.js';
import { openModal, toast, closeModal, confirmDialog } from './widgets.js';
import { FRAMEWORKS, getFramework, listFrameworks, safeScript } from '../lib/frameworks.js';
import { BACKEND_TEMPLATES, getBackendTemplate, listBackendTemplates, backendEnvFor } from '../lib/backend.js';
import { DB_CONNECTORS, getDbConnector, listDbConnectors, emptySchema, newTable, inferSchemaFromRows, schemaToTypescript, schemaToFormFields, databaseEnvFor, FIELD_TYPES } from '../lib/cmsdb.js';

/*
 * DEVELOPMENT PANELS
 * ==================
 * The four developer-facing surfaces of the builder:
 *
 *   1. Frameworks  — React / Vue / Svelte / Vanilla components, no build step
 *   2. Backend     — an API client for the backend you already run (frontend only)
 *   3. Data        — a database/CMS client plus a schema you can draw
 *   4. Workspace   — local-first sessions, snapshots and an activity log
 *
 * Everything here stores its state on the DOCUMENT, so it travels with the
 * project file and with the export.
 */











/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function fieldCss() {
  return 'width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-2);color:var(--text)';
}

function label(text) {
  return h('label', { class: 'row__label' }, text);
}

function card(title, sub) {
  const box = h('div', { class: 'vb-devcard' });
  const head = h('div', { class: 'vb-devcard__head' });
  head.appendChild(h('strong', {}, title));
  if (sub) head.appendChild(h('span', { class: 'vb-devcard__sub' }, sub));
  box.appendChild(head);
  const body = h('div', { class: 'vb-devcard__body' });
  box.appendChild(body);
  return { box, body };
}

function chip(text, active) {
  const b = h('button', { class: 'tb-btn' + (active ? ' tb-btn--primary' : ''), type: 'button' }, text);
  return b;
}

function persist() {
  emit('doc');
}

/* ------------------------------------------------------------------ */
/* 1. FRAMEWORKS                                                       */
/* ------------------------------------------------------------------ */

export function openFrameworkPanel() {
  const doc = currentDoc();
  return openModal('Framework components', () => {
    const wrap = h('div', { class: 'vb-dev' });

    wrap.appendChild(h('p', { class: 'vb-dev__lead' },
      'React, Vue, Svelte and plain Web Components that run straight in the browser — '
      + 'no build step, no bundler and no JSX. Drop one on the canvas and edit its source here; '
      + 'the component you see while editing is the component the exported page runs.'));

    const grid = h('div', { class: 'vb-devgrid' });
    for (const fw of listFrameworks()) {
      const item = h('button', { class: 'vb-devitem', type: 'button' });
      item.style.setProperty('--dev-accent', fw.accent);
      item.appendChild(h('span', { class: 'vb-devitem__name' }, fw.name));
      item.appendChild(h('span', { class: 'vb-devitem__sub' }, fw.tagline));
      item.addEventListener('click', () => {
        const type = fw.id + 'Component';
        ops.addBlock(type);
        toast(fw.name + ' component added to the canvas', 'ok');
        closeModal();
      });
      grid.appendChild(item);
    }
    wrap.appendChild(grid);

    /* --- the source editor for the selected component --- */
    const selected = ops.primary();
    if (selected && selected.props && selected.props.framework) {
      const c = card('Component source', selected.props.tagName);
      const p = selected.props;

      const tagRow = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });
      const tagInput = h('input', { type: 'text', value: p.tagName || '', spellcheck: 'false' });
      tagInput.style.cssText = fieldCss();
      const fwSelect = h('select');
      for (const fw of listFrameworks()) {
        const o = h('option', { value: fw.id }, fw.name);
        if (fw.id === p.framework) o.selected = true;
        fwSelect.appendChild(o);
      }
      fwSelect.style.cssText = fieldCss();

      const propsInput = h('textarea', { rows: 2, spellcheck: 'false' });
      propsInput.style.cssText = fieldCss() + ';font-family:var(--font-mono);font-size:11px';
      propsInput.value = p.props || '{}';

      const src = h('textarea', { rows: 16, spellcheck: 'false' });
      src.style.cssText = fieldCss() + ';font-family:var(--font-mono);font-size:12px;line-height:1.5';
      src.value = p.source || '';

      const hint = h('div', { class: 'vb-dev__hint' });
      const setHint = () => {
        const fw = getFramework(fwSelect.value);
        hint.textContent = fw
          ? (fw.id === 'react'
            ? 'Define a function component named App. Use htm templates: html`<button>${x}</button>`. React and html are already in scope.'
            : fw.id === 'vue'
              ? 'Define a component named App with a `template` string. The in-browser compiler runs it. ref, computed and watch are in scope.'
              : fw.id === 'svelte'
                ? 'A Svelte component in Svelte\'s own syntax. It is compiled in the browser at runtime, so there is no build step.'
                : 'Export default a class that extends HTMLElement. The builder registers the tag for you.')
          : '';
      };
      setHint();

      fwSelect.addEventListener('change', () => {
        const fw = getFramework(fwSelect.value);
        if (fw) {
          src.value = fw.starter;
          ops.setProp(selected.id, 'source', fw.starter);
        }
        ops.setProp(selected.id, 'framework', fwSelect.value);
        setHint();
        persist();
      });

      const apply = h('button', { class: 'tb-btn tb-btn--primary', type: 'button' }, 'Apply');
      apply.addEventListener('click', () => {
        const tag = String(tagInput.value || '').trim();
        if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag)) {
          toast('Tag must be lowercase with dashes, e.g. my-counter', 'err');
          return;
        }
        ops.setProp(selected.id, 'tagName', tag);
        ops.setProp(selected.id, 'framework', fwSelect.value);
        ops.setProp(selected.id, 'source', src.value);
        ops.setProp(selected.id, 'props', propsInput.value);
        toast('Component updated — it is live on the canvas', 'ok');
        persist();
      });

      const reset = h('button', { class: 'tb-btn', type: 'button' }, 'Reset to starter');
      reset.addEventListener('click', () => {
        const fw = getFramework(fwSelect.value);
        if (!fw) return;
        src.value = fw.starter;
        ops.setProp(selected.id, 'source', fw.starter);
        toast('Starter component restored', 'ok');
        persist();
      });

      const preview = h('button', { class: 'tb-btn', type: 'button' }, 'Copy code');
      preview.addEventListener('click', async () => {
        const fw = getFramework(fwSelect.value);
        if (!fw) return;
        const code = fw.emit(tagInput.value.trim() || 'my-element', src.value);
        try {
          await navigator.clipboard.writeText(code);
          toast('Component code copied', 'ok');
        } catch (e) {
          toast('Clipboard is not available', 'err');
        }
      });

      c.body.appendChild(label('Element tag'));
      c.body.appendChild(tagRow);
      tagRow.appendChild(tagInput);
      const fwWrap = h('div', { style: { flex: '0 0 180px' } });
      fwWrap.appendChild(fwSelect);
      tagRow.appendChild(fwWrap);
      c.body.appendChild(label('Props (JSON)'));
      c.body.appendChild(propsInput);
      c.body.appendChild(label('Source'));
      c.body.appendChild(src);
      c.body.appendChild(hint);
      c.body.appendChild(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [apply, reset, preview]));
      wrap.appendChild(c.box);
    } else {
      const empty = card('Component source', 'nothing selected');
      empty.body.appendChild(h('p', { class: 'vb-dev__hint' },
        'Select a framework block on the canvas to edit its source.'));
      wrap.appendChild(empty.box);
    }

    return wrap;
  }, []);
}

/* ------------------------------------------------------------------ */
/* 2. BACKEND                                                          */
/* ------------------------------------------------------------------ */

export function openBackendPanel() {
  const doc = currentDoc();
  doc.backend = doc.backend || { template: '', resources: [] };
  return openModal('Backend / API', () => {
    const wrap = h('div', { class: 'vb-dev' });
    wrap.appendChild(h('p', { class: 'vb-dev__lead' },
      'The builder runs no server. It generates the frontend half of an API integration — '
      + 'a client, the resource paths and the environment contract — so the exported page '
      + 'talks to the backend you already have.'));

    const c = card('Client template', 'what the exported page carries');
    const grid = h('div', { class: 'vb-devgrid' });
    for (const tpl of listBackendTemplates()) {
      const item = h('button', { class: 'vb-devitem', type: 'button' });
      item.style.setProperty('--dev-accent', tpl.accent);
      item.appendChild(h('span', { class: 'vb-devitem__name' }, tpl.name));
      item.appendChild(h('span', { class: 'vb-devitem__sub' }, tpl.description));
      item.addEventListener('click', () => {
        doc.backend.template = tpl.id;
        persist();
        toast('Backend client set to ' + tpl.name, 'ok');
        openBackendPanel();
        closeModal();
      });
      grid.appendChild(item);
    }
    c.body.appendChild(grid);
    wrap.appendChild(c.box);

    /* --- resources --- */
    const rc = card('Resources', 'the endpoints the page will call');
    const list = h('div', { class: 'vb-devlist' });
    const paint = () => {
      clear(list);
      const rows = doc.backend.resources || [];
      if (!rows.length) {
        list.appendChild(h('div', { class: 'vb-dev__hint' }, 'No resources yet.'));
      }
      rows.forEach((r, i) => {
        const row = h('div', { class: 'vb-devrow' });
        const name = h('input', { type: 'text', value: r.name || '', placeholder: 'articles' });
        const path = h('input', { type: 'text', value: r.path || '', placeholder: '/articles' });
        name.style.cssText = fieldCss();
        path.style.cssText = fieldCss();
        name.addEventListener('change', () => { r.name = name.value; persist(); });
        path.addEventListener('change', () => { r.path = path.value; persist(); });
        const del = h('button', { class: 'tb-btn', type: 'button' }, 'Remove');
        del.addEventListener('click', () => {
          doc.backend.resources.splice(i, 1);
          persist();
          paint();
        });
        row.appendChild(name);
        row.appendChild(path);
        row.appendChild(del);
        list.appendChild(row);
      });
    };
    const add = h('button', { class: 'tb-btn', type: 'button' }, 'Add resource');
    add.addEventListener('click', () => {
      doc.backend.resources = doc.backend.resources || [];
      doc.backend.resources.push({ name: 'resource' + (doc.backend.resources.length + 1), path: '/resource' });
      persist();
      paint();
    });
    paint();
    rc.body.appendChild(list);
    rc.body.appendChild(add);
    wrap.appendChild(rc.box);

    /* --- environment contract --- */
    const envs = backendEnvFor(doc);
    const ec = card('Environment', 'the variables the exported page expects');
    if (!doc.backend.template) {
      ec.body.appendChild(h('p', { class: 'vb-dev__hint' }, 'Pick a client template first.'));
    } else if (!envs.length) {
      ec.body.appendChild(h('p', { class: 'vb-dev__hint' }, 'This template needs no environment variables.'));
    } else {
      const pre = h('pre', { class: 'vb-dev__code' });
      pre.textContent = envs.map((e) => e + '=').join('\n');
      ec.body.appendChild(pre);
      ec.body.appendChild(h('p', { class: 'vb-dev__hint' },
        'Put these in a .env file next to the page, or inline them before the export. '
        + 'A static host can use plain <script> globals instead.'));
    }
    wrap.appendChild(ec.box);

    return wrap;
  }, []);
}

/* ------------------------------------------------------------------ */
/* 3. DATA / CMS                                                       */
/* ------------------------------------------------------------------ */

export function openDataPanel() {
  const doc = currentDoc();
  doc.database = doc.database || { connector: '', schema: emptySchema() };
  doc.database.schema = doc.database.schema || emptySchema();
  return openModal('Data & CMS', () => {
    const wrap = h('div', { class: 'vb-dev' });
    wrap.appendChild(h('p', { class: 'vb-dev__lead' },
      'No backend is hosted here. Point the page at the database or CMS you already use, '
      + 'draw its schema so the form and the types match, and the export carries the client.'));

    /* --- connector --- */
    const c = card('Connector', 'which service the page talks to');
    const grid = h('div', { class: 'vb-devgrid' });
    for (const con of listDbConnectors()) {
      const item = h('button', { class: 'vb-devitem', type: 'button' });
      item.style.setProperty('--dev-accent', con.accent);
      item.appendChild(h('span', { class: 'vb-devitem__name' }, con.name));
      item.appendChild(h('span', { class: 'vb-devitem__sub' }, con.description));
      item.addEventListener('click', () => {
        doc.database.connector = con.id;
        persist();
        toast('Connector set to ' + con.name, 'ok');
        openDataPanel();
        closeModal();
      });
      grid.appendChild(item);
    }
    c.body.appendChild(grid);
    wrap.appendChild(c.box);

    /* --- schema visualiser --- */
    const sc = card('Schema', 'draw the tables the page reads and writes');
    const vis = h('div', { class: 'vb-schema' });
    const paintSchema = () => {
      clear(vis);
      const tables = doc.database.schema.tables || [];
      if (!tables.length) {
        vis.appendChild(h('div', { class: 'vb-dev__hint' }, 'No tables yet — add one, or paste a JSON sample to infer it.'));
        return;
      }
      for (const t of tables) {
        const box = h('div', { class: 'vb-schema__table' });
        const head = h('div', { class: 'vb-schema__head' });
        head.appendChild(h('strong', {}, t.label || t.name));
        const meta = h('span', { class: 'vb-schema__meta' },
          (t.fields || []).length + ' fields');
        head.appendChild(meta);
        const del = h('button', { class: 'tb-btn', type: 'button' }, 'Remove');
        del.addEventListener('click', () => {
          const i = doc.database.schema.tables.indexOf(t);
          if (i >= 0) doc.database.schema.tables.splice(i, 1);
          persist();
          paintSchema();
        });
        head.appendChild(del);
        box.appendChild(head);

        const rows = h('div', { class: 'vb-schema__fields' });
        for (const f of t.fields || []) {
          const row = h('div', { class: 'vb-schema__field' });
          const name = h('input', { type: 'text', value: f.name || '' });
          const type = h('select');
          for (const ty of FIELD_TYPES) {
            const o = h('option', { value: ty }, ty);
            if (ty === f.type) o.selected = true;
            type.appendChild(o);
          }
          name.style.cssText = fieldCss() + ';font-size:11px';
          type.style.cssText = fieldCss() + ';font-size:11px';
          name.addEventListener('change', () => { f.name = name.value; persist(); });
          type.addEventListener('change', () => { f.type = type.value; persist(); });
          const req = h('input', { type: 'checkbox' });
          req.checked = !!f.required;
          req.addEventListener('change', () => { f.required = req.checked; persist(); });
          const pk = h('input', { type: 'checkbox' });
          pk.checked = !!f.pk;
          pk.addEventListener('change', () => { f.pk = pk.checked; persist(); });
          const delF = h('button', { class: 'tb-btn', type: 'button' }, '×');
          delF.addEventListener('click', () => {
            const i = t.fields.indexOf(f);
            if (i >= 0) t.fields.splice(i, 1);
            persist();
            paintSchema();
          });
          row.appendChild(name);
          row.appendChild(type);
          row.appendChild(h('span', { class: 'vb-schema__flag' }, 'req'));
          row.appendChild(req);
          row.appendChild(h('span', { class: 'vb-schema__flag' }, 'pk'));
          row.appendChild(pk);
          row.appendChild(delF);
          rows.appendChild(row);
        }
        box.appendChild(rows);
        vis.appendChild(box);
      }
    };

    const addTable = h('button', { class: 'tb-btn', type: 'button' }, 'Add table');
    addTable.addEventListener('click', () => {
      doc.database.schema.tables = doc.database.schema.tables || [];
      doc.database.schema.tables.push(newTable('table_' + (doc.database.schema.tables.length + 1)));
      persist();
      paintSchema();
    });

    const sample = h('textarea', { rows: 3, spellcheck: 'false', placeholder: 'Paste a JSON array of rows to infer a table' });
    sample.style.cssText = fieldCss() + ';font-family:var(--font-mono);font-size:11px';
    const infer = h('button', { class: 'tb-btn', type: 'button' }, 'Infer from sample');
    infer.addEventListener('click', () => {
      let rows;
      try { rows = JSON.parse(sample.value); } catch (e) {
        toast('That sample is not valid JSON', 'err');
        return;
      }
      if (!Array.isArray(rows) || !rows.length) {
        toast('Paste a non-empty JSON array of objects', 'err');
        return;
      }
      const t = inferSchemaFromRows(rows);
      if (!t) { toast('Could not infer a table from that', 'err'); return; }
      doc.database.schema.tables = doc.database.schema.tables || [];
      doc.database.schema.tables.push(t);
      persist();
      paintSchema();
      toast('Table inferred from the sample', 'ok');
    });

    paintSchema();
    sc.body.appendChild(vis);
    sc.body.appendChild(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [addTable]));
    sc.body.appendChild(label('Infer a table from a JSON sample'));
    sc.body.appendChild(sample);
    sc.body.appendChild(infer);
    wrap.appendChild(sc.box);

    /* --- generated artefacts --- */
    const gc = card('Generated', 'what the schema produces');
    const types = h('pre', { class: 'vb-dev__code' });
    types.textContent = schemaToTypescript(doc.database.schema);
    gc.body.appendChild(label('TypeScript types'));
    gc.body.appendChild(types);

    const fields = schemaToFormFields(doc.database.schema);
    const formPre = h('pre', { class: 'vb-dev__code' });
    formPre.textContent = fields.length
      ? fields.map((f) => f.name + ' : ' + f.type + (f.required ? ' (required)' : '')).join('\n')
      : '// no form fields';
    gc.body.appendChild(label('Form fields'));
    gc.body.appendChild(formPre);

    const envs = databaseEnvFor(doc);
    if (envs.length) {
      const envPre = h('pre', { class: 'vb-dev__code' });
      envPre.textContent = envs.map((e) => e + '=').join('\n');
      gc.body.appendChild(label('Environment'));
      gc.body.appendChild(envPre);
    }
    wrap.appendChild(gc.box);

    return wrap;
  }, []);
}

/* ------------------------------------------------------------------ */
/* 4. WORKSPACE (single user)                                           */
/* ------------------------------------------------------------------ */

export function openWorkspacePanel() {
  return openModal('Workspace', () => {
    const wrap = h('div', { class: 'vb-dev' });
    wrap.appendChild(h('p', { class: 'vb-dev__lead' },
      'Your work is saved in this browser as you type. Take a named snapshot before a big '
      + 'change, see what happened and when, and restore anything you did not mean to do.'));

    /* status */
    const c = card('This session', 'local, on this machine');
    const status = h('div', { class: 'vb-dev__stats' });
    const paintStatus = () => {
      clear(status);
      const st = workspace.status();
      const add = (k, v) => {
        const cell = h('div', { class: 'vb-dev__stat' });
        cell.appendChild(h('span', { class: 'vb-dev__statv' }, String(v)));
        cell.appendChild(h('span', { class: 'vb-dev__statk' }, k));
        status.appendChild(cell);
      };
      add('Saves', st.saves);
      add('Snapshots', st.snapshots);
      add('Last save', st.lastSave ? st.lastSaveLabel : '—');
      add('Size', st.bytes);
    };
    paintStatus();
    c.body.appendChild(status);
    wrap.appendChild(c.box);

    /* autosave */
    const ac = card('Autosave', 'keeps a copy in this browser');
    const autoBox = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } });
    const autoBtn = chip(workspace.autosaveOn() ? 'Autosave is ON' : 'Autosave is OFF', workspace.autosaveOn());
    autoBtn.addEventListener('click', () => {
      workspace.setAutosave(!workspace.autosaveOn());
      autoBtn.textContent = workspace.autosaveOn() ? 'Autosave is ON' : 'Autosave is OFF';
      autoBtn.classList.toggle('tb-btn--primary', workspace.autosaveOn());
      toast('Autosave ' + (workspace.autosaveOn() ? 'enabled' : 'disabled'), 'ok');
    });
    /* The name is typed right here — a native prompt() would be a native
       modal on top of a modal, which is exactly how the page used to
       deadlock. */
    const nameInput = h('input', { type: 'text', placeholder: 'Snapshot name', spellcheck: 'false' });
    nameInput.style.cssText = fieldCss() + ';flex:1 1 160px;min-width:140px';
    const saveNow = h('button', { class: 'tb-btn', type: 'button' }, 'Save a snapshot');
    saveNow.addEventListener('click', () => {
      const name = (nameInput.value || '').trim() || ('Snapshot ' + new Date().toLocaleString());
      workspace.snapshot(name);
      nameInput.value = '';
      paintStatus();
      paintSnaps();
      toast('Snapshot "' + name + '" saved', 'ok');
    });
    autoBox.appendChild(autoBtn);
    autoBox.appendChild(nameInput);
    autoBox.appendChild(saveNow);
    ac.body.appendChild(autoBox);
    wrap.appendChild(ac.box);

    /* snapshots */
    const sc = card('Snapshots', 'restore an earlier state');
    const list = h('div', { class: 'vb-devlist' });
    const paintSnaps = () => {
      clear(list);
      const snaps = workspace.snapshots();
      if (!snaps.length) {
        list.appendChild(h('div', { class: 'vb-dev__hint' }, 'No snapshots yet.'));
        return;
      }
      snaps.forEach((s) => {
        const row = h('div', { class: 'vb-devrow' });
        const info = h('div', { class: 'vb-devrow__info' });
        info.appendChild(h('strong', {}, s.name));
        info.appendChild(h('span', {}, new Date(s.at).toLocaleString()));
        const restore = h('button', { class: 'tb-btn', type: 'button' }, 'Restore');
        restore.addEventListener('click', async () => {
          /* Close this panel first: confirmDialog is itself a modal, and two
             modals on top of each other is a deadlock waiting to happen. */
          closeModal();
          const ok = await confirmDialog(
            'Restore snapshot',
            'Restore "' + s.name + '"?\n\nThe current state is replaced.',
            'Restore'
          );
          if (!ok) return;
          const done = workspace.restore(s.id);
          toast(done ? 'Snapshot restored' : 'Could not restore that snapshot', done ? 'ok' : 'err');
        });
        const del = h('button', { class: 'tb-btn', type: 'button' }, 'Delete');
        del.addEventListener('click', () => {
          workspace.removeSnapshot(s.id);
          paintSnaps();
          paintStatus();
        });
        row.appendChild(info);
        row.appendChild(restore);
        row.appendChild(del);
        list.appendChild(row);
      });
    };
    paintSnaps();
    sc.body.appendChild(list);
    wrap.appendChild(sc.box);

    /* activity */
    const ac2 = card('Activity', 'what happened in this session');
    const log = h('div', { class: 'vb-devlog' });
    const paintLog = () => {
      clear(log);
      const entries = workspace.activity(40);
      if (!entries.length) {
        log.appendChild(h('div', { class: 'vb-dev__hint' }, 'Nothing yet.'));
        return;
      }
      for (const e of entries) {
        const row = h('div', { class: 'vb-devlog__row' });
        row.appendChild(h('span', { class: 'vb-devlog__time' }, new Date(e.at).toLocaleTimeString()));
        row.appendChild(h('span', {}, e.text));
        log.appendChild(row);
      }
    };
    paintLog();
    ac2.body.appendChild(log);
    wrap.appendChild(ac2.box);

    return wrap;
  }, []);
}




export { workspace };
