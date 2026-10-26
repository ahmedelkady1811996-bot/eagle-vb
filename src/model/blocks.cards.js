import { def } from './registry.js';
import { Cards } from './categories.js';
import { svgIcon, img } from '../render/helpers.js';
import { escapeHtml } from '../core/util.js';

const cardShell = 'background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;';
const titleStyle = 'font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px;font-family:inherit;';
const bodyStyle = 'font-size:14px;line-height:1.65;color:#64748b;margin:0;font-family:inherit;';

def({
  type: 'card', cat: Cards, label: 'Card', icon: 'card', tag: 'article', container: true,
  keywords: 'panel box tile surface',
  defaults: {
    props: { title: 'Card title', text: 'A short description that explains what this card is about.', action: '' },
    style: { display: 'flex', dir: 'column', gap: 10, w: '100%', maxW: 380, pT: 24, pR: 24, pB: 24, pL: 24, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 16, shadow: '0 1px 3px rgba(0,0,0,.06)' },
    children: [
      { type: 'heading', name: 'Title', props: { text: 'Card title', tag: 'h3' }, style: { fontSize: 18, fontWeight: 700, color: '#0f172a' } },
      { type: 'paragraph', name: 'Body', props: { text: 'A short description that explains what this card is about.' }, style: { fontSize: 14, color: '#64748b' } },
      { type: 'link', name: 'Action', props: { text: 'Learn more →', href: '#' }, style: { color: '#6366f1', fontWeight: 600, fontSize: 14, mT: 6 } },
    ],
  },
  states: { hover: { transform: 'translateY(-3px)', shadow: '0 12px 28px rgba(15,23,42,.12)' } },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Body', t: 'textarea' },
    { k: 'action', l: 'Action label', t: 'text' },
  ],
  render: (p) => '<h3 style="' + titleStyle + '">' + escapeHtml(p.title || '') + '</h3>'
    + '<p style="' + bodyStyle + '">' + escapeHtml(p.text || '') + '</p>'
    + (p.action ? '<a href="#" class="vb-card-action" style="margin-top:6px;font-size:14px;font-weight:600;color:#6366f1;text-decoration:none">' + escapeHtml(p.action) + ' →</a>' : ''),
});

def({
  type: 'featureCard', cat: Cards, label: 'Feature card', icon: 'feature', tag: 'article', container: true,
  keywords: 'benefit value icon feature',
  defaults: {
    props: { icon: 'bolt', title: 'Blazing fast', text: 'Optimised rendering keeps everything smooth at any size.' },
    style: { display: 'flex', dir: 'column', gap: 12, w: '100%', maxW: 340, pT: 28, pR: 28, pB: 28, pL: 28, bg: '#ffffff', borderW: 1, borderColor: '#e9edf3', radius: 18 },
    children: [
      { type: 'icon', name: 'Icon', props: { icon: 'bolt' }, style: { w: 46, h: 46, radius: 13, bg: '#eef2ff', color: '#6366f1' } },
      { type: 'heading', name: 'Title', props: { text: 'Blazing fast', tag: 'h3' }, style: { fontSize: 18, fontWeight: 700, color: '#0f172a' } },
      { type: 'paragraph', name: 'Body', props: { text: 'Optimised rendering keeps everything smooth at any size.' }, style: { fontSize: 14, color: '#64748b' } },
    ],
  },
  states: { hover: { transform: 'translateY(-4px)', shadow: '0 16px 34px rgba(15,23,42,.10)' } },
  fields: [
    { k: 'icon', l: 'Icon', t: 'icon' },
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Body', t: 'textarea' },
  ],
  render: (p) => '<span class="vb-ico-box" style="width:46px;height:46px;border-radius:13px;background:#eef2ff;color:#6366f1;display:inline-flex;align-items:center;justify-content:center">' + svgIcon(p.icon, 22) + '</span>'
    + '<h3 style="' + titleStyle + '">' + escapeHtml(p.title || '') + '</h3>'
    + '<p style="' + bodyStyle + '">' + escapeHtml(p.text || '') + '</p>',
});

def({
  type: 'statCard', cat: Cards, label: 'Stat card', icon: 'stat', tag: 'article', container: true,
  keywords: 'metric number kpi dashboard',
  defaults: {
    props: { value: '12,480', label: 'Happy customers', delta: '+18%', tone: '#10b981' },
    style: { display: 'flex', dir: 'column', gap: 6, w: '100%', maxW: 260, pT: 22, pR: 22, pB: 22, pL: 22, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 16 },
    children: [
      { type: 'heading', name: 'Value', props: { text: '12,480', tag: 'h2' }, style: { fontSize: 34, fontWeight: 800, color: '#0f172a' } },
      { type: 'label', name: 'Label', props: { text: 'Happy customers' }, style: { fontSize: 14, color: '#64748b' } },
      { type: 'label', name: 'Delta', props: { text: '+18%' }, style: { fontSize: 13, fontWeight: 600, color: '#10b981' } },
    ]
  },
  fields: [
    { k: 'value', l: 'Value', t: 'text' },
    { k: 'label', l: 'Label', t: 'text' },
    { k: 'delta', l: 'Change', t: 'text' },
    { k: 'tone', l: 'Trend color', t: 'color' },
  ],
  render: (p) => '<div style="font-size:34px;font-weight:800;color:#0f172a;letter-spacing:-1;line-height:1;font-family:inherit">' + escapeHtml(p.value || '') + '</div>'
    + '<div style="' + bodyStyle + '">' + escapeHtml(p.label || '') + '</div>'
    + (p.delta ? '<div style="font-size:13px;font-weight:600;color:' + (p.tone || '#10b981') + ';margin-top:2px">' + escapeHtml(p.delta) + '</div>' : ''),
});

def({
  type: 'testimonialCard', cat: Cards, label: 'Testimonial', icon: 'testimonial', tag: 'figure', container: true,
  keywords: 'review quote customer social proof',
  defaults: {
    props: { text: 'We shipped our new site in a weekend. The output was production ready on day one.', name: 'Sara Ahmed', role: 'Founder, Northwind', rating: 5 },
    style: { display: 'flex', dir: 'column', gap: 16, w: '100%', maxW: 420, pT: 28, pR: 28, pB: 28, pL: 28, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 18 },
    children: [
      { type: 'quote', name: 'Quote', props: { text: 'We shipped our new site in a weekend. The output was production ready on day one.' }, style: { fontSize: 16, color: '#1e293b' } },
      { type: 'label', name: 'Name', props: { text: 'Sara Ahmed' }, style: { fontSize: 14, fontWeight: 700, color: '#0f172a' } },
      { type: 'label', name: 'Role', props: { text: 'Founder, Northwind' }, style: { fontSize: 13, color: '#64748b' } },
    ]
  },
  states: { hover: { shadow: '0 14px 32px rgba(15,23,42,.10)' } },
  fields: [
    { k: 'text', l: 'Quote', t: 'textarea' },
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'role', l: 'Role', t: 'text' },
    { k: 'rating', l: 'Rating', t: 'number' },
  ],
  render: (p) => {
    const stars = Math.max(0, Math.min(5, Number(p.rating) || 5));
    let starsHtml = '<div class="vb-stars" style="display:flex;gap:3px;color:#f59e0b">';
    for (let i = 0; i < stars; i += 1) starsHtml += svgIcon('star', 16).replace('fill="none"', 'fill="currentColor"');
    starsHtml += '</div>';
    return '<blockquote style="margin:0;font-size:16px;line-height:1.65;color:#1e293b;font-family:inherit">' + escapeHtml(p.text || '') + '</blockquote>'
      + starsHtml
      + '<figcaption style="display:flex;align-items:center;gap:12px">'
      + '<span class="vb-avatar-sm" style="background:#6366f1;color:#fff;width:40px;height:40px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-weight:600">'
      + escapeHtml((p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')) + '</span>'
      + '<span><strong style="display:block;font-size:14px;color:#0f172a">' + escapeHtml(p.name || '') + '</strong>'
      + '<span style="font-size:13px;color:#94a3b8">' + escapeHtml(p.role || '') + '</span></span>'
      + '</figcaption>';
  },
});

def({
  type: 'pricingCard', cat: Cards, label: 'Pricing card', icon: 'pricing', tag: 'article', container: true,
  keywords: 'plan price subscription tier',
  defaults: {
    props: { plan: 'Pro', price: '29', period: 'month', features: 'Everything in Starter\nPriority support\nCustom domain', cta: 'Choose Pro', featured: true },
    style: { display: 'flex', dir: 'column', gap: 14, w: '100%', maxW: 340, pT: 30, pR: 28, pB: 30, pL: 28, bg: '#ffffff', borderW: 2, borderColor: '#6366f1', radius: 20, shadow: '0 18px 40px rgba(99,102,241,.18)' },
    children: [
      { type: 'label', name: 'Plan', props: { text: 'Pro' }, style: { fontSize: 13, fontWeight: 700, color: '#6366f1', textCase: 'uppercase', letterSpacing: 1 } },
      { type: 'heading', name: 'Price', props: { text: '$29', tag: 'h2' }, style: { fontSize: 40, fontWeight: 800, color: '#0f172a' } },
      { type: 'paragraph', name: 'Period', props: { text: 'per month' }, style: { fontSize: 13, color: '#64748b' } },
      { type: 'list', name: 'Features', props: { items: ['Everything in Starter', 'Priority support', 'Custom domain'], style: 'bullet' }, style: { fontSize: 14, color: '#334155' } },
      { type: 'button', name: 'CTA', props: { text: 'Choose Pro' }, style: { bg: '#6366f1', color: '#ffffff', pT: 12, pR: 20, pB: 12, pL: 20, radius: 12, fontWeight: 600, mT: 8 } },
    ],
  },
  states: { hover: { transform: 'translateY(-4px)' } },
  fields: [
    { k: 'plan', l: 'Plan name', t: 'text' },
    { k: 'price', l: 'Price', t: 'text' },
    { k: 'period', l: 'Period', t: 'text' },
    { k: 'features', l: 'Features', t: 'csv', sep: '\n', item: 'feature', short: 'Feature' },
    { k: 'cta', l: 'Button label', t: 'text' },
  ],
  render: (p) => '<div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:14px;font-weight:600;color:#64748b">'
    + escapeHtml(p.plan || '') + '</span><span style="font-size:42px;font-weight:800;color:#0f172a;letter-spacing:-1.5px">$' + escapeHtml(p.price || '0') + '</span>'
    + '<span style="font-size:14px;color:#94a3b8">/' + escapeHtml(p.period || 'month') + '</span></div>'
    + '<ul class="vb-list-check" style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;font-size:14px;color:#475569;font-family:inherit">'
    + String(p.features || '').split('\n').map((s) => s.trim()).filter(Boolean)
      .map((f) => '<li style="display:flex;gap:8px;align-items:flex-start"><span style="color:#10b981;flex-shrink:0">' + svgIcon('check', 16) + '</span>' + escapeHtml(f) + '</li>').join('')
    + '</ul>'
    + '<a href="#" class="vb-btn vb-btn--primary" style="margin-top:6px;background:#6366f1;color:#fff;border-radius:10px;padding:13px;text-align:center;font-weight:600;text-decoration:none;display:block">'
    + escapeHtml(p.cta || 'Choose plan') + '</a>',
});

def({
  type: 'productCard', cat: Cards, label: 'Product card', icon: 'box', tag: 'article', container: true,
  keywords: 'ecommerce shop item buy',
  defaults: {
    props: { name: 'Aurora Desk Lamp', price: '$129', oldPrice: '$179', src: '', rating: 4.5, badge: 'Sale' },
    style: { display: 'flex', dir: 'column', gap: 12, w: '100%', maxW: 280, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 16, overflow: 'hidden' },
    children: [
      { type: 'image', name: 'Photo', props: { src: '', alt: 'Product' }, style: { w: '100%', h: 180, radius: 12, bg: '#f1f5f9' } },
      { type: 'heading', name: 'Title', props: { text: 'Product name', tag: 'h3' }, style: { fontSize: 18, fontWeight: 700, color: '#0f172a' } },
      { type: 'paragraph', name: 'Price', props: { text: '$49' }, style: { fontSize: 16, fontWeight: 700, color: '#6366f1' } },
      { type: 'button', name: 'Buy', props: { text: 'Add to cart' }, style: { bg: '#0f172a', color: '#fff', radius: 10, pT: 10, pR: 16, pB: 10, pL: 16 } },
    ]
  },
  states: { hover: { shadow: '0 14px 30px rgba(15,23,42,.12)' } },
  fields: [
    { k: 'name', l: 'Product', t: 'text' },
    { k: 'price', l: 'Price', t: 'text' },
    { k: 'oldPrice', l: 'Compare price', t: 'text' },
    { k: 'src', l: 'Image', t: 'asset', accept: 'image' },
    { k: 'badge', l: 'Badge', t: 'text' },
  ],
  render: (p) => '<div style="position:relative">' + img(p.src, p.name, 'vb-img')
    + (p.badge ? '<span style="position:absolute;top:10px;left:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px">' + escapeHtml(p.badge) + '</span>' : '')
    + '</div>'
    + '<div style="padding:0 16px 18px;display:flex;flex-direction:column;gap:6px">'
    + '<div style="font-size:15px;font-weight:600;color:#0f172a">' + escapeHtml(p.name || '') + '</div>'
    + '<div style="display:flex;align-items:baseline;gap:8px"><strong style="font-size:17px;color:#0f172a">' + escapeHtml(p.price || '') + '</strong>'
    + (p.oldPrice ? '<span style="font-size:13px;color:#94a3b8;text-decoration:line-through">' + escapeHtml(p.oldPrice) + '</span>' : '') + '</div>'
    + '</div>',
});

def({
  type: 'teamCard', cat: Cards, label: 'Team card', icon: 'users', tag: 'article', container: true,
  keywords: 'people member staff about',
  defaults: {
    props: { name: 'Alex Morgan', role: 'Head of Design', src: '' },
    style: { display: 'flex', dir: 'column', gap: 12, align: 'center', justify: 'center', w: '100%', maxW: 220, pT: 28, pR: 20, pB: 28, pL: 20, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 18, textAlign: 'center' },
    children: [
      { type: 'avatar', name: 'Avatar', props: { name: 'Alex Rivera' }, style: { w: 64, h: 64, radius: 999 } },
      { type: 'heading', name: 'Name', props: { text: 'Alex Rivera', tag: 'h3' }, style: { fontSize: 17, fontWeight: 700, color: '#0f172a' } },
      { type: 'label', name: 'Role', props: { text: 'Product Designer' }, style: { fontSize: 13, color: '#64748b' } },
    ]
  },
  states: { hover: { transform: 'translateY(-3px)' } },
  fields: [
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'role', l: 'Role', t: 'text' },
    { k: 'src', l: 'Photo', t: 'asset', accept: 'image' },
  ],
  render: (p) => '<span class="vb-avatar" style="width:88px;height:88px;border-radius:999px;background:#eef2ff;color:#6366f1;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;overflow:hidden">'
    + (p.src ? img(p.src, p.name, 'vb-avatar-img') : escapeHtml((p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join(''))) + '</span>'
    + '<strong style="font-size:16px;color:#0f172a">' + escapeHtml(p.name || '') + '</strong>'
    + '<span style="font-size:13px;color:#94a3b8">' + escapeHtml(p.role || '') + '</span>',
});

def({
  type: 'faqItem', cat: Cards, label: 'FAQ item', icon: 'question', tag: 'details',
  keywords: 'accordion question answer help',
  defaults: {
    props: { question: 'How long does it take to get started?', answer: 'Less than a minute. Pick a block, edit the text, and export.' },
    style: { w: '100%', maxW: 720, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', radius: 14, pT: 18, pR: 20, pB: 18, pL: 20 },
  },
  states: { hover: { borderColor: '#c7d2fe' } },
  fields: [
    { k: 'question', l: 'Question', t: 'text' },
    { k: 'answer', l: 'Answer', t: 'textarea' },
  ],
  render: (p) => '<summary style="cursor:pointer;font-size:16px;font-weight:600;color:#0f172a;list-style:none;font-family:inherit">' + escapeHtml(p.question || '') + '</summary>'
    + '<p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#64748b;font-family:inherit">' + escapeHtml(p.answer || '') + '</p>',
});

def({
  type: 'timelineItem', cat: Cards, label: 'Timeline item', icon: 'timeline', tag: 'div',
  keywords: 'steps history progress road',
  defaults: {
    props: { title: 'Kickoff', text: 'Align on goals and scope.', tone: '#6366f1', done: true },
    style: { display: 'flex', dir: 'row', gap: 16, w: '100%', maxW: 520 },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Description', t: 'textarea' },
    { k: 'tone', l: 'Color', t: 'color' },
    { k: 'done', l: 'Completed', t: 'check' },
  ],
  render: (p) => '<span style="flex-shrink:0;width:14px;height:14px;border-radius:999px;background:' + (p.done ? (p.tone || '#6366f1') : '#e2e8f0') + ';margin-top:4px;box-shadow:0 0 0 4px ' + (p.tone || '#6366f1') + '22"></span>'
    + '<div style="display:flex;flex-direction:column;gap:4px"><strong style="font-size:15px;color:#0f172a">' + escapeHtml(p.title || '') + '</strong>'
    + '<span style="font-size:14px;color:#64748b;line-height:1.6">' + escapeHtml(p.text || '') + '</span></div>',
});

def({
  type: 'alert', cat: Cards, label: 'Alert', icon: 'alert', tag: 'div',
  keywords: 'notice warning info banner message',
  defaults: {
    props: { title: 'Heads up', text: 'Your trial ends in 3 days. Upgrade to keep your projects.', tone: 'info', dismissible: true },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 14, w: '100%', pT: 16, pR: 18, pB: 16, pL: 18, radius: 12, bg: '#eff6ff', borderW: 1, borderColor: '#bfdbfe', color: '#1e40af' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Message', t: 'textarea' },
    { k: 'tone', l: 'Tone', t: 'select', opts: ['info', 'success', 'warning', 'danger'] },
    { k: 'dismissible', l: 'Dismissible', t: 'check' },
  ],
  render: (p) => {
    const tones = {
      info: ['#eff6ff', '#bfdbfe', '#1e40af'],
      success: ['#ecfdf5', '#a7f3d0', '#065f46'],
      warning: ['#fffbeb', '#fde68a', '#92400e'],
      danger: ['#fef2f2', '#fecaca', '#991b1b'],
    };
    const c = tones[p.tone] || tones.info;
    const ic = { info: 'chat', success: 'check', warning: 'bolt', danger: 'close' }[p.tone] || 'chat';
    return '<span style="color:' + c[2] + ';flex-shrink:0;display:inline-flex">' + svgIcon(ic, 20) + '</span>'
      + '<div style="display:flex;flex-direction:column;gap:2px;flex:1"><strong style="font-size:14px">' + escapeHtml(p.title || '') + '</strong>'
      + '<span style="font-size:13px;opacity:.9">' + escapeHtml(p.text || '') + '</span></div>'
      + (p.dismissible ? '<button type="button" class="vb-alert-x" style="background:none;border:0;color:inherit;cursor:pointer;font-size:18px;line-height:1;opacity:.6">×</button>' : '');
  },
});

def({
  type: 'progress', cat: Cards, label: 'Progress', icon: 'progress', tag: 'div',
  keywords: 'bar loading percent meter',
  defaults: {
    props: { value: 68, tone: '#6366f1', label: 'Uploading' },
    style: { display: 'flex', dir: 'column', gap: 8, w: '100%', maxW: 360 },
  },
  fields: [
    { k: 'value', l: 'Value %', t: 'slider', min: 0, max: 100, step: 1 },
    { k: 'label', l: 'Label', t: 'text' },
    { k: 'tone', l: 'Color', t: 'color' },
  ],
  render: (p) => {
    const v = Math.max(0, Math.min(100, Number(p.value) || 0));
    return (p.label ? '<div style="display:flex;justify-content:space-between;font-size:13px;color:#64748b"><span>' + escapeHtml(p.label) + '</span><strong>' + v + '%</strong></div>' : '')
      + '<div style="height:9px;border-radius:999px;background:#e2e8f0;overflow:hidden"><div style="height:100%;width:' + v + '%;background:' + (p.tone || '#6366f1') + ';border-radius:999px"></div></div>';
  },
});

def({
  type: 'counter', cat: Cards, label: 'Counter', icon: 'counter', tag: 'div',
  keywords: 'number count up statistic big',
  defaults: {
    props: { value: 250000, prefix: '', suffix: '+', label: 'Projects shipped', duration: 1600 },
    style: { display: 'flex', dir: 'column', gap: 6, align: 'center', w: '100%' },
  },
  fields: [
    { k: 'value', l: 'Value', t: 'number' },
    { k: 'prefix', l: 'Prefix', t: 'text' },
    { k: 'suffix', l: 'Suffix', t: 'text' },
    { k: 'label', l: 'Label', t: 'text' },
  ],
  render: (p) => {
    const n = Number(p.value) || 0;
    const shown = n >= 1000 ? n.toLocaleString('en-US') : String(n);
    return '<div class="vb-counter" data-count="' + n + '" style="font-size:52px;font-weight:800;color:#0f172a;letter-spacing:-2px;line-height:1;font-family:inherit">'
      + escapeHtml(p.prefix || '') + escapeHtml(shown) + escapeHtml(p.suffix || '') + '</div>'
      + (p.label ? '<div style="font-size:14px;color:#64748b">' + escapeHtml(p.label) + '</div>' : '');
  },
});

def({
  type: 'rating', cat: Cards, label: 'Rating', icon: 'star', tag: 'div',
  keywords: 'stars review score',
  defaults: {
    props: { value: 4.5, count: 128, tone: '#f59e0b' },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 8, fontSize: 13, color: '#64748b' },
  },
  fields: [{ k: 'value', l: 'Score', t: 'slider', min: 0, max: 5, step: 0.5 }, { k: 'count', l: 'Count', t: 'number' }],
  render: (p) => {
    const v = Number(p.value) || 0;
    let stars = '<span style="display:inline-flex;gap:2px;color:' + (p.tone || '#f59e0b') + '">';
    for (let i = 1; i <= 5; i += 1) {
      const on = v >= i;
      const half = !on && v > i - 1;
      stars += svgIcon('star', 15).replace('fill="none"', 'fill="' + (on ? 'currentColor' : half ? 'currentColor' : 'none') + '"')
        .replace('stroke="currentColor"', 'stroke="' + (on || half ? 'currentColor' : '#cbd5e1') + '"')
        .replace(/opacity="[^"]*"/, half ? 'style="opacity:.55"' : '');
    }
    stars += '</span>';
    return stars + '<strong style="color:#0f172a">' + v.toFixed(1) + '</strong>'
      + (p.count ? '<span>(' + Number(p.count) + ')</span>' : '');
  },
});


