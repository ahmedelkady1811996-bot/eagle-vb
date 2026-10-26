import { safeScript } from './frameworks.js';

/*
 * BACKEND / API GENERATION  (frontend only)
 * =========================================
 * The builder does NOT run a server. What it generates is the FRONTEND half of
 * an API integration: a typed client, the resource paths, the request helpers
 * and the environment contract. You point it at an existing backend (or one
 * you deploy yourself) and the exported page talks to it.
 *
 * Every template is a plain ES module that ends up in the exported HTML, so
 * the page stays a single file with no build step.
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


export const BACKEND_TEMPLATES = [
  {
    id: 'rest',
    name: 'REST API client',
    category: 'HTTP',
    description: 'Typed fetch wrapper — works with Express, FastAPI, Django, Rails, Nest, Spring…',
    icon: 'code',
    accent: '#4f46e5',
    code: [
      '/* REST client — talks to any HTTP API. */',
      'const BASE = __vbEnv.VITE_API_URL || "/api";',
      'const TOKEN = __vbEnv.VITE_API_TOKEN || "";',
      '',
      'async function request(path, options = {}) {',
      '  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };',
      '  if (TOKEN) headers.Authorization = "Bearer " + TOKEN;',
      '  const res = await fetch(BASE + path, { ...options, headers });',
      '  if (!res.ok) {',
      '    const detail = await res.text().catch(() => "");',
      '    throw new Error("API " + res.status + " " + path + (detail ? ": " + detail : ""));',
      '  }',
      '  if (res.status === 204) return null;',
      '  const type = res.headers.get("content-type") || "";',
      '  return type.includes("json") ? res.json() : res.text();',
      '}',
      '',
      'export const api = {',
      '  get: (p, o) => request(p, { ...o, method: "GET" }),',
      '  post: (p, body, o) => request(p, { ...o, method: "POST", body: JSON.stringify(body) }),',
      '  put: (p, body, o) => request(p, { ...o, method: "PUT", body: JSON.stringify(body) }),',
      '  patch: (p, body, o) => request(p, { ...o, method: "PATCH", body: JSON.stringify(body) }),',
      '  del: (p, o) => request(p, { ...o, method: "DELETE" }),',
      '};',
      'export { request };',
    ].join('\n'),
  },
  {
    id: 'graphql',
    name: 'GraphQL client',
    category: 'GraphQL',
    description: 'Query + mutation helper for a GraphQL endpoint',
    icon: 'code',
    accent: '#e10098',
    code: [
      '/* GraphQL client — one function, no SDK, no build step. */',
      'const ENDPOINT = __vbEnv.VITE_GRAPHQL_URL || "/graphql";',
      '',
      'export async function gql(query, variables = {}) {',
      '  const res = await fetch(ENDPOINT, {',
      '    method: "POST",',
      '    headers: { "Content-Type": "application/json" },',
      '    body: JSON.stringify({ query, variables }),',
      '  });',
      '  if (!res.ok) throw new Error("GraphQL HTTP " + res.status);',
      '  const payload = await res.json();',
      '  if (payload.errors && payload.errors.length) {',
      '    throw new Error(payload.errors.map((e) => e.message).join("; "));',
      '  }',
      '  return payload.data;',
      '}',
      '',
      'export const query = (q, v) => gql(q, v);',
      'export const mutate = (m, v) => gql(m, v);',
    ].join('\n'),
  },
  {
    id: 'supabase',
    name: 'Supabase client',
    category: 'BaaS',
    description: 'Postgres, Auth, Storage and Realtime straight from the browser',
    icon: 'database',
    accent: '#3ecf8e',
    code: [
      '/* Supabase — the browser talks to Postgres directly, with RLS as the guard. */',
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
      '  if (!res.ok) throw new Error("Supabase " + res.status);',
      '  return res.json();',
      '}',
      '',
      'export const db = {',
      '  select: (table, query = "") => sb(table + (query ? "?" + query : "")),',
      '  insert: (table, row) => sb(table, { method: "POST", body: JSON.stringify(row) }),',
      '  update: (table, id, row) =>',
      '    sb(table + "?id=eq." + id, { method: "PATCH", body: JSON.stringify(row) }),',
      '  remove: (table, id) => sb(table + "?id=eq." + id, { method: "DELETE" }),',
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
    name: 'PocketBase client',
    category: 'Self-hosted',
    description: 'One binary, SQLite, auth and realtime — SDK-free',
    icon: 'database',
    accent: '#0f172a',
    code: [
      '/* PocketBase — one binary, no external database to manage. */',
      'const URL = __vbEnv.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";',
      '',
      'async function pb(path, options = {}) {',
      '  const res = await fetch(URL + "/api/" + path, {',
      '    ...options,',
      '    headers: { "Content-Type": "application/json", ...(options.headers || {}) },',
      '  });',
      '  if (!res.ok) throw new Error("PocketBase " + res.status);',
      '  return res.json();',
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
    name: 'Directus client',
    category: 'Headless CMS',
    description: 'A headless CMS you can point at with a URL and a token',
    icon: 'database',
    accent: '#263238',
    code: [
      '/* Directus — REST or GraphQL, with a static or dynamic token. */',
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
      '  return res.json();',
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
    name: 'Firebase client',
    category: 'BaaS',
    description: 'Firestore + Auth through the REST API — no SDK needed',
    icon: 'database',
    accent: '#ffca28',
    code: [
      '/* Firebase via its REST API — no SDK, no build step. */',
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
      '  return res.json();',
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
      '',
      'export async function signIn(email, password) {',
      '  const res = await fetch(',
      '    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + API_KEY,',
      '    { method: "POST", headers: { "Content-Type": "application/json" },',
      '      body: JSON.stringify({ email, password, returnSecureToken: true }) });',
      '  if (!res.ok) throw new Error("Sign-in failed");',
      '  const data = await res.json();',
      '  localStorage.setItem("fb.token", data.idToken);',
      '  return data;',
      '}',
    ].join('\n'),
  },
  {
    id: 'mock',
    name: 'Mock API (offline)',
    category: 'Local',
    description: 'A fake backend in localStorage — develop with no server at all',
    icon: 'flask',
    accent: '#64748b',
    code: [
      '/* A mock backend that lives in localStorage. No server, no network. */',
      'const KEY = "vb.mock.";',
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
      'export const mock = {',
      '  list: (name) => read(name),',
      '  get: (name, id) => read(name).find((r) => String(r.id) === String(id)) || null,',
      '  create: (name, row) => {',
      '    const rows = read(name);',
      '    const item = { id: Date.now(), ...row };',
      '    rows.push(item);',
      '    return write(name, rows).slice(-1)[0];',
      '  },',
      '  update: (name, id, row) => {',
      '    const rows = read(name).map((r) => (String(r.id) === String(id) ? { ...r, ...row } : r));',
      '    return write(name, rows).find((r) => String(r.id) === String(id));',
      '  },',
      '  remove: (name, id) => write(name, read(name).filter((r) => String(r.id) !== String(id))),',
      '  seed: (name, rows) => write(name, rows),',
      '};',
    ].join('\n'),
  },
];

export function getBackendTemplate(id) {
  return BACKEND_TEMPLATES.find((t) => t.id === id) || null;
}

export function listBackendTemplates() {
  return BACKEND_TEMPLATES;
}

/**
 * The backend client the exported page carries.
 * The configuration lives on the document so the panel and the export agree.
 */
export function backendScriptsFor(doc) {
  const cfg = (doc && doc.backend) || null;
  if (!cfg || !cfg.template) return '';
  const tpl = getBackendTemplate(cfg.template);
  if (!tpl) return '';
  const parts = [];
  parts.push('<script type="module">');
  parts.push('/* ' + tpl.name + ' — generated by Eagle Visual Builder */');
  parts.push(safeScript(ENV_PRELUDE));
  parts.push(safeScript(tpl.code));
  if (cfg.resources && cfg.resources.length) {
    parts.push('/* Resources declared in the builder */');
    parts.push(safeScript('export const resources = ' + JSON.stringify(cfg.resources, null, 2) + ';'));
  }
  parts.push('</' + 'script>');
  return parts.join('\n');
}

/** The environment contract the exported page expects. */
export function backendEnvFor(doc) {
  const cfg = (doc && doc.backend) || null;
  if (!cfg || !cfg.template) return [];
  const tpl = getBackendTemplate(cfg.template);
  if (!tpl) return [];
  const out = [];
  for (const line of tpl.code.split('\n')) {
    const m = /__vbEnv\.([A-Z0-9_]+)/.exec(line);
    if (m) out.push(m[1]);
  }
  return Array.from(new Set(out));
}
