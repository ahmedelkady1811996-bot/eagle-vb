import { def } from './registry.js';
import { Data } from './categories.js';
import { escapeHtml } from '../core/util.js';

function bars(values, tone) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return '<div style="display:flex;align-items:flex-end;gap:' + Math.max(4, 100 / values.length / 3) + '%;height:100%">'
    + values.map((v) => '<div style="flex:1;height:' + (Math.abs(v) / max) * 100 + '%;background:' + tone
      + ';border-radius:5px 5px 2px 2px;min-height:3px"></div>').join('') + '</div>';
}

def({
  type: 'chart', cat: Data, label: 'Chart', icon: 'chart', tag: 'figure',
  keywords: 'graph analytics bars line pie data viz',
  defaults: {
    props: { title: 'Monthly revenue', series: '42,58,74,68,91,108', labels: 'Jan, Feb, Mar, Apr, May, Jun', kind: 'bar', tone: '#6366f1' },
    style: { display: 'flex', dir: 'column', gap: 16, w: '100%', maxW: 560, pT: 22, pR: 22, pB: 22, pL: 22, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 16 },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'kind', l: 'Type', t: 'select', opts: ['bar', 'line', 'area'] },
    { k: 'series', l: 'Values', t: 'csv', item: 'value', short: 'Value' },
    { k: 'labels', l: 'Labels', t: 'csv', item: 'label', short: 'Label' },
    { k: 'tone', l: 'Color', t: 'color' },
  ],
  render: (p) => {
    const vals = String(p.series || '').split(',').map((s) => parseFloat(s.trim()) || 0);
    const labels = String(p.labels || '').split(',').map((s) => s.trim());
    const tone = p.tone || '#6366f1';
    let plot;
    if (p.kind === 'bar') {
      plot = bars(vals, tone);
    } else {
      const max = Math.max(1, ...vals);
      const min = Math.min(0, ...vals);
      const span = max - min || 1;
      const pts = vals.map((v, i) => (i / Math.max(1, vals.length - 1)) * 100 + ',' + (100 - ((v - min) / span) * 90 - 5)).join(' ');
      const areaPts = '0,100 ' + pts + ' 100,100';
      plot = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">'
        + (p.kind === 'area' ? '<polygon points="' + areaPts + '" fill="' + tone + '" opacity=".16"></polygon>' : '')
        + '<polyline points="' + pts + '" fill="none" stroke="' + tone + '" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"></polyline>'
        + vals.map((v, i) => '<circle cx="' + (i / Math.max(1, vals.length - 1)) * 100 + '" cy="' + (100 - ((v - min) / span) * 90 - 5) + '" r="1.6" fill="#fff" stroke="' + tone + '" stroke-width="1.2" vector-effect="non-scaling-stroke"></circle>').join('')
        + '</svg>';
    }
    return '<figcaption style="font-size:15px;font-weight:600;color:#0f172a;font-family:inherit">' + escapeHtml(p.title || '') + '</figcaption>'
      + '<div style="height:180px">' + plot + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;font-family:inherit">'
      + labels.map((l) => '<span>' + escapeHtml(l) + '</span>').join('') + '</div>';
  },
});

def({
  type: 'donut', cat: Data, label: 'Donut chart', icon: 'chart', tag: 'figure',
  keywords: 'pie circle split percentage',
  defaults: {
    props: { title: 'Traffic sources', parts: 'Direct 46, Search 32, Social 22', tone: '#6366f1' },
    style: { display: 'flex', dir: 'column', gap: 16, align: 'center', w: '100%', maxW: 340 },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'parts', l: 'Parts', t: 'textarea' },
    { k: 'tone', l: 'Base color', t: 'color' },
  ],
  render: (p) => {
    const parts = String(p.parts || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [label, num] = s.split(/\s+/);
      return { label, value: parseFloat(num) || 0 };
    });
    const total = parts.reduce((a, b) => a + b.value, 0) || 1;
    const tones = [p.tone || '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
    let acc = 0;
    const stops = parts.map((part, i) => {
      const from = acc;
      acc += (part.value / total) * 100;
      return tones[i % tones.length] + ' ' + from + '% ' + acc + '%';
    }).join(',');
    return '<div style="width:160px;height:160px;border-radius:999px;background:conic-gradient(' + stops + ');position:relative">'
      + '<div style="position:absolute;inset:26px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#0f172a">'
      + Math.round((parts[0] ? parts[0].value / total : 0) * 100) + '%</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;width:100%">'
      + parts.map((part, i) => '<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#475569;font-family:inherit">'
        + '<span style="width:10px;height:10px;border-radius:3px;background:' + tones[i % tones.length] + '"></span>'
        + escapeHtml(part.label) + '<strong style="margin-left:auto;color:#0f172a">' + Math.round((part.value / total) * 100) + '%</strong></div>').join('')
      + '</div>';
  },
});

def({
  type: 'sparkline', cat: Data, label: 'Sparkline', icon: 'chart', tag: 'span',
  keywords: 'trend mini inline chart',
  defaults: {
    props: { series: '12,18,14,22,30,26,34', tone: '#10b981' },
    style: { display: 'inline-flex', w: 120, h: 36 },
  },
  fields: [{ k: 'series', l: 'Values', t: 'csv', item: 'value', short: 'Value' }, { k: 'tone', l: 'Color', t: 'color' }],
  render: (p) => {
    const vals = String(p.series || '').split(',').map((s) => parseFloat(s.trim()) || 0);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const span = max - min || 1;
    const pts = vals.map((v, i) => (i / Math.max(1, vals.length - 1)) * 100 + ',' + (100 - ((v - min) / span) * 90 - 5)).join(' ');
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible">'
      + '<polyline points="' + pts + '" fill="none" stroke="' + (p.tone || '#10b981') + '" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>';
  },
});

def({
  type: 'avatarRow', cat: Data, label: 'Member list', icon: 'users', tag: 'div',
  keywords: 'people list team roster',
  defaults: {
    props: { people: 'Alex Morgan — Product\nSara Ahmed — Engineering\nTom Baker — Design' },
    style: { display: 'flex', dir: 'column', gap: 12, w: '100%', maxW: 420 },
  },
  fields: [{ k: 'people', l: 'People', t: 'textarea' }],
  render: (p) => {
    const tones = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b'];
    return String(p.people || '').split('\n').map((row, i) => row.trim()).filter(Boolean).map((row, i) => {
      const [name, role] = row.split(/\s+—\s+|—|-{2,}/);
      return '<div style="display:flex;align-items:center;gap:12px">'
        + '<span style="width:38px;height:38px;border-radius:999px;background:' + tones[i % tones.length] + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:14px">'
        + escapeHtml((name || '?').trim().split(' ').map((w) => w[0]).slice(0, 2).join('')) + '</span>'
        + '<span style="display:flex;flex-direction:column"><strong style="font-size:14px;color:#0f172a">' + escapeHtml((name || '').trim()) + '</strong>'
        + '<span style="font-size:12px;color:#94a3b8">' + escapeHtml((role || '').trim()) + '</span></span></div>';
    }).join('');
  },
});

def({
  type: 'map', cat: Data, label: 'Map', icon: 'map', tag: 'div',
  keywords: 'location place geo embed',
  defaults: {
    props: { city: 'Cairo', zoom: 12 },
    style: { w: '100%', h: 280, radius: 16, overflow: 'hidden', bg: '#e2e8f0' },
  },
  fields: [
    { k: 'city', l: 'Place', t: 'text' },
    { k: 'zoom', l: 'Zoom', t: 'number' },
  ],
  render: (p) => '<iframe title="Map of ' + escapeHtml(p.city || '') + '" src="https://www.openstreetmap.org/export/embed.html?bbox=31.1%2C29.9%2C31.4%2C30.1&layer=mapnik&marker=30.0444%2C31.2357" style="width:100%;height:100%;border:0"></iframe>',
});

def({
  type: 'clock', cat: Data, label: 'Live clock', icon: 'clock', tag: 'span',
  keywords: 'time timer now realtime',
  defaults: {
    props: { format: 'h:m', tz: '' },
    style: { fontSize: 32, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' },
  },
  fields: [{ k: 'format', l: 'Format', t: 'select', opts: ['h:m', 'h:m:s', 'H:i', 'full'] }],
  render: (p) => '<span class="vb-clock" data-fmt="' + escapeHtml(p.format || 'h:m') + '">--:--</span>',
});

def({
  type: 'countdown', cat: Data, label: 'Countdown', icon: 'clock', tag: 'div',
  keywords: 'timer deadline offer ends',
  defaults: {
    props: { days: 5, hours: 12, minutes: 30 },
    style: { display: 'flex', dir: 'row', gap: 12, justify: 'center' },
  },
  fields: [
    { k: 'days', l: 'Days', t: 'number' },
    { k: 'hours', l: 'Hours', t: 'number' },
    { k: 'minutes', l: 'Minutes', t: 'number' },
  ],
  render: () => ['Days', 'Hours', 'Minutes'].map((label, i) => '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:74px;padding:14px;background:#0f172a;border-radius:14px;color:#fff">'
    + '<strong class="vb-countdown-n" style="font-size:30px;font-weight:800;font-variant-numeric:tabular-nums">' + [2, 1, 0][i] + '</strong>'
    + '<span style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;opacity:.6">' + label + '</span></div>').join(''),
});

def({
  type: 'qr', cat: Data, label: 'QR code', icon: 'qr', tag: 'div',
  keywords: 'scan barcode link',
  defaults: {
    props: { text: 'https://example.com', size: 140 },
    style: { display: 'flex', justify: 'center', align: 'center' },
  },
  fields: [
    { k: 'text', l: 'Content', t: 'text' },
    { k: 'size', l: 'Size', t: 'number' },
  ],
  render: (p) => '<div class="vb-qr" data-text="' + escapeHtml(p.text || '') + '" style="width:' + (Number(p.size) || 140)
    + 'px;height:' + (Number(p.size) || 140) + 'px;background:repeating-conic-gradient(#0f172a 0% 25%,#fff 0% 50%) 50%/14px 14px;border:8px solid #fff;border-radius:8px"></div>',
});

def({
  type: 'htmlEmbed', cat: Data, label: 'HTML Embed', icon: 'code', tag: 'div',
  keywords: 'html custom widget embed mushaf quran',
  defaults: {
    props: { html: '<div style="padding:24px;color:#64748b">HTML</div>', editable: true },
    style: { w: '100%', overflow: 'auto', minH: 200 },
  },
  fields: [
    { k: 'html', l: 'HTML', t: 'textarea', rows: 10 },
    { k: 'sourceName', l: 'Source file', t: 'text' },
  ],
  render: (p) => String(p.html || ''),
});

/** Full-fidelity page stage: preserves styles/fonts/layout like the browser while staying one selectable block. */
def({
  type: 'htmlStage', cat: Data, label: 'HTML Page', icon: 'code', tag: 'div',
  keywords: 'html page import website canvas fidelity browser',
  container: false,
  defaults: {
    props: {
      bodyHtml: '',
      headCss: '',
      sourceName: '',
      editable: true,
    },
    style: {
      w: '100%',
      minH: 900,
      overflow: 'auto',
      bg: 'transparent',
      radius: 0,
    },
  },
  fields: [
    { k: 'sourceName', l: 'Source', t: 'text' },
    { k: 'headCss', l: 'Page CSS', t: 'textarea', rows: 6 },
    { k: 'bodyHtml', l: 'Body HTML', t: 'textarea', rows: 12 },
  ],
  render: (p) => {
    const css = String(p.headCss || '');
    const body = String(p.bodyHtml || '');
    // Scope styles under .vb-html-stage so they don't leak into the builder chrome
    const scoped = css
      ? '<style data-vb-stage>' + css
          .replace(/:root\b/g, '.vb-html-stage')
          .replace(/\bhtml\b/g, '.vb-html-stage')
          .replace(/\bbody\b/g, '.vb-html-stage')
        + '</style>'
      : '';
    return '<div class="vb-html-stage" style="width:100%;min-height:100%;box-sizing:border-box;position:relative">'
      + scoped + body + '</div>';
  },
});



