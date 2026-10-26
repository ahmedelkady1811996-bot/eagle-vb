import { safeScript } from './frameworks.js';

/*
 * CMS / DATABASE INTEGRATION  (no backend)
 * ========================================
 * The builder never hosts a database. It gives you the FRONTEND contract:
 * a client for the service you already use, a schema you can draw and keep in
 * the project, and generated types so the page and the data agree.
 *
 * The schema is stored IN the project (doc.database.schema) so it travels with
 * the export and can generate TypeScript interfaces, form fields and a
 * visualiser — without asking a server what the tables are.
 */


/* The environment prelude every generated client carries. */
const ENV_PRELUDE = [
  "/* Environment. import.meta.env only exists when the page is built with Vite,",
  "   so it is read defensively; a plain HTML page can set",
  "   window.__VB_ENV__ = { VITE_API_URL: \"https://api.example.com\" } instead. */",
  "const __vbEnv = Object.assign({},",
  "  (typeof import.meta !== \"undefined\" && import.meta.env) || {},",
  "  (typeof window !== \"undefined\" && window.__VB_ENV__) || {});",
].join('\n');


export const DB_CONNECTORS = [
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'BaaS',
    description: 'Postgres, Auth, Storage and Realtime — the browser talks to Postgres directly',
    accent: '#3ecf8e',
    env: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    code: [
      '/* Supabase REST — the browser queries Postgres, RLS is the guard. */',
      'const URL = __vbEnv.VITE_SUPABASE_URL;',
      'const KEY = __vbEnv.VITE_SUPABASE_ANON_KEY;',
      '',
      'async function sb(path, options = {}) {',
      '  const res = await fetch(URL + "/rest/v1/" + path, {',
      '    ...options,',
      '    headers: {',
      '      "Content-Type": "application/json",',
      '      apikey: KEY,',
      '      Authorization: "Bearer " + KEY,',
      '      ...(options.headers || {}),',
      '    },',
      '  });',
      '  if (!res.ok) throw new Error("Supabase " + res.status + " " + path);',
      '  const text = await res.text();',
      '  return text ? JSON.parse(text) : null;',
      '}',
      '',
      'export const db = {',
      '  list: (table, query) => sb(table + (query ? "?" + query : "")),',
      '  get: (table, id) => sb(table + "?id=eq." + encodeURIComponent(id)).then((r) => (Array.isArray(r) ? r[0] : r)),',
      '  insert: (table, row) => sb(table, { method: "POST", body: JSON.stringify(row) }).then((r) => (Array.isArray(r) ? r[0] : r)),',
      '  update: (table, id, row) =>',
      '    sb(table + "?id=eq." + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(row) }).then((r) => (Array.isArray(r) ? r[0] : r)),',
      '  remove: (table, id) => sb(table + "?id=eq." + encodeURIComponent(id), { method: "DELETE" }),',
      '  rpc: (fn, body) => sb("rpc/" + fn, { method: "POST", body: JSON.stringify(body || {}) }),',
      '};',
      '',
      'export async function signIn(email, password) {',
      '  const res = await fetch(URL + "/auth/v1/token?grant_type=password", {',
      '    method: "POST",',
      '    headers: { "Content-Type": "application/json", apikey: KEY },',
      '    body: JSON.stringify({ email, password }),',
      '  });',
      '  if (!res.ok) throw new Error("Sign-in failed");',
      '  const data = await res.json();',
      '  localStorage.setItem("sb.access_token", data.access_token);',
      '  return data;',
      '}',
      'export function signOut() { localStorage.removeItem("sb.access_token"); }',
    ].join('\n'),
  },
  {
    id: 'pocketbase',
    name: 'PocketBase',
    category: 'Self-hosted',
    description: 'One binary with SQLite inside — auth, files and realtime',
    accent: '#0f172a',
    env: ['VITE_POCKETBASE_URL'],
    code: [
      '/* PocketBase — SDK-free. */',
      'const URL = __vbEnv.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";',
      '',
      'async function pb(path, options = {}) {',
      '  const res = await fetch(URL + "/api/" + path, {',
      '    ...options,',
      '    headers: { "Content-Type": "application/json", ...(options.headers || {}) },',
      '  });',
      '  if (!res.ok) throw new Error("PocketBase " + res.status);',
      '  const text = await res.text();',
      '  return text ? JSON.parse(text) : null;',
      '}',
      '',
      'export const collection = (name) => ({',
      '  list: (filter, page = 1, perPage = 50) =>',
      '    pb("collections/" + name + "/records?page=" + page + "&perPage=" + perPage',
      '       + (filter ? "&filter=" + encodeURIComponent(filter) : "")),',
      '  get: (id) => pb("collections/" + name + "/records/" + id),',
      '  create: (row) => pb("collections/" + name + "/records", { method: "POST", body: JSON.stringify(row) }),',
      '  update: (id, row) => pb("collections/" + name + "/records/" + id, { method: "PATCH", body: JSON.stringify(row) }),',
      '  remove: (id) => pb("collections/" + name + "/records/" + id, { method: "DELETE" }),',
      '});',
    ].join('\n'),
  },
  {
    id: 'directus',
    name: 'Directus',
    category: 'Headless CMS',
    description: 'A CMS that is also a database — point it at a URL and a token',
    accent: '#263238',
    env: ['VITE_DIRECTUS_URL', 'VITE_DIRECTUS_TOKEN'],
    code: [
      '/* Directus — REST. */',
      'const URL = __vbEnv.VITE_DIRECTUS_URL;',
      'const TOKEN = __vbEnv.VITE_DIRECTUS_TOKEN || "";',
      '',
      'async function du(path, options = {}) {',
      '  const res = await fetch(URL + "/items/" + path, {',
      '    ...options,',
      '    headers: {',
      '      "Content-Type": "application/json",',
      '      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),',
      '      ...(options.headers || {}),',
      '    },',
      '  });',
      '  if (!res.ok) throw new Error("Directus " + res.status);',
      '  const text = await res.text();',
      '  return text ? JSON.parse(text) : null;',
      '}',
      '',
      'export const items = (collection) => ({',
      '  list: (query = {}) => du(collection + "?" + new URLSearchParams(query)),',
      '  get: (id) => du(collection + "/" + id),',
      '  create: (row) => du(collection, { method: "POST", body: JSON.stringify(row) }),',
      '  update: (id, row) => du(collection + "/" + id, { method: "PATCH", body: JSON.stringify(row) }),',
      '  remove: (id) => du(collection + "/" + id, { method: "DELETE" }),',
      '});',
    ].join('\n'),
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'BaaS',
    description: 'Firestore through its REST API — no SDK, no build step',
    accent: '#ffca28',
    env: ['VITE_FIREBASE_PROJECT', 'VITE_FIREBASE_API_KEY'],
    code: [
      '/* Firestore via REST. */',
      'const PROJECT = __vbEnv.VITE_FIREBASE_PROJECT;',
      'const API_KEY = __vbEnv.VITE_FIREBASE_API_KEY;',
      'const BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";',
      '',
      'async function fs(path, options = {}) {',
      '  const res = await fetch(BASE + path, {',
      '    ...options,',
      '    headers: { "Content-Type": "application/json", ...(options.headers || {}) },',
      '  });',
      '  if (!res.ok) throw new Error("Firestore " + res.status);',
      '  const text = await res.text();',
      '  return text ? JSON.parse(text) : null;',
      '}',
      '',
      'export const firestore = {',
      '  list: (collection) => fs("/" + collection).then((r) => r.documents || []),',
      '  get: (collection, id) => fs("/" + collection + "/" + id),',
      '  create: (collection, data) =>',
      '    fs("/" + collection, { method: "POST", body: JSON.stringify({ fields: data }) }),',
      '  update: (collection, id, data) =>',
      '    fs("/" + collection + "/" + id, { method: "PATCH", body: JSON.stringify({ fields: data }) }),',
      '  remove: (collection, id) => fs("/" + collection + "/" + id, { method: "DELETE" }),',
      '};',
    ].join('\n'),
  },
  {
    id: 'local',
    name: 'Local (localStorage)',
    category: 'Offline',
    description: 'A local store so the page works with no service at all',
    accent: '#64748b',
    env: [],
    code: [
      '/* A local store — no service, no network. */',
      'const KEY = "vb.db.";',
      '',
      'function read(name) {',
      '  try { return JSON.parse(localStorage.getItem(KEY + name) || "[]"); }',
      '  catch (e) { return []; }',
      '}',
      'function write(name, rows) {',
      '  localStorage.setItem(KEY + name, JSON.stringify(rows));',
      '  return rows;',
      '}',
      '',
      'export const db = {',
      '  list: (name) => read(name),',
      '  get: (name, id) => read(name).find((r) => String(r.id) === String(id)) || null,',
      '  create: (name, row) => {',
      '    const rows = read(name);',
      '    const item = { id: Date.now(), ...row };',
      '    rows.push(item);',
      '    write(name, rows);',
      '    return item;',
      '  },',
      '  update: (name, id, row) => {',
      '    const rows = read(name).map((r) => (String(r.id) === String(id) ? { ...r, ...row } : r));',
      '    write(name, rows);',
      '    return rows.find((r) => String(r.id) === String(id));',
      '  },',
      '  remove: (name, id) => write(name, read(name).filter((r) => String(r.id) !== String(id))),',
      '  seed: (name, rows) => write(name, rows),',
      '};',
    ].join('\n'),
  },
];

export function getDbConnector(id) {
  return DB_CONNECTORS.find((c) => c.id === id) || null;
}

export function listDbConnectors() {
  return DB_CONNECTORS;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export const FIELD_TYPES = ['text', 'string', 'number', 'integer', 'boolean', 'date', 'datetime', 'json', 'email', 'url', 'slug', 'richtext', 'relation', 'enum'];

export function emptySchema() {
  return { tables: [] };
}

export function newTable(name) {
  return {
    id: 't' + Math.random().toString(36).slice(2, 8),
    name: String(name || 'new_table'),
    label: '',
    fields: [
      { id: 'f1', name: 'id', type: 'uuid', required: true, pk: true, note: 'primary key' },
      { id: 'f2', name: 'created_at', type: 'datetime', required: false, pk: false, note: '' },
    ],
    indexes: [],
  };
}

export function inferSchemaFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  const sample = list[0];
  const fields = [];
  for (const key of Object.keys(sample)) {
    const v = sample[key];
    let type = 'text';
    if (typeof v === 'number') type = Number.isInteger(v) ? 'integer' : 'number';
    else if (typeof v === 'boolean') type = 'boolean';
    else if (v && typeof v === 'object') type = 'json';
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) type = 'datetime';
    else if (typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v)) type = 'email';
    fields.push({
      id: 'f' + Math.random().toString(36).slice(2, 8),
      name: key,
      type,
      required: false,
      pk: key === 'id',
      note: '',
    });
  }
  return {
    id: 't' + Math.random().toString(36).slice(2, 8),
    name: 'inferred',
    label: 'Inferred from sample',
    fields,
    indexes: [],
  };
}

/** TypeScript interfaces from the schema — the page and the data agree. */
export function schemaToTypescript(schema) {
  const tables = (schema && schema.tables) || [];
  if (!tables.length) return '// no tables yet';
  const out = [];
  for (const t of tables) {
    const name = (t.label || t.name || 'Row').replace(/[^A-Za-z0-9_]/g, '');
    const safe = name.charAt(0).toUpperCase() + name.slice(1);
    out.push('export interface ' + safe + ' {');
    for (const f of t.fields || []) {
      const tsc = tsTypeOf(f.type);
      const opt = f.required ? '' : '?';
      out.push('  ' + f.name + opt + ': ' + tsc + ';');
    }
    out.push('}');
    out.push('');
  }
  return out.join('\n');
}

export function tsTypeOf(type) {
  switch (String(type)) {
    case 'number': return 'number';
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'json': return 'Record<string, unknown>';
    case 'date': return 'string';
    case 'datetime': return 'string';
    default: return 'string';
  }
}

/** A form field definition per schema field — used by the form generator. */
export function schemaToFormFields(schema) {
  const out = [];
  for (const t of (schema && schema.tables) || []) {
    for (const f of t.fields || []) {
      if (f.pk) continue;
      out.push({
        name: f.name,
        label: (f.name || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type: inputTypeOf(f.type),
        required: !!f.required,
        table: t.name,
        placeholder: f.note || '',
      });
    }
  }
  return out;
}

function inputTypeOf(type) {
  switch (String(type)) {
    case 'email': return 'email';
    case 'url': return 'url';
    case 'number': case 'integer': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime-local';
    case 'richtext': return 'textarea';
    case 'boolean': return 'checkbox';
    default: return 'text';
  }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export function databaseScriptsFor(doc) {
  const cfg = (doc && doc.database) || null;
  if (!cfg || !cfg.connector) return '';
  const con = getDbConnector(cfg.connector);
  if (!con) return '';
  const parts = [];
  parts.push('<script type="module">');
  parts.push('/* ' + con.name + ' client — generated by Eagle Visual Builder */');
  parts.push(safeScript(ENV_PRELUDE));
  parts.push(safeScript(con.code));
  const schema = cfg.schema;
  if (schema && schema.tables && schema.tables.length) {
    parts.push('/* Schema declared in the builder */');
    parts.push(safeScript('export const schema = ' + JSON.stringify(schema, null, 2) + ';'));
  }
  parts.push('</' + 'script>');
  return parts.join('\n');
}

export function databaseEnvFor(doc) {
  const cfg = (doc && doc.database) || null;
  if (!cfg || !cfg.connector) return [];
  const con = getDbConnector(cfg.connector);
  return con ? con.env.slice() : [];
}
