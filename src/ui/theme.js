import { state } from '../core/store.js';
import { on } from '../core/bus.js';

const KEY = 'eagle.theme';

export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (e) {
    saved = null;
  }
  // Eagle default: dark editor chrome
  state.ui.theme = saved || 'dark';
  apply();
  on('theme', apply);
}

export function apply() {
  document.body.dataset.theme = state.ui.theme;
  const btn = document.getElementById('tbTheme');
  if (btn) btn.title = state.ui.theme === 'dark' ? 'Switch to light' : 'Switch to dark';
}

export function toggleTheme() {
  state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, state.ui.theme);
  } catch (e) {
    void 0;
  }
  apply();
}