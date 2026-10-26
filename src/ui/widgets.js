import { h, clear, $, on } from '../core/dom.js';
import { SWATCHES } from './fields.js';

let modalResolve = null;

export function toast(message, kind) {
  const host = $('toasts');
  if (!host) return;
  const el = h('div', { class: 'toast' + (kind ? ' toast--' + kind : '') }, message);
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 180ms, transform 180ms';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 200);
  }, 2200);
}

export function openModal(title, buildBody, actions) {
  const modal = $('modal');
  const body = $('modalBody');
  const acts = $('modalActions');
  $('modalTitle').textContent = title;
  clear(body);
  clear(acts);
  body.classList.remove('modal__body--flush');
  const content = buildBody(body);
  if (content) body.appendChild(content);
  for (const a of (actions || [])) {
    const b = h('button', { class: 'tb-btn' + (a.primary ? ' tb-btn--primary' : ''), type: 'button' }, a.label);
    b.addEventListener('click', () => {
      const keep = a.onClick && a.onClick();
      if (!keep) closeModal();
    });
    acts.appendChild(b);
  }
  modal.classList.add('is-on');
  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

export function closeModal() {
  const modal = $('modal');
  if (!modal) return;
  modal.classList.remove('is-on');
  if (modalResolve) {
    modalResolve();
    modalResolve = null;
  }
}

export function modalIsOpen() {
  const modal = $('modal');
  return !!(modal && modal.classList.contains('is-on'));
}

/**
 * A yes/no question that does NOT block.
 *
 * Never use window.confirm() here. In the Electron app the preload maps it to a
 * synchronous IPC that opens a NATIVE modal dialog, and a native modal raised
 * before the BrowserWindow is shown deadlocks the whole app: ready-to-show can
 * never fire while the modal is up, so the window that the dialog is attached
 * to is never created and nobody can ever dismiss it. That is not theoretical -
 * it is what wedged the renderer on every launch after the first, because boot
 * asks "restore autosaved work?" exactly when an autosave exists.
 *
 * This returns a Promise<boolean> and paints its own modal in the page, so the
 * question is answered with the UI that is already on screen.
 */
export function confirmDialog(title, message, okLabel, cancelLabel) {
  return new Promise((resolve) => {
    const modal = $('modal');
    const body = $('modalBody');
    const acts = $('modalActions');
    if (!modal || !body || !acts) { resolve(false); return; }
    $('modalTitle').textContent = title;
    clear(body);
    clear(acts);
    body.classList.remove('modal__body--flush');
    body.appendChild(h('p', {
      style: { margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-2)' },
    }, message));

    let answered = false;
    const finish = (value) => {
      if (answered) return;
      answered = true;
      modal.classList.remove('is-on');
      resolve(value);
    };

    const ok = h('button', { class: 'tb-btn tb-btn--primary', type: 'button' }, okLabel || 'OK');
    ok.addEventListener('click', () => finish(true));
    const no = h('button', { class: 'tb-btn', type: 'button' }, cancelLabel || 'Cancel');
    no.addEventListener('click', () => finish(false));
    acts.appendChild(no);
    acts.appendChild(ok);

    modal.classList.add('is-on');
    const onKey = (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); document.removeEventListener('keydown', onKey, true); finish(false); }
      if (ev.key === 'Enter') { ev.preventDefault(); document.removeEventListener('keydown', onKey, true); finish(true); }
    };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { try { ok.focus(); } catch (e) { void e; } }, 0);
  });
}

export function initWidgets() {
  const close = $('modalClose');
  if (close) close.addEventListener('click', closeModal);
  const modal = $('modal');
  if (modal) {
    modal.addEventListener('mousedown', (ev) => {
      if (ev.target === modal) closeModal();
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      closePopover();
      closeModal();
    }
  });
}

let popoverDismiss = null;

export function openPopover(anchor, build) {
  const pop = $('popover');
  clear(pop);
  const node = build(pop);
  if (node) pop.appendChild(node);

  const rect = anchor.getBoundingClientRect();
  pop.classList.add('is-on');
  const size = pop.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + size.width > window.innerWidth - 10) left = window.innerWidth - size.width - 10;
  if (top + size.height > window.innerHeight - 10) top = rect.top - size.height - 6;
  pop.style.left = Math.max(10, left) + 'px';
  pop.style.top = Math.max(10, top) + 'px';

  const dismiss = (ev) => {
    if (pop.contains(ev.target)) return;
    closePopover();
  };
  const esc = (ev) => {
    if (ev.key === 'Escape') closePopover();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', esc);
  }, 0);
  popoverDismiss = () => {
    document.removeEventListener('mousedown', dismiss);
    document.removeEventListener('keydown', esc);
  };
  return pop;
}

export function closePopover() {
  const pop = $('popover');
  if (!pop || !pop.classList.contains('is-on')) return;
  pop.classList.remove('is-on');
  clear(pop);
  if (popoverDismiss) {
    popoverDismiss();
    popoverDismiss = null;
  }
}

export function colorPopover(anchor, current, onPick) {
  return openPopover(anchor, () => {
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } });
    const grid = h('div', { class: 'swatches' });
    for (const c of SWATCHES) {
      const b = h('button', { class: 'swatch', type: 'button', title: c });
      b.style.background = c;
      b.addEventListener('click', () => {
        onPick(c);
        closePopover();
      });
      grid.appendChild(b);
    }
    const input = h('input', { type: 'text', value: current || '', placeholder: '#000000 or rgba()' });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        onPick(input.value.trim());
        closePopover();
      }
      ev.stopPropagation();
    });
    const apply = h('button', { class: 'pick', type: 'button' }, 'Apply custom');
    apply.addEventListener('click', () => {
      onPick(input.value.trim());
      closePopover();
    });
    const none = h('button', { class: 'pick', type: 'button' }, 'Transparent');
    none.addEventListener('click', () => {
      onPick('');
      closePopover();
    });
    wrap.appendChild(grid);
    wrap.appendChild(input);
    wrap.appendChild(h('div', { class: 'pickrow' }, [apply, none]));
    return wrap;
  });
}

export function initToasts() {
  on('toast', (payload) => toast(payload.message || payload, payload && payload.kind));
}