import { def } from './registry.js';
import { Navigation } from './categories.js';
import { svgIcon } from '../render/helpers.js';
import { escapeHtml } from '../core/util.js';

def({
  type: 'navbar', cat: Navigation, label: 'Navbar', icon: 'navbar', tag: 'nav', container: true,
  keywords: 'header menu top bar links icons navigation',
  defaults: {
    props: {
      brand: 'Eagle',
      brandEmoji: '🦅',
      brandLogo: 'IMAGES/eagle.png',
      links: 'Product, Solutions, Pricing, Docs',
      linkEmojis: '📦,✨,💳,📄',
      cta: 'Start free',
      ctaEmoji: '🚀',
      sticky: true,
    },
    style: { display: 'flex', dir: 'row', justify: 'space-between', align: 'center', w: '100%', pT: 18, pR: 32, pB: 18, pL: 32, bg: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', borderW: 1, borderStyle: 'solid', borderColor: '#eef2f7' },
    children: [
      {
        type: 'stack', name: 'Brand',
        style: { display: 'flex', dir: 'row', align: 'center', gap: 10 },
        children: [
          { type: 'image', name: 'Logo', props: { src: 'IMAGES/eagle.png', alt: 'Eagle' }, style: { w: 28, h: 28, radius: 8 } },
          { type: 'heading', name: 'Brand name', props: { text: 'Eagle', tag: 'span' }, style: { fontSize: 18, fontWeight: 800, color: '#0f172a' } },
        ],
      },
      {
        type: 'stack', name: 'Links',
        style: { display: 'flex', dir: 'row', align: 'center', gap: 22 },
        children: [
          { type: 'link', name: 'Product', props: { text: '📦 Product', href: '#' }, style: { fontSize: 14, color: '#475569' } },
          { type: 'link', name: 'Solutions', props: { text: '✨ Solutions', href: '#' }, style: { fontSize: 14, color: '#475569' } },
          { type: 'link', name: 'Pricing', props: { text: '💳 Pricing', href: '#' }, style: { fontSize: 14, color: '#475569' } },
          { type: 'link', name: 'Docs', props: { text: '📄 Docs', href: '#' }, style: { fontSize: 14, color: '#475569' } },
        ],
      },
      { type: 'button', name: 'CTA', props: { text: '🚀 Start free' }, style: { bg: '#0f172a', color: '#fff', radius: 10, pT: 10, pR: 18, pB: 10, pL: 18, fontSize: 14, fontWeight: 600 } },
    ],
  },
  fields: [
    { k: 'brand', l: 'Brand', t: 'text' },
    { k: 'brandEmoji', l: 'Brand emoji', t: 'text' },
    { k: 'brandLogo', l: 'Brand logo (from PC)', t: 'asset', accept: 'image' },
    { k: 'links', l: 'Links (comma-separated)', t: 'text' },
    { k: 'linkEmojis', l: 'Link emojis (comma-separated)', t: 'text' },
    { k: 'cta', l: 'CTA', t: 'text' },
    { k: 'ctaEmoji', l: 'CTA emoji', t: 'text' },
  ],
  render: (p) => {
    const linkNames = String(p.links || '').split(',').map((s) => s.trim()).filter(Boolean);
    const emojis = String(p.linkEmojis || '').split(',').map((s) => s.trim());
    const linksHtml = linkNames.map((l, i) => {
      const em = emojis[i] || '•';
      return '<li style="display:inline-flex;align-items:center;gap:6px"><a href="#" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:6px"><span style="font-size:14px;line-height:1">' + em + '</span>' + escapeHtml(l) + '</a></li>';
    }).join('');
    const brandMark = p.brandLogo
      ? '<img src="' + String(p.brandLogo).replace(/"/g, '') + '" alt="" style="width:26px;height:26px;border-radius:8px;object-fit:cover"/>'
      : '<span style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#0f172a,#334155);display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1">' + (p.brandEmoji || '🦅') + '</span>';
    return '<div style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.5px">'
      + brandMark + escapeHtml(p.brand || '') + '</div>'
      + '<ul style="display:flex;gap:22px;list-style:none;margin:0;padding:0;font-size:14px;color:#475569;font-family:inherit;align-items:center">'
      + linksHtml + '</ul>'
      + (p.cta ? '<a href="#" style="background:#0f172a;color:#fff;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:8px"><span>' + (p.ctaEmoji || '🚀') + '</span>' + escapeHtml(p.cta) + '</a>' : '');
  },
});

def({
  type: 'footer', cat: Navigation, label: 'Footer', icon: 'footer', tag: 'footer', container: true,
  keywords: 'bottom links copyright sitemap',
  defaults: {
    props: { brand: 'Lumen', columns: 'Product|Features\nCompany|About, Careers\nLegal|Privacy, Terms', note: '© 2026 Lumen. All rights reserved.' },
    style: { display: 'flex', dir: 'column', gap: 28, w: '100%', pT: 48, pR: 32, pB: 36, pL: 32, bg: '#0f172a', color: '#94a3b8' },
  },
  fields: [
    { k: 'brand', l: 'Brand', t: 'text' },
    { k: 'columns', l: 'Columns', t: 'csv', sep: '\n', pair: '|', item: 'column', short: 'Column', addLabel: '+ Add column group' },
    { k: 'note', l: 'Copyright', t: 'text' },
  ],
  render: (p) => '<div style="font-size:18px;font-weight:800;color:#f8fafc">' + escapeHtml(p.brand || '') + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px">'
    + String(p.columns || '').split('\n').map((row) => {
      const [head, links] = row.split('|');
      return '<div style="display:flex;flex-direction:column;gap:8px"><strong style="font-size:13px;color:#f8fafc">' + escapeHtml(head || '') + '</strong>'
        + String(links || '').split(',').map((l) => l.trim()).filter(Boolean)
          .map((l) => '<a href="#" style="color:#94a3b8;text-decoration:none;font-size:14px">' + escapeHtml(l) + '</a>').join('')
        + '</div>';
    }).join('')
    + '</div>'
    + (p.note ? '<div style="border-top:1px solid #1e293b;padding-top:20px;font-size:13px">' + escapeHtml(p.note) + '</div>' : ''),
});

def({
  type: 'breadcrumb', cat: Navigation, label: 'Breadcrumb', icon: 'breadcrumb', tag: 'nav',
  keywords: 'path trail hierarchy folder',
  defaults: {
    props: { items: 'Home, Products, Chair' },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 8, w: '100%', fontSize: 13, color: '#64748b', fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [{ k: 'items', l: 'Path', t: 'csv', item: 'crumb', short: 'Crumb' }],
  render: (p) => String(p.items || '').split(',').map((s) => s.trim()).filter(Boolean)
    .map((s, i, arr) => '<span>' + escapeHtml(s) + (i < arr.length - 1 ? '<span style="margin-left:8px;opacity:.5">/</span>' : '') + '</span>').join(''),
});

def({
  type: 'tabs', cat: Navigation, label: 'Tabs', icon: 'tabs', tag: 'div', container: true,
  keywords: 'tabbed switcher segmented panels',
  defaults: {
    props: { items: 'Overview, Specs, Reviews' },
    style: { display: 'flex', dir: 'column', gap: 0, w: '100%', maxW: 720 },
  },
  fields: [{ k: 'items', l: 'Tabs', t: 'csv', item: 'tab', short: 'Tab' }],
  render: (p) => {
    const arr = String(p.items || '').split(',').map((s) => s.trim()).filter(Boolean);
    return '<div role="tablist" style="display:flex;gap:4px;border-bottom:1px solid #e5e7eb">'
      + arr.map((t, i) => '<button type="button" role="tab" aria-selected="' + (i === 0) + '" style="background:' + (i === 0 ? '#0f172a' : 'transparent')
        + ';color:' + (i === 0 ? '#fff' : '#64748b') + ';border:0;border-radius:8px 8px 0 0;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">'
        + escapeHtml(t) + '</button>').join('')
      + '</div>'
      + '<div role="tabpanel" style="padding:18px 4px;font-size:14px;color:#64748b;font-family:inherit">Content for the first tab.</div>';
  },
});

def({
  type: 'accordion', cat: Navigation, label: 'Accordion', icon: 'accordion', tag: 'div', container: true,
  keywords: 'collapsible faq disclosure expand',
  defaults: {
    props: { items: 'What is it?|A visual builder for the web.\nIs it free?|Yes, with generous limits.\nCan I export?|HTML, React, Vue and more.' },
    style: { display: 'flex', dir: 'column', gap: 10, w: '100%', maxW: 720 },
  },
  fields: [{ k: 'items', l: 'Items', t: 'csv', sep: '\n', pair: '|', item: 'item', short: 'Item', addLabel: '+ Add question' }],
  render: (p) => String(p.items || '').split('\n').map((row) => row.trim()).filter(Boolean).map((row, i) => {
    const [q, a] = row.split('|');
    return '<details' + (i === 0 ? ' open' : '') + ' style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px">'
      + '<summary style="cursor:pointer;font-weight:600;font-size:15px;color:#0f172a;list-style:none;font-family:inherit">' + escapeHtml(q || '') + '</summary>'
      + '<p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.65;font-family:inherit">' + escapeHtml(a || '') + '</p></details>';
  }).join(''),
});

def({
  type: 'pagination', cat: Navigation, label: 'Pagination', icon: 'pagination', tag: 'nav',
  keywords: 'pager pages next prev',
  defaults: {
    props: { current: 2, total: 8 },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 6, justify: 'center' },
  },
  fields: [
    { k: 'current', l: 'Current', t: 'number' },
    { k: 'total', l: 'Total', t: 'number' },
  ],
  render: (p) => {
    const total = Math.max(1, Math.min(20, Number(p.total) || 5));
    const cur = Math.max(1, Math.min(total, Number(p.current) || 1));
    let out = '<a href="#" aria-label="Previous" style="padding:9px 12px;border:1px solid #e2e8f0;border-radius:10px;color:#64748b;text-decoration:none">‹</a>';
    for (let i = 1; i <= total; i += 1) {
      const on = i === cur;
      out += '<a href="#" aria-current="' + (on ? 'page' : 'false') + '" style="padding:9px 13px;border:1px solid ' + (on ? '#0f172a' : '#e2e8f0')
        + ';background:' + (on ? '#0f172a' : '#fff') + ';color:' + (on ? '#fff' : '#475569') + ';border-radius:10px;font-size:14px;font-weight:600;text-decoration:none">' + i + '</a>';
    }
    out += '<a href="#" aria-label="Next" style="padding:9px 12px;border:1px solid #e2e8f0;border-radius:10px;color:#64748b;text-decoration:none">›</a>';
    return out;
  },
});

def({
  type: 'stepper', cat: Navigation, label: 'Stepper', icon: 'stepper', tag: 'div',
  keywords: 'wizard steps progress stages',
  defaults: {
    props: { steps: 'Account, Details, Payment, Done', current: 2 },
    style: { display: 'flex', dir: 'row', align: 'center', justify: 'center', w: '100%' },
  },
  fields: [
    { k: 'steps', l: 'Steps', t: 'csv', item: 'step', short: 'Step' },
    { k: 'current', l: 'Current', t: 'number' },
  ],
  render: (p) => {
    const arr = String(p.steps || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cur = Number(p.current) || 1;
    return arr.map((s, i) => {
      const done = i + 1 < cur;
      const on = i + 1 === cur;
      return '<div style="display:flex;align-items:center;gap:10px' + (i < arr.length - 1 ? ';flex:1' : '') + '">'
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:70px">'
        + '<span style="width:30px;height:30px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;'
        + 'background:' + (done || on ? '#0f172a' : '#e2e8f0') + ';color:' + (done || on ? '#fff' : '#94a3b8') + '">'
        + (done ? svgIcon('check', 15) : String(i + 1)) + '</span>'
        + '<span style="font-size:12px;color:' + (on ? '#0f172a' : '#94a3b8') + ';font-weight:' + (on ? '700' : '500') + ';font-family:inherit">' + escapeHtml(s) + '</span></div>'
        + (i < arr.length - 1 ? '<span style="flex:1;height:2px;background:' + (done ? '#0f172a' : '#e2e8f0') + ';margin-bottom:22px"></span>' : '')
        + '</div>';
    }).join('');
  },
});

def({
  type: 'sidebar', cat: Navigation, label: 'Sidebar', icon: 'sidebar', tag: 'aside', container: true,
  keywords: 'drawer nav side menu',
  defaults: {
    props: { items: 'Dashboard\nProjects\nTeam\nSettings' },
    style: { display: 'flex', dir: 'column', gap: 4, w: 260, pT: 16, pR: 12, pB: 16, pL: 12, bg: '#f8fafc', borderW: 1, borderColor: '#e2e8f0', radius: 14 },
  },
  fields: [{ k: 'items', l: 'Items', t: 'csv', sep: '\n', item: 'item', short: 'Item' }],
  render: (p) => String(p.items || '').split('\n').map((s) => s.trim()).filter(Boolean)
    .map((s, i) => '<a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;font-size:14px;font-weight:'
      + (i === 0 ? '600' : '500') + ';color:' + (i === 0 ? '#0f172a' : '#64748b') + ';background:' + (i === 0 ? '#fff' : 'transparent')
      + ';text-decoration:none;border:1px solid ' + (i === 0 ? '#e2e8f0' : 'transparent') + '">' + svgIcon('layers', 17) + escapeHtml(s) + '</a>').join(''),
});

def({
  type: 'table', cat: Navigation, label: 'Table', icon: 'table', tag: 'table', container: true,
  keywords: 'grid rows data sheet',
  defaults: {
    props: { head: 'Name, Role, Status', rows: 'Alex Morgan, Designer, Active\nSara Ahmed, Engineer, Active\nTom Baker, Manager, Away' },
    style: { w: '100%', borderW: 1, borderStyle: 'solid', borderColor: '#e2e8f0', radius: 14, overflow: 'hidden', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [
    { k: 'head', l: 'Table', t: 'grid', head: 'head', rows: 'rows' },
  ],
  render: (p) => {
    const head = String(p.head || '').split(',').map((s) => s.trim());
    return '<table style="width:100%;border-collapse:collapse">'
      + '<thead><tr>' + head.map((h) => '<th style="text-align:left;padding:12px 16px;background:#f8fafc;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0">' + escapeHtml(h) + '</th>').join('') + '</tr></thead>'
      + '<tbody>' + String(p.rows || '').split('\n').map((row) => row.trim()).filter(Boolean)
        .map((row) => '<tr>' + row.split(',').map((c) => '<td style="padding:12px 16px;color:#334155;border-bottom:1px solid #f1f5f9">' + escapeHtml(c.trim()) + '</td>').join('') + '</tr>').join('')
      + '</tbody></table>';
  },
});


