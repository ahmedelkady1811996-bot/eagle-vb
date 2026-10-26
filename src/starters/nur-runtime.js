/**
 * The NUR platform runtime for the starter page.
 *
 * The NUR design used to export as a picture: the markup was imported into
 * editable blocks, but every element id was thrown away and the page's own
 * script was never carried across, so nothing was clickable. Ids are preserved
 * now (see io/htmlimport.js), and this is the script that drives them.
 *
 * Every entry point is guarded: a block the user deleted, or a page they
 * rebuilt from scratch, must degrade to "that module is not on this page" and
 * never to an exception in the console. That is the whole design rule here.
 */
export const NUR_RUNTIME_JS = `
/* ===================== NUR platform runtime ===================== */
(function () {
  'use strict';

  var $ = function (id) { try { return document.getElementById(id); } catch (e) { return null; } };
  var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); return !!el; };
  var setText = function (id, text) { var el = $(id); if (el) el.textContent = text; };
  var show = function (el, yes) { if (el) el.classList[yes ? 'remove' : 'add']('hidden'); };

  /* ---------- theme ---------- */
  function initTheme() {
    var root = document.documentElement;
    try {
      var light = localStorage.getItem('nur.theme') === 'light';
      root.classList.toggle('dark', !light);
      var btn = $('theme-toggle');
      if (btn) btn.addEventListener('click', function () {
        var nowDark = !root.classList.contains('dark');
        root.classList.toggle('dark', nowDark);
        try { localStorage.setItem('nur.theme', nowDark ? 'dark' : 'light'); } catch (e) {}
      });
    } catch (e) { /* private mode */ }
  }
  window.toggleNurTheme = function () {
    var root = document.documentElement;
    var nowDark = !root.classList.contains('dark');
    root.classList.toggle('dark', nowDark);
    try { localStorage.setItem('nur.theme', nowDark ? 'dark' : 'light'); } catch (e) {}
  };

  /* ---------- tabs ---------- */
  function switchTab(tabId) {
    var panels = document.querySelectorAll('.tab-panel');
    for (var i = 0; i < panels.length; i += 1) {
      var on_ = panels[i].id === 'tab-sec-' + tabId;
      panels[i].classList.toggle('hidden', !on_);
      panels[i].classList.toggle('block', on_);
    }
    var btns = document.querySelectorAll('[data-nur-tab]');
    for (var k = 0; k < btns.length; k += 1) {
      var active = btns[k].getAttribute('data-nur-tab') === tabId;
      btns[k].classList.toggle('is-active', active);
      btns[k].setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }
  window.switchNurTab = switchTab;
  function wireTabs() {
    var btns = document.querySelectorAll('[data-nur-tab]');
    for (var i = 0; i < btns.length; i += 1) {
      (function (btn) {
        btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-nur-tab')); });
      })(btns[i]);
    }
  }

  /* ---------- digital tasbih ---------- */
  var TASBIH = { count: 0, target: 33 };
  var DHIKR = {
    Subhanallah: { ar: 'سُبْحَانَ اللَّهِ', meaning: 'سبحان الله، من الحمد والتسبيح' },
    Alhamdulillah: { ar: 'الْحَمْدُ لِلَّهِ', meaning: 'الحمد لله، من الثناء والشكر' },
    AllahuAkbar: { ar: 'اللَّهُ أَكْبَرُ', meaning: 'الله أكبر، من التكبير والتحميد' },
    Astaghfirullah: { ar: 'أَسْتَغْفِرُ اللَّهَ', meaning: 'الاستغفار من Concurso على المغفرة' },
    LaIlahaIllallah: { ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ', meaning: 'لا إله إلا الله، من التوحيد' }
  };
  function paintTasbih() {
    setText('tasbih-counter', String(TASBIH.count));
    var bar = $('tasbih-progress-bar');
    if (bar) bar.style.width = Math.min(100, (TASBIH.count / TASBIH.target) * 100) + '%';
    setText('tasbih-target-val', String(TASBIH.target));
  }
  function incrementTasbihCount() {
    TASBIH.count += 1;
    if (TASBIH.count >= TASBIH.target) { TASBIH.count = 0; }
    paintTasbih();
    try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) {}
  }
  function resetTasbihCount() { TASBIH.count = 0; paintTasbih(); }
  function changeDhikrType() {
    var sel = $('dhikr-selector');
    if (!sel) return;
    var preset = DHIKR[sel.value];
    if (!preset) return;
    setText('tasbih-phrase-arabic', preset.ar);
    setText('tasbih-phrase-meaning', preset.meaning);
    resetTasbihCount();
  }
  window.incrementTasbihCount = incrementTasbihCount;
  window.resetTasbihCount = resetTasbihCount;
  window.changeDhikrType = changeDhikrType;

  /* ---------- qibla ---------- */
  function calculateQiblaDirection(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    var meccaLat = 21.4225 * Math.PI / 180;
    var meccaLng = 39.8262 * Math.PI / 180;
    var y = Math.sin(meccaLng - lng * Math.PI / 180);
    var x = Math.cos(lat * Math.PI / 180) * Math.tan(meccaLat)
      - Math.sin(lat * Math.PI / 180) * Math.cos(meccaLng - lng * Math.PI / 180);
    var deg = Math.atan2(y, x) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    setText('qibla-degree-val', Math.round(deg) + '\\u00b0');
    var needle = $('qibla-compass-needle');
    if (needle) needle.style.transform = 'rotate(' + deg + 'deg)';
  }
  window.calculateQiblaDirection = calculateQiblaDirection;

  /* ---------- prayer times ---------- */
  function initPrayerTimes(lat, lng, cityName) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    if (cityName) setText('city-display', cityName);
    var url = 'https://api.aladhan.com/v1/timings?latitude=' + lat + '&longitude=' + lng + '&method=5';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.data || !data.data.timings) return;
      var t = data.data.timings;
      var names = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
      var grid = $('prayer-cards-grid');
      if (grid) {
        grid.innerHTML = Object.keys(names).map(function (key) {
          return '<div class="p-4 rounded-2xl glass-card border p-4">'
            + '<span class="block text-xs font-bold text-slate-400 mb-1">' + names[key] + '</span>'
            + '<span class="text-lg font-black text-emerald-600">' + (t[key] || '--') + '</span></div>';
        }).join('');
      }
      setText('next-prayer-name', 'الفجر');
      setText('next-prayer-time-val', t.Fajr || '--');
      setText('next-prayer-countdown', t.Fajr || '--:--:--');
      calculateQiblaDirection(lat, lng);
    }).catch(function () { /* offline: leave the placeholders */ });
  }
  window.initPrayerTimes = initPrayerTimes;
  function wireLocation() {
    on('location-request', 'click', function () {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(function (pos) {
        initPrayerTimes(pos.coords.latitude, pos.coords.longitude, 'موقعك الحالي');
      }, function () { /* denied */ });
    });
  }

  /* ---------- mushaf pages ---------- */
  var MOSHAF_SERVERS = [
    function (p) { return 'https://quran.ksu.edu.eg/png_big/' + p + '.png'; },
    function (p) { return 'https://everyayah.com/data/quranimages/' + p + '.png'; },
    function (p) { return 'https://madani.quran.ws/svg/' + p + '.svg'; }
  ];
  var moshaf = { page: 1, cdn: 0, dual: false };
  function renderMoshafPage(num) {
    if (!isFinite(num)) return;
    num = Math.max(1, Math.min(604, Math.round(num)));
    moshaf.page = num;
    var img = $('moshaf-img-right');
    if (img) {
      img.onerror = function () {
        moshaf.cdn = (moshaf.cdn + 1) % MOSHAF_SERVERS.length;
        img.src = MOSHAF_SERVERS[moshaf.cdn](num);
      };
      img.src = MOSHAF_SERVERS[moshaf.cdn](num);
    }
    var input = $('moshaf-page-input');
    if (input) input.value = num;
    var slider = $('moshaf-slider');
    if (slider) slider.value = num;
    setText('moshaf-page-display', 'صفحة ' + num);
    setText('moshaf-juz-title', 'الجزء ' + Math.max(1, Math.min(30, Math.floor((num - 1) / 20.1) + 1)));
  }
  window.renderMoshafPage = renderMoshafPage;
  function mushafStep(d) {
    var step = moshaf.dual ? 2 * d : d;
    renderMoshafPage(moshaf.page + step);
  }
  window.prevMoshafPage = function () { mushafStep(-1); };
  window.nextMoshafPage = function () { mushafStep(1); };
  function wireMoshaf() {
    on('moshaf-prev', 'click', function () { mushafStep(-1); });
    on('moshaf-next', 'click', function () { mushafStep(1); });
    on('moshaf-page-input', 'change', function (ev) { renderMoshafPage(Number(ev.target.value)); });
    on('moshaf-slider', 'input', function (ev) { renderMoshafPage(Number(ev.target.value)); });
    on('moshaf-bookmark', 'click', function () {
      try { localStorage.setItem('nur_moshaf_last_page', String(moshaf.page)); } catch (e) {}
      setText('moshaf-bookmark-state', 'محفوظة: صفحة ' + moshaf.page);
    });
    var wrap = $('moshaf-images-wrapper');
    if (wrap) {
      var startX = 0;
      wrap.addEventListener('touchstart', function (e) { startX = e.changedTouches[0].screenX; }, { passive: true });
      wrap.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].screenX - startX;
        if (Math.abs(dx) < 50) return;
        mushafStep(dx > 0 ? -1 : 1);
      }, { passive: true });
    }
  }

  /* ---------- audio ---------- */
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function playAudioVerse(surah, ayah) {
    var url = 'https://everyayah.com/data/Alafasy_128kbps/' + pad(surah, 3) + pad(ayah, 3) + '.mp3';
    var audio = $('global-quran-audio');
    if (!audio) return;
    audio.src = url;
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked */ });
    var bar = $('sticky-audio-bar');
    if (bar) bar.classList.remove('translate-y-full');
    setText('player-title', 'سورة ' + surah + ' - آية ' + ayah);
  }
  window.playAudioVerse = playAudioVerse;
  window.closeAudioPlayerBar = function () {
    var a = $('global-quran-audio'); if (a) a.pause();
    var bar = $('sticky-audio-bar'); if (bar) bar.classList.add('translate-y-full');
  };

  /* ---------- hadith ---------- */
  var HADITH = [
    { id: 1, category: 'أخلاق', text: 'إنما أنا زينة، فخذوا من أدبي ما استطعتم', narrator: 'عمر بن الخطاب رضي الله عنه', source: 'القرآن والسنّة' },
    { id: 2, category: 'العلم', text: 'من سلك طريقا يلتمس فيه علما سهل الله له به طريقا إلى الجنة', narrator: 'مسلم بن الحجاج', source: 'صحيح مسلم' },
    { id: 3, category: 'الدعاء', text: 'لا يقولن أحدكم اللهم اغفر لي إن شئت، اللهم افعل ذلك إن شئت', narrator: 'أبو هريرة رضي الله عنه', source: 'صحيح البخاري' },
    { id: 4, category: 'العبادة', text: 'أحب الأعمال إلى الله أدومها وإن قل', narrator: 'عائشة رضي الله عنها', source: 'صحيح البخاري' },
    { id: 5, category: 'أخلاق', text: 'تهديهم إلى خير فافعل', narrator: 'ابن عمر رضي الله عنهما', source: 'متفق عليه' }
  ];
  function renderHadithList(list) {
    var grid = $('hadiths-grid');
    if (!grid) return;
    grid.innerHTML = list.map(function (h) {
      return '<div class="glass-panel p-6 flex flex-col justify-between">'
        + '<span class="inline-block text-xs font-bold mb-4">' + h.source + '</span>'
        + '<p class="leading-relaxed mb-4">«' + h.text + '»</p>'
        + '<div class="pt-3 border-t text-xs"><span>' + h.narrator + '</span></div></div>';
    }).join('');
  }
  window.renderHadithList = renderHadithList;
  window.filterHadiths = function (category) {
    renderHadithList(category === 'all'
      ? HADITH
      : HADITH.filter(function (h) { return h.category === category; }));
  };
  window.searchHadiths = function () {
    var input = $('hadith-search-input');
    if (!input) return;
    var q = input.value.trim();
    renderHadithList(q ? HADITH.filter(function (h) {
      return h.text.indexOf(q) >= 0 || h.narrator.indexOf(q) >= 0;
    }) : HADITH);
  };

  /* ---------- boot ---------- */
  function boot() {
    initTheme();
    wireTabs();
    wireMoshaf();
    wireLocation();
    paintTasbih();
    renderHadithList(HADITH);
    var saved = 0;
    try { saved = Number(localStorage.getItem('nur_moshaf_last_page') || 0); } catch (e) {}
    renderMoshafPage(saved > 1 ? saved : 1);
    initPrayerTimes(30.0444, 31.2357, 'القاهرة');
    /* Any element that opted into inline actions keeps working after an edit. */
    var wired = document.querySelectorAll('[data-nur-action]');
    for (var i = 0; i < wired.length; i += 1) {
      (function (el) {
        el.addEventListener('click', function () {
          var fn = el.getAttribute('data-nur-action');
          if (typeof window[fn] === 'function') window[fn]();
        });
      })(wired[i]);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`;