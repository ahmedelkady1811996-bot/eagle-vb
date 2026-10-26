export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const key in attrs) {
      const val = attrs[key];
      if (val == null || val === false) continue;
      if (key === 'class') el.className = val;
      else if (key === 'text') el.textContent = val;
      else if (key === 'html') el.innerHTML = val;
      else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
      else if (key === 'dataset') Object.assign(el.dataset, val);
      else if (key.slice(0, 2) === 'on' && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (val === true) el.setAttribute(key, '');
      else el.setAttribute(key, val);
    }
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  if (children == null) return parent;
  if (Array.isArray(children)) {
    for (const c of children) append(parent, c);
    return parent;
  }
  if (children instanceof Node) parent.appendChild(children);
  else parent.appendChild(document.createTextNode(String(children)));
  return parent;
}

export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
  return el;
}

const $ = (id) => document.getElementById(id);
export const qs = (sel, root) => (root || document).querySelector(sel);
export const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export function on(target, type, handler, options) {
  if (!target || !target.addEventListener) return () => {};
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

export function delegate(root, selector, type, handler) {
  return on(root, type, (ev) => {
    const match = ev.target instanceof Element ? ev.target.closest(selector) : null;
    if (match && root.contains(match)) handler(ev, match);
  });
}

export function toggleClass(el, name, force) {
  if (!el) return;
  if (force === undefined) el.classList.toggle(name);
  else if (force) el.classList.add(name);
  else el.classList.remove(name);
}

export function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}

export function setStyle(el, prop, value) {
  if (el && el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
}

export function icon(name, size) {
  const file = /\.svg$/i.test(name) ? name : name + '.svg';
  const el = h('span', { class: 'ic', 'aria-hidden': 'true' });
  el.style.backgroundImage = 'url("IMAGES/' + file + '")';
  if (size) {
    el.style.width = size + 'px';
    el.style.height = size + 'px';
  }
  return el;
}

export { $ };
