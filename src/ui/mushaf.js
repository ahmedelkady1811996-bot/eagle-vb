/**
 * Eagle Mushaf — interactive Quran reader (Arabic).
 * Hydrates #eagle-mushaf from api.alquran.cloud
 */
const API = 'https://api.alquran.cloud/v1';
const AYAT_PER_PAGE = 8;

let state = {
  surahs: [],
  surah: 1,
  ayahs: [],
  page: 0,
  loading: false,
};

const HADITHS = [
  { t: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى.', s: 'متفق عليه' },
  { t: 'من حسن إسلام المرء تركه ما لا يعنيه.', s: 'الترمذي' },
  { t: 'لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه.', s: 'البخاري ومسلم' },
  { t: 'الكلمة الطيبة صدقة.', s: 'البخاري' },
  { t: 'تبسمك في وجه أخيك صدقة.', s: 'الترمذي' },
];

function $(sel, root) {
  return (root || document).querySelector(sel);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function loadSurahList(root) {
  const data = await fetchJson(API + '/surah');
  state.surahs = (data && data.data) || [];
  const sel = $('#ms-surah', root);
  if (!sel) return;
  sel.innerHTML = state.surahs.map((s) =>
    '<option value="' + s.number + '">' + s.number + ' — ' + escapeHtml(s.name) + ' (' + escapeHtml(s.englishName) + ')</option>'
  ).join('');
  sel.value = String(state.surah);
}

async function loadSurah(num, root) {
  state.loading = true;
  state.surah = Number(num) || 1;
  state.page = 0;
  paintStatus(root, 'جاري تحميل السورة…');
  try {
    const data = await fetchJson(API + '/surah/' + state.surah + '/quran-uthmani');
    const surah = data && data.data;
    state.ayahs = (surah && surah.ayahs) || [];
    state.meta = surah;
    paintBook(root);
  } catch (err) {
    paintStatus(root, 'تعذّر التحميل من الخادم. تحقق من الاتصال ثم أعد المحاولة.');
    console.warn('[mushaf]', err);
  } finally {
    state.loading = false;
  }
}

function pageCount() {
  return Math.max(1, Math.ceil(state.ayahs.length / AYAT_PER_PAGE));
}

function paintStatus(root, text) {
  const el = $('#ms-status', root);
  if (el) el.textContent = text || '';
}

function paintBook(root) {
  const pages = pageCount();
  if (state.page >= pages) state.page = pages - 1;
  if (state.page < 0) state.page = 0;

  const start = state.page * AYAT_PER_PAGE;
  const slice = state.ayahs.slice(start, start + AYAT_PER_PAGE);
  const leaf = $('#ms-leaf', root);
  const meta = $('#ms-meta', root);
  const pager = $('#ms-pager', root);

  if (meta && state.meta) {
    meta.innerHTML = '<strong>' + escapeHtml(state.meta.name) + '</strong>'
      + '<span>' + escapeHtml(state.meta.englishNameTranslation || state.meta.englishName || '') + '</span>'
      + '<span>' + state.ayahs.length + ' آية · صفحة ' + (state.page + 1) + ' / ' + pages + '</span>';
  }

  if (leaf) {
    leaf.classList.remove('is-flip');
    void leaf.offsetWidth;
    leaf.classList.add('is-flip');
    const bismillah = state.surah !== 9 && state.page === 0
      ? '<div class="ms-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>'
      : '';
    leaf.innerHTML = bismillah + slice.map((a) =>
      '<p class="ms-ayah"><span class="ms-num">' + a.numberInSurah + '</span>'
      + '<span class="ms-txt">' + escapeHtml(a.text) + '</span></p>'
    ).join('');
  }

  if (pager) {
    pager.innerHTML =
      '<button type="button" class="ms-nav" data-dir="-1" ' + (state.page <= 0 ? 'disabled' : '') + '>الصفحة السابقة</button>'
      + '<span class="ms-page-ind">' + (state.page + 1) + ' / ' + pages + '</span>'
      + '<button type="button" class="ms-nav" data-dir="1" ' + (state.page >= pages - 1 ? 'disabled' : '') + '>الصفحة التالية</button>';
  }

  paintStatus(root, '');
  paintHadith(root);
}

function paintHadith(root) {
  const box = $('#ms-hadith', root);
  if (!box) return;
  const h = HADITHS[state.page % HADITHS.length];
  box.innerHTML = '<div class="ms-hadith-label">حديث شريف</div>'
    + '<blockquote>«' + escapeHtml(h.t) + '»</blockquote>'
    + '<cite>— ' + escapeHtml(h.s) + '</cite>';
}

function bind(root) {
  if (root.dataset.msBound === '1') return;
  root.dataset.msBound = '1';
  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-dir]');
    if (!btn || btn.disabled) return;
    const dir = Number(btn.getAttribute('data-dir'));
    state.page += dir;
    paintBook(root);
  });
  const sel = $('#ms-surah', root);
  if (sel) {
    sel.addEventListener('change', () => loadSurah(sel.value, root));
  }
  const prev = $('#ms-prev-surah', root);
  const next = $('#ms-next-surah', root);
  if (prev) prev.addEventListener('click', () => {
    const n = Math.max(1, state.surah - 1);
    if (sel) sel.value = String(n);
    loadSurah(n, root);
  });
  if (next) next.addEventListener('click', () => {
    const n = Math.min(114, state.surah + 1);
    if (sel) sel.value = String(n);
    loadSurah(n, root);
  });
}

export function mushafShellHtml() {
  return `
<div id="eagle-mushaf" class="eagle-mushaf" dir="rtl" lang="ar">
  <style>
    .eagle-mushaf{
      --ms-bg:#0b0f17; --ms-card:rgba(255,255,255,.06); --ms-stroke:rgba(255,255,255,.12);
      --ms-txt:#eaf0ff; --ms-muted:#9aa8c7; --ms-gold:#d4a853; --ms-brand:#ff2e63; --ms-brand2:#ff7a45;
      --ms-paper:#f7f0e2; --ms-ink:#1c1917;
      font-family:'Cairo', 'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', system-ui, sans-serif;
      color:var(--ms-txt); background:transparent; width:100%;
    }
    .eagle-mushaf *{box-sizing:border-box}
    .ms-wrap{max-width:920px;margin:0 auto;padding:8px 8px 28px}
    .ms-toolbar{
      display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
      background:var(--ms-card);border:1px solid var(--ms-stroke);border-radius:16px;
      padding:12px 14px;margin-bottom:16px;backdrop-filter:blur(18px);
    }
    .ms-toolbar select,.ms-toolbar button{
      font:inherit;border-radius:12px;border:1.5px solid var(--ms-stroke);
      background:rgba(255,255,255,.05);color:var(--ms-txt);padding:9px 12px;cursor:pointer;
    }
    .ms-toolbar select{min-width:200px;flex:1}
    .ms-toolbar button:hover{border-color:var(--ms-gold)}
    .ms-meta{
      display:flex;flex-wrap:wrap;gap:10px 18px;justify-content:center;
      color:var(--ms-muted);font-size:13px;margin-bottom:12px;
    }
    .ms-meta strong{color:var(--ms-gold);font-size:16px}
    .ms-book{
      perspective:1600px; margin:0 auto 16px;
    }
    .ms-leaf{
      background:linear-gradient(180deg,#fbf6ea 0%, var(--ms-paper) 40%, #efe6d2 100%);
      color:var(--ms-ink);
      border-radius:18px;
      padding:28px 22px 32px;
      min-height:420px;
      box-shadow:
        0 1px 0 rgba(255,255,255,.6) inset,
        0 24px 50px rgba(0,0,0,.35),
        0 0 0 1px rgba(212,168,83,.25);
      position:relative;
      transform-origin:right center;
      transition:transform .45s cubic-bezier(.2,.9,.25,1), opacity .35s ease;
    }
    .ms-leaf.is-flip{animation:msFlip .55s ease}
    @keyframes msFlip{
      0%{transform:rotateY(0);opacity:1}
      40%{transform:rotateY(-12deg);opacity:.85}
      100%{transform:rotateY(0);opacity:1}
    }
    .ms-leaf::before{
      content:''; position:absolute; inset:12px; border:1px solid rgba(212,168,83,.35);
      border-radius:12px; pointer-events:none;
    }
    .ms-bismillah{
      text-align:center; font-size:22px; color:#7c5e1a; margin:6px 0 18px;
      font-weight:700; letter-spacing:.5px;
    }
    .ms-ayah{
      display:flex; gap:10px; align-items:flex-start;
      margin:0 0 14px; line-height:2.05; font-size:22px; text-align:right;
    }
    .ms-num{
      flex:0 0 28px; height:28px; border-radius:999px;
      background:linear-gradient(135deg,var(--ms-brand),var(--ms-brand2));
      color:#fff; font-size:12px; font-weight:800;
      display:grid; place-items:center; margin-top:8px;
    }
    .ms-txt{flex:1}
    .ms-pager{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      margin-top:4px;
    }
    .ms-nav{
      font:inherit; cursor:pointer; border:0; border-radius:12px; padding:11px 16px;
      background:linear-gradient(135deg,var(--ms-brand),var(--ms-brand2));
      color:#fff; font-weight:800; box-shadow:0 10px 24px rgba(255,46,99,.28);
    }
    .ms-nav:disabled{opacity:.4; cursor:not-allowed; box-shadow:none; filter:grayscale(.4)}
    .ms-page-ind{color:var(--ms-muted); font-size:13px; font-weight:700}
    .ms-hadith{
      margin-top:18px; padding:16px 18px; border-radius:16px;
      background:var(--ms-card); border:1px solid var(--ms-stroke);
      text-align:center;
    }
    .ms-hadith-label{color:var(--ms-gold); font-size:12px; font-weight:800; margin-bottom:8px; letter-spacing:1px}
    .ms-hadith blockquote{font-size:15px; line-height:1.9; margin:0 0 8px}
    .ms-hadith cite{color:var(--ms-muted); font-size:12px; font-style:normal}
    .ms-status{text-align:center; color:var(--ms-muted); font-size:13px; min-height:20px; margin:8px 0}
    @media (max-width:640px){
      .ms-ayah{font-size:18px}
      .ms-leaf{padding:20px 14px 24px; min-height:360px}
    }
  </style>
  <div class="ms-wrap">
    <div class="ms-toolbar">
      <button type="button" id="ms-prev-surah">السورة السابقة</button>
      <select id="ms-surah" aria-label="اختر السورة"></select>
      <button type="button" id="ms-next-surah">السورة التالية</button>
    </div>
    <div class="ms-meta" id="ms-meta"></div>
    <div class="ms-status" id="ms-status">جاري التجهيز…</div>
    <div class="ms-book"><div class="ms-leaf" id="ms-leaf"></div></div>
    <div class="ms-pager" id="ms-pager"></div>
    <div class="ms-hadith" id="ms-hadith"></div>
  </div>
</div>`;
}

let scheduled = false;

export function initMushaf() {
  const root = document.getElementById('eagle-mushaf');
  if (!root) return;
  if (root.dataset.msReady === '1') return;
  root.dataset.msReady = '1';
  bind(root);
  loadSurahList(root)
    .then(() => loadSurah(1, root))
    .catch((err) => {
      paintStatus(root, 'تعذّر الاتصال بخادم القرآن.');
      console.warn('[mushaf]', err);
    });
}

export function scheduleMushaf() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    try { initMushaf(); } catch (e) { console.warn(e); }
  }, 120);
}


if (typeof window !== 'undefined') {
  window.__eagleMushafBoot = function (root) {
    if (!root) root = document.getElementById('eagle-mushaf');
    if (!root) return;
    root.dataset.msReady = '';
    try { initMushaf(); } catch (e) { console.warn(e); }
  };
}
