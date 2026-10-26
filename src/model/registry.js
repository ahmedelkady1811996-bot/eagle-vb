const DEFS = new Map();
export const CATEGORIES = [];

export function category(name, icon) {
  if (!CATEGORIES.some((c) => c.name === name)) CATEGORIES.push({ name, icon, order: CATEGORIES.length });
  return name;
}

export function def(definition) {
  const entry = {
    type: definition.type,
    cat: definition.cat,
    label: definition.label,
    icon: definition.icon || definition.type,
    tag: definition.tag || 'div',
    /* A framework block renders as its OWN custom element tag (props.tagName),
       so it can be mounted by the framework host and exported as real code. */
    customTag: !!definition.customTag,
    container: !!definition.container,
    text: !!definition.text,
    leaf: definition.leaf !== false,
    fields: definition.fields || [],
    groups: definition.groups || [],
    defaults: definition.defaults || {},
    render: definition.render || (() => ''),
    export: definition.export || null,
    keywords: definition.keywords || '',
  };
  DEFS.set(entry.type, entry);
  return entry;
}

export function get(type) {
  return DEFS.get(type) || null;
}

export function all() {
  return Array.from(DEFS.values());
}

export function byCategory() {
  const map = new Map();
  for (const c of CATEGORIES) map.set(c.name, []);
  for (const d of DEFS.values()) {
    if (!map.has(d.cat)) {
      category(d.cat, d.icon);
      map.set(d.cat, []);
    }
    map.get(d.cat).push(d);
  }
  return map;
}

export function search(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  const words = q.split(/\s+/);
  const scored = [];
  for (const d of DEFS.values()) {
    const hay = (d.type + ' ' + d.label + ' ' + d.cat + ' ' + d.keywords).toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 0;
    if (d.type.toLowerCase().startsWith(q)) score += 100;
    if (d.label.toLowerCase().startsWith(q)) score += 80;
    if (d.label.toLowerCase().includes(q)) score += 40;
    score += hay.split(q).length - 1;
    scored.push({ d, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.d);
}