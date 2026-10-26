import { h, clear, $ } from '../core/dom.js';
import { emit } from '../core/bus.js';
import { state } from '../core/store.js';

let openMenu = null;
const rows = new Map();

export function closeAll() {
  if (openMenu) {
    openMenu.classList.remove('is-open');
    openMenu = null;
  }
}

function makeMenu(defs) {
  const wrap = h('div', { class: 'menu' });
  const trigger = h('button', { class: 'menu__trigger', type: 'button' }, defs.label);
  const drop = h('div', { class: 'menu__drop' });

  for (const item of defs.items) {
    if (item === '-') {
      drop.appendChild(h('div', { class: 'menu__sep' }));
      continue;
    }
    if (item.label && item.group) {
      drop.appendChild(h('div', { class: 'menu__label' }, item.label));
      continue;
    }
    const row = h('button', {
      class: 'menu__row' + (item.danger ? ' menu__row--danger' : ''),
      type: 'button',
      'data-cmd': item.id,
      title: item.title || '',
    }, [h('span', {}, item.label), item.key ? h('kbd', {}, item.key) : null]);
    if (item.disabled) row.disabled = true;
    row.addEventListener('click', () => {
      closeAll();
      emit('command', item.id);
    });
    if (item.id) rows.set(item.id, row);
    drop.appendChild(row);
  }

  trigger.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const wasOpen = wrap.classList.contains('is-open');
    closeAll();
    if (!wasOpen) {
      wrap.classList.add('is-open');
      openMenu = wrap;
    }
  });

  wrap.appendChild(trigger);
  wrap.appendChild(drop);
  return wrap;
}

export function buildMenus(defs) {
  const host = $('menus');
  if (!host) return;
  clear(host);
  for (const def of defs) host.appendChild(makeMenu(def));
}

export function setEnabled(cmdId, enabled) {
  const row = rows.get(cmdId);
  if (row) row.disabled = !enabled;
}

export function setLabel(cmdId, label) {
  const row = rows.get(cmdId);
  if (!row) return;
  const span = row.querySelector('span');
  if (span) span.textContent = label;
}

export function setCheck(cmdId, on_) {
  const row = rows.get(cmdId);
  if (!row) return;
  row.dataset.on = on_ ? '1' : '0';
  row.style.color = on_ ? 'var(--accent)' : '';
}

export function install() {
  document.addEventListener('click', () => closeAll());
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeAll();
  });
  window.addEventListener('resize', () => closeAll());
}