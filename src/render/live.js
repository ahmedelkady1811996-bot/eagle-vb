const timers = new Set();
const counters = new Map();
let clockTimer = 0;
let countdownTimer = 0;

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  counters.clear();
  if (clockTimer) clearInterval(clockTimer);
  if (countdownTimer) clearInterval(countdownTimer);
  clockTimer = 0;
  countdownTimer = 0;
}

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function runCounters(root) {
  root.querySelectorAll('.vb-counter[data-count]').forEach((el) => {
    if (el.dataset.done === '1') return;
    const target = Number(el.dataset.count) || 0;
    const duration = Number(el.dataset.dur) || 1400;
    const start = performance.now();
    el.dataset.done = '1';
    const original = el.textContent;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);
      const shown = Math.abs(target) >= 1000 ? value.toLocaleString('en-US') : String(value);
      const suffix = original.replace(/[\d,]/g, '').replace(/^[^0-9-]*/, '');
      el.textContent = original.replace(/[\d,]+/, shown);
      if (t < 1) {
        const id = requestAnimationFrame(tick);
        timers.add(id);
      }
    };
    const id = requestAnimationFrame(tick);
    timers.add(id);
  });
}

function runClocks(root) {
  if (clockTimer) return;
  const els = root.querySelectorAll('.vb-clock');
  if (!els.length) return;
  const tick = () => {
    els.forEach((el) => {
      if (!el.isConnected) return;
      const d = new Date();
      const fmt = el.dataset.fmt || 'h:m';
      let text;
      if (fmt === 'h:m:s') text = d.getHours() + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      else if (fmt === 'H:i') text = pad(d.getHours()) + ':' + pad(d.getMinutes());
      else if (fmt === 'full') text = d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      else text = d.getHours() + ':' + pad(d.getMinutes());
      el.textContent = text;
    });
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function runCountdowns(root) {
  if (countdownTimer) return;
  const groups = new Map();
  root.querySelectorAll('.vb-countdown-n').forEach((el) => {
    const group = el.closest('.vb-b') || el;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(el);
  });
  if (!groups.size) return;
  let remaining = groups.size * 1000 + 1;
  const tick = () => {
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = 0;
      return;
    }
    remaining -= 1000;
    const total = Math.max(0, remaining);
    const days = Math.floor(total / 86400000);
    const hours = Math.floor((total % 86400000) / 3600000);
    const mins = Math.floor((total % 3600000) / 60000);
    const values = [days, hours, mins];
    groups.forEach((list) => list.forEach((el, i) => {
      if (el.isConnected) el.textContent = String(values[i] == null ? 0 : values[i]);
    }));
  };
  countdownTimer = setInterval(tick, 1000);
}

function wireTabs(root) {
  root.querySelectorAll('[role="tablist"]').forEach((bar) => {
    if (bar.dataset.wired === '1') return;
    bar.dataset.wired = '1';
    bar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[role="tab"]');
      if (!btn || !bar.contains(btn)) return;
      bar.querySelectorAll('[role="tab"]').forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.style.background = on ? '#0f172a' : 'transparent';
        b.style.color = on ? '#fff' : '#64748b';
      });
    });
  });
}

function wireSwitches(root) {
  root.querySelectorAll('.vb-switch').forEach((el) => {
    if (el.dataset.wired === '1') return;
    el.dataset.wired = '1';
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const wrap = el.closest('label') || el;
      if (wrap && wrap.tagName === 'LABEL' && wrap.querySelector('input[type="checkbox"]')) {
        const input = wrap.querySelector('input[type="checkbox"]');
        if (input.checked) return;
      }
      el.classList.toggle('on');
    });
  });
}

function wireQr(root) {
  root.querySelectorAll('.vb-qr').forEach((el) => {
    if (el.dataset.wired === '1') return;
    el.dataset.wired = '1';
    el.addEventListener('click', () => {
      const text = el.dataset.text || '';
      window.open('https://www.google.com/search?q=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  });
}

export const renderLive = {
  refresh(root) {
    if (!root) return;
    clearTimers();
    wireTabs(root);
    wireSwitches(root);
    wireQr(root);
    runCounters(root);
    runClocks(root);
    runCountdowns(root);
  },
};