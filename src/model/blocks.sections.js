import { def } from './registry.js';
import { Sections } from './categories.js';
import { svgIcon, img } from '../render/helpers.js';
import { escapeHtml } from '../core/util.js';

export function sectionStyle(bg, padY) {
  return 'display:flex;flex-direction:column;align-items:center;gap:32px;width:100%;padding:' + (padY || 80) + 'px 32px;background:' + bg + ';';
}

def({
  type: 'hero', cat: Sections, label: 'Hero', icon: 'hero', tag: 'section', container: true,
  keywords: 'landing banner above the fold jumbotron',
  defaults: {
    props: {
      eyebrow: 'Now in public beta',
      title: 'Design and ship a website in minutes',
      text: 'A visual builder that writes real, clean code. No handoff, no drag-and-drop spaghetti — just build it and export it.',
      primary: 'Start building', secondary: 'View demo', art: '',
    },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 20, w: '100%', pT: 96, pR: 32, pB: 96, pL: 32, textAlign: 'center', bg: '#ffffff', bgImage: 'radial-gradient(1200px 500px at 50% -10%,#eef2ff,transparent)' },
    // Nested editable pieces — click any child to style it alone
    children: [
      { type: 'label', name: 'Eyebrow', props: { text: 'Now in public beta' }, style: { color: '#6366f1', fontSize: 12, fontWeight: 700, letterSpacing: 2, textCase: 'uppercase' } },
      { type: 'heading', name: 'Headline', props: { text: 'Design and ship a website in minutes', tag: 'h1' }, style: { fontSize: 48, fontWeight: 800, color: '#0f172a', textAlign: 'center', maxW: '16ch' } },
      { type: 'paragraph', name: 'Subtext', props: { text: 'A visual builder that writes real, clean code. No handoff, no drag-and-drop spaghetti — just build it and export it.' }, style: { fontSize: 18, color: '#475569', textAlign: 'center', maxW: '56ch' } },
      {
        type: 'stack', name: 'Actions',
        style: { display: 'flex', dir: 'row', gap: 12, justify: 'center', mT: 6 },
        children: [
          { type: 'button', name: 'Primary', props: { text: 'Start building' }, style: { bg: '#0f172a', color: '#ffffff', pT: 14, pR: 26, pB: 14, pL: 26, radius: 12, fontWeight: 600 } },
          { type: 'button', name: 'Secondary', props: { text: 'View demo' }, style: { bg: '#ffffff', color: '#0f172a', pT: 14, pR: 26, pB: 14, pL: 26, radius: 12, fontWeight: 600, borderW: 1, borderColor: '#e2e8f0' } },
        ],
      },
    ],
  },
  fields: [
    { k: 'eyebrow', l: 'Eyebrow', t: 'text' },
    { k: 'title', l: 'Headline', t: 'textarea' },
    { k: 'text', l: 'Sub text', t: 'textarea' },
    { k: 'primary', l: 'Primary button', t: 'text' },
    { k: 'secondary', l: 'Secondary button', t: 'text' },
    { k: 'art', l: 'Hero image', t: 'asset', accept: 'image' },
  ],
  // Fallback only when the block has no nested children yet
  render: (p) => (p.eyebrow ? '<span style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6366f1;font-family:inherit">' + escapeHtml(p.eyebrow) + '</span>' : '')
    + '<h1 style="font-size:clamp(34px,5.2vw,60px);line-height:1.06;font-weight:800;letter-spacing:-2px;color:#0f172a;margin:0;max-width:16ch;font-family:inherit">' + escapeHtml(p.title || '') + '</h1>'
    + (p.text ? '<p style="font-size:18px;line-height:1.65;color:#475569;margin:0;max-width:56ch;font-family:inherit">' + escapeHtml(p.text) + '</p>' : '')
    + '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:6px">'
    + (p.primary ? '<a href="#" style="background:#0f172a;color:#fff;padding:14px 26px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none">' + escapeHtml(p.primary) + '</a>' : '')
    + (p.secondary ? '<a href="#" style="background:#fff;color:#0f172a;padding:14px 26px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;border:1px solid #e2e8f0">' + escapeHtml(p.secondary) + '</a>' : '')
    + '</div>'
    + (p.art ? '<div style="margin-top:18px;width:100%;max-width:960px;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 30px 60px -20px rgba(15,23,42,.25)">' + img(p.art, p.title, 'vb-img') + '</div>' : ''),
});

def({
  type: 'features', cat: Sections, label: 'Features', icon: 'feature', tag: 'section', container: true,
  keywords: 'benefits grid three columns',
  defaults: {
    props: {
      title: 'Everything you need',
      text: 'Built for people who care about the details.',
      items: '',
    },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 40, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#f8fafc', textAlign: 'center' },
    children: [
      { type: 'heading', name: 'Title', props: { text: 'Everything you need', tag: 'h2' }, style: { fontSize: 36, fontWeight: 800, color: '#0f172a', textAlign: 'center' } },
      { type: 'paragraph', name: 'Subtitle', props: { text: 'Built for people who care about the details.' }, style: { fontSize: 17, color: '#64748b', textAlign: 'center', maxW: '640px' } },
      {
        type: 'grid', name: 'Feature cards',
        style: { display: 'grid', cols: 'repeat(auto-fit,minmax(250px,1fr))', gap: 22, w: '100%', maxW: 1140 },
        children: [
          { type: 'featureCard', name: 'Fast', props: { icon: 'bolt', title: 'Blazing fast', text: 'Lightweight output that scores green on every audit.' } },
          { type: 'featureCard', name: 'Safe', props: { icon: 'shield', title: 'Safe by default', text: 'Accessible markup is generated for you.' } },
          { type: 'featureCard', name: 'Smart', props: { icon: 'spark', title: 'Smart defaults', text: 'Sensible typography and spacing out of the box.' } },
        ],
      },
    ],
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Sub text', t: 'textarea' },
    { k: 'items', l: 'Items', t: 'textarea' },
  ],
  render: (p) => '<div style="display:flex;flex-direction:column;gap:12px;max-width:640px">'
    + '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + (p.text ? '<p style="font-size:17px;color:#64748b;margin:0;line-height:1.6;font-family:inherit">' + escapeHtml(p.text) + '</p>' : '')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px;width:100%;max-width:1140px">'
    + String(p.items || '').split('\n').map((row) => row.trim()).filter(Boolean).map((row) => {
      const [ic, title, text] = row.split('|');
      return '<article style="background:#fff;border:1px solid #e9edf3;border-radius:18px;padding:28px;text-align:left;display:flex;flex-direction:column;gap:12px">'
        + '<span style="width:46px;height:46px;border-radius:13px;background:#eef2ff;color:#6366f1;display:inline-flex;align-items:center;justify-content:center">' + svgIcon((ic || 'spark').trim(), 22) + '</span>'
        + '<h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml((title || '').trim()) + '</h3>'
        + '<p style="font-size:14px;line-height:1.65;color:#64748b;margin:0;font-family:inherit">' + escapeHtml((text || '').trim()) + '</p></article>';
    }).join('')
    + '</div>',
});

def({
  type: 'ctaBanner', cat: Sections, label: 'CTA banner', icon: 'feature', tag: 'section', container: true,
  keywords: 'call to action sign up convert',
  defaults: {
    props: { title: 'Ready to build something great?', text: 'Start free. No credit card required.', button: 'Create your site' },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 16, w: '100%', pT: 64, pR: 32, pB: 64, pL: 32, textAlign: 'center', bg: '#0f172a', radius: 24, color: '#ffffff' },
    children: [
      { type: 'heading', name: 'Title', props: { text: 'Ready to build something great?', tag: 'h2' }, style: { fontSize: 32, fontWeight: 800, color: '#ffffff', textAlign: 'center' } },
      { type: 'paragraph', name: 'Text', props: { text: 'Start free. No credit card required.' }, style: { fontSize: 16, color: 'rgba(255,255,255,.72)', textAlign: 'center' } },
      { type: 'button', name: 'CTA', props: { text: 'Create your site' }, style: { bg: '#ffffff', color: '#0f172a', pT: 13, pR: 26, pB: 13, pL: 26, radius: 12, fontWeight: 600, mT: 6 } },
    ],
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Text', t: 'textarea' },
    { k: 'button', l: 'Button', t: 'text' },
  ],
  render: (p) => '<h2 style="font-size:clamp(26px,3.4vw,38px);font-weight:800;letter-spacing:-1px;color:inherit;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + (p.text ? '<p style="font-size:16px;opacity:.72;margin:0;font-family:inherit">' + escapeHtml(p.text) + '</p>' : '')
    + (p.button ? '<a href="#" style="background:#fff;color:#0f172a;padding:13px 26px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin-top:6px">' + escapeHtml(p.button) + '</a>' : ''),
});

def({
  type: 'statsRow', cat: Sections, label: 'Stats row', icon: 'stat', tag: 'section',
  keywords: 'numbers metrics kpi band',
  defaults: {
    props: { items: '120+\nProjects\n\n99.9%\nUptime\n\n4.9/5\nRating\n\n24/7\nSupport' },
    style: { display: 'grid', cols: 'repeat(auto-fit,minmax(160px,1fr))', colGap: 24, rowGap: 32, justify: 'center', align: 'center', w: '100%', pT: 64, pR: 32, pB: 64, pL: 32, bg: '#ffffff', textAlign: 'center' },
  },
  fields: [{ k: 'items', l: 'Stats', t: 'textarea' }],
  render: (p) => {
    const rows = String(p.items || '').split('\n\n').map((r) => r.trim()).filter(Boolean);
    return rows.map((row) => {
      const [value, label] = row.split('\n').map((s) => s.trim());
      return '<div style="display:flex;flex-direction:column;gap:6px">'
        + '<strong style="font-size:42px;font-weight:800;letter-spacing:-1.5px;color:#0f172a;line-height:1;font-family:inherit">' + escapeHtml(value) + '</strong>'
        + '<span style="font-size:14px;color:#64748b;font-family:inherit">' + escapeHtml(label || '') + '</span></div>';
    }).join('');
  },
});

def({
  type: 'logoCloudSection', cat: Sections, label: 'Logo cloud section', icon: 'comp', tag: 'section',
  keywords: 'trusted by brands social proof',
  defaults: {
    props: { title: 'Trusted by teams at', names: 'Northwind, Acme, Lumen, Vertex, Kite, Solace' },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 26, w: '100%', pT: 56, pR: 32, pB: 56, pL: 32, bg: '#ffffff', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'names', l: 'Brands', t: 'csv', item: 'brand', short: 'Brand' },
  ],
  render: (p) => (p.title ? '<p style="font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#94a3b8;margin:0;font-weight:600;font-family:inherit">' + escapeHtml(p.title) + '</p>' : '')
    + '<div style="display:flex;flex-wrap:wrap;gap:40px;justify-content:center;align-items:center;opacity:.7">'
    + String(p.names || '').split(',').map((s) => s.trim()).filter(Boolean)
      .map((n) => '<span style="font-size:20px;font-weight:700;color:#64748b;letter-spacing:-.4px;font-family:inherit">' + escapeHtml(n) + '</span>').join('')
    + '</div>',
});

def({
  type: 'testimonialsSection', cat: Sections, label: 'Testimonials', icon: 'testimonial', tag: 'section', container: true,
  keywords: 'reviews social proof quotes',
  defaults: {
    props: {
      title: 'Loved by builders',
      items: 'We shipped our new site in a weekend.|Sara Ahmed|Founder, Northwind\nThe output is genuinely production code.|Tom Baker|CTO, Lumen\nBest tool we have used all year.|Alex Morgan|Design Lead, Acme',
    },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 36, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#f8fafc', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'items', l: 'Quotes', t: 'textarea' },
  ],
  render: (p) => '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;width:100%;max-width:1140px">'
    + String(p.items || '').split('\n').map((r) => r.trim()).filter(Boolean).map((row) => {
      const [text, name, role] = row.split('|');
      const tones = ['#6366f1', '#0ea5e9', '#10b981'];
      const idx = String(p.items).indexOf(row) % 3;
      return '<figure style="background:#fff;border:1px solid #e9edf3;border-radius:18px;padding:28px;margin:0;text-align:left;display:flex;flex-direction:column;gap:16px">'
        + '<div style="display:flex;gap:3px;color:#f59e0b">' + svgIcon('star', 16).replace('fill="none"', 'fill="currentColor"').repeat(5) + '</div>'
        + '<blockquote style="margin:0;font-size:15px;line-height:1.7;color:#1e293b;font-family:inherit">' + escapeHtml((text || '').trim()) + '</blockquote>'
        + '<figcaption style="display:flex;align-items:center;gap:12px">'
        + '<span style="width:38px;height:38px;border-radius:999px;background:' + tones[idx] + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:14px">'
        + escapeHtml((name || '?').trim().split(' ').map((w) => w[0]).slice(0, 2).join('')) + '</span>'
        + '<span><strong style="display:block;font-size:14px;color:#0f172a">' + escapeHtml((name || '').trim()) + '</strong>'
        + '<span style="font-size:12px;color:#94a3b8">' + escapeHtml((role || '').trim()) + '</span></span></figcaption></figure>';
    }).join('') + '</div>',
});

def({
  type: 'pricingSection', cat: Sections, label: 'Pricing', icon: 'pricing', tag: 'section', container: true,
  keywords: 'plans tiers subscribe',
  defaults: {
    props: {
      title: 'Simple pricing',
      text: 'Start free. Upgrade when you need more.',
    },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 40, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#ffffff', textAlign: 'center' },
    children: [
      { type: 'heading', name: 'Title', props: { text: 'Simple pricing', tag: 'h2' }, style: { fontSize: 36, fontWeight: 800, color: '#0f172a', textAlign: 'center' } },
      { type: 'paragraph', name: 'Subtitle', props: { text: 'Start free. Upgrade when you need more.' }, style: { fontSize: 17, color: '#64748b', textAlign: 'center' } },
      {
        type: 'grid', name: 'Plans',
        style: { display: 'grid', cols: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22, w: '100%', maxW: 1100 },
        children: [
          { type: 'pricingCard', name: 'Starter', props: { plan: 'Starter', price: '0', period: 'month', features: '1 project\nCommunity support', cta: 'Start free', featured: false } },
          { type: 'pricingCard', name: 'Pro', props: { plan: 'Pro', price: '29', period: 'month', features: 'Everything in Starter\nPriority support\nCustom domain', cta: 'Choose Pro', featured: true } },
          { type: 'pricingCard', name: 'Team', props: { plan: 'Team', price: '79', period: 'month', features: 'Everything in Pro\nShared library\nSSO', cta: 'Contact sales', featured: false } },
        ],
      },
    ],
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'plans', l: 'Plans', t: 'textarea' },
  ],
  render: (p) => '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px;width:100%;max-width:1040px">'
    + String(p.plans || '').split('\n').map((r) => r.trim()).filter(Boolean).map((row, i) => {
      const [name, price, period, note] = row.split('|');
      const featured = i === 1;
      return '<article style="display:flex;flex-direction:column;gap:14px;text-align:center;background:' + (featured ? '#0f172a' : '#fff')
        + ';color:' + (featured ? '#fff' : '#0f172a') + ';border:1px solid ' + (featured ? '#0f172a' : '#e5e7eb') + ';border-radius:20px;padding:32px 26px">'
        + '<span style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.7">' + escapeHtml(name) + '</span>'
        + '<div style="display:flex;align-items:baseline;justify-content:center;gap:4px"><strong style="font-size:44px;font-weight:800;letter-spacing:-1.5px">$' + escapeHtml(price) + '</strong>'
        + '<span style="opacity:.6;font-size:14px">/' + escapeHtml(period || 'month') + '</span></div>'
        + '<p style="font-size:14px;opacity:.7;margin:0">' + escapeHtml(note || '') + '</p>'
        + '<a href="#" style="margin-top:8px;background:' + (featured ? '#fff' : '#0f172a') + ';color:' + (featured ? '#0f172a' : '#fff')
        + ';padding:12px;border-radius:11px;font-weight:600;font-size:14px;text-decoration:none">Choose</a></article>';
    }).join('') + '</div>',
});

def({
  type: 'faqSection', cat: Sections, label: 'FAQ section', icon: 'question', tag: 'section', container: true,
  keywords: 'help questions support',
  defaults: {
    props: {
      title: 'Frequently asked',
      items: 'How long does it take to get started?|Less than a minute.\nIs there a free plan?|Yes, forever.\nCan I export my site?|HTML, React, Vue, Svelte and more.',
    },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 30, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#f8fafc', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'items', l: 'Q and A', t: 'textarea' },
  ],
  render: (p) => '<h2 style="font-size:clamp(26px,3.4vw,38px);font-weight:800;letter-spacing:-1px;color:#0f172a;margin:0 0 8px;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + '<div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:760px;text-align:left">'
    + String(p.items || '').split('\n').map((r) => r.trim()).filter(Boolean).map((row) => {
      const [q, a] = row.split('|');
      return '<details style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px">'
        + '<summary style="cursor:pointer;font-weight:600;font-size:15px;color:#0f172a;list-style:none;font-family:inherit">' + escapeHtml(q || '') + '</summary>'
        + '<p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.7;font-family:inherit">' + escapeHtml(a || '') + '</p></details>';
    }).join('') + '</div>',
});

def({
  type: 'gallerySection', cat: Sections, label: 'Gallery section', icon: 'gallery', tag: 'section', container: true,
  keywords: 'portfolio work showcase photos',
  defaults: {
    props: { title: 'Selected work', count: 9 },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 32, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#0f172a', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'count', l: 'Images', t: 'number' },
  ],
  render: (p) => '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#f8fafc;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;width:100%;max-width:1140px">'
    + Array.from({ length: Math.max(1, Math.min(12, Number(p.count) || 9)) }, () => '<div class="vb-tile" style="aspect-ratio:4/3;border-radius:14px;background:linear-gradient(135deg,#334155,#475569)"></div>').join('')
    + '</div>',
});

def({
  type: 'contactSection', cat: Sections, label: 'Contact', icon: 'contact', tag: 'section', container: true,
  keywords: 'get in touch form reach out',
  defaults: {
    props: { title: 'Get in touch', text: 'Tell us about your project and we will reply within a day.', button: 'Send message' },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 24, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#ffffff', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Text', t: 'textarea' },
    { k: 'button', l: 'Button', t: 'text' },
  ],
  render: (p) => '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + (p.text ? '<p style="font-size:17px;color:#64748b;margin:0;max-width:52ch;font-family:inherit">' + escapeHtml(p.text) + '</p>' : '')
    + '<form style="display:flex;flex-direction:column;gap:14px;width:100%;max-width:480px;text-align:left;margin-top:8px">'
    + '<input placeholder="Your name" style="padding:13px 14px;border:1px solid #cbd5e1;border-radius:11px;font-size:15px;font-family:inherit">'
    + '<input placeholder="Email address" type="email" style="padding:13px 14px;border:1px solid #cbd5e1;border-radius:11px;font-size:15px;font-family:inherit">'
    + '<textarea rows="4" placeholder="Message" style="padding:13px 14px;border:1px solid #cbd5e1;border-radius:11px;font-size:15px;font-family:inherit;resize:vertical"></textarea>'
    + '<button type="submit" style="background:#0f172a;color:#fff;border:0;padding:14px;border-radius:11px;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit">'
    + escapeHtml(p.button || 'Send') + '</button></form>',
});

def({
  type: 'timelineSection', cat: Sections, label: 'Timeline section', icon: 'timeline', tag: 'section', container: true,
  keywords: 'steps history process roadmap',
  defaults: {
    props: { title: 'How it works', items: 'Design|Start with a block or import your old page.\nBuild|Nest, group and style everything visually.\nExport|Get clean HTML, React or Vue in one click.' },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 34, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#f8fafc', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'items', l: 'Steps', t: 'textarea' },
  ],
  render: (p) => '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + '<div style="display:flex;flex-direction:column;gap:22px;width:100%;max-width:640px;text-align:left">'
    + String(p.items || '').split('\n').map((r, i) => r.trim()).filter(Boolean).map((row) => {
      const [title, text] = row.split('|');
      return '<div style="display:flex;gap:16px">'
        + '<span style="flex-shrink:0;width:36px;height:36px;border-radius:999px;background:#0f172a;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">'
        + String.fromCharCode(65 + i) + '</span>'
        + '<div><strong style="display:block;font-size:16px;color:#0f172a;font-family:inherit">' + escapeHtml(title || '') + '</strong>'
        + '<span style="font-size:14px;color:#64748b;line-height:1.6;font-family:inherit">' + escapeHtml(text || '') + '</span></div></div>';
    }).join('') + '</div>',
});

def({
  type: 'teamSection', cat: Sections, label: 'Team section', icon: 'users', tag: 'section', container: true,
  keywords: 'about us people staff',
  defaults: {
    props: { title: 'Meet the team', people: 'Alex Morgan|Head of Design\nSara Ahmed|Lead Engineer\nTom Baker|Product Manager' },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 36, w: '100%', pT: 88, pR: 32, pB: 88, pL: 32, bg: '#ffffff', textAlign: 'center' },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'people', l: 'Members', t: 'textarea' },
  ],
  render: (p) => '<h2 style="font-size:clamp(28px,3.6vw,42px);font-weight:800;letter-spacing:-1.2px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;width:100%;max-width:900px">'
    + String(p.people || '').split('\n').map((r) => r.trim()).filter(Boolean).map((row) => {
      const [name, role] = row.split('|');
      const tones = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b'];
      const idx = String(p.people).indexOf(row) % 4;
      return '<article style="display:flex;flex-direction:column;align-items:center;gap:12px">'
        + '<span style="width:84px;height:84px;border-radius:999px;background:' + tones[idx] + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:700">'
        + escapeHtml((name || '?').trim().split(' ').map((w) => w[0]).slice(0, 2).join('')) + '</span>'
        + '<strong style="font-size:16px;color:#0f172a;font-family:inherit">' + escapeHtml((name || '').trim()) + '</strong>'
        + '<span style="font-size:13px;color:#94a3b8;font-family:inherit">' + escapeHtml((role || '').trim()) + '</span></article>';
    }).join('') + '</div>',
});

def({
  type: 'newsletterSection', cat: Sections, label: 'Newsletter', icon: 'mail', tag: 'section',
  keywords: 'subscribe mailing list signup',
  defaults: {
    props: { title: 'One email a month', text: 'Design tips, nothing else. Unsubscribe anytime.', placeholder: 'you@company.com', button: 'Subscribe' },
    style: { display: 'flex', dir: 'column', justify: 'center', align: 'center', gap: 18, w: '100%', pT: 72, pR: 32, pB: 72, pL: 32, bg: '#eef2ff', textAlign: 'center', radius: 24 },
  },
  fields: [
    { k: 'title', l: 'Title', t: 'text' },
    { k: 'text', l: 'Text', t: 'textarea' },
    { k: 'placeholder', l: 'Input placeholder', t: 'text' },
    { k: 'button', l: 'Button', t: 'text' },
  ],
  render: (p) => '<h2 style="font-size:clamp(24px,3vw,34px);font-weight:800;letter-spacing:-.9px;color:#0f172a;margin:0;font-family:inherit">' + escapeHtml(p.title || '') + '</h2>'
    + (p.text ? '<p style="font-size:15px;color:#475569;margin:0;font-family:inherit">' + escapeHtml(p.text) + '</p>' : '')
    + '<form style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center">'
    + '<input type="email" placeholder="' + escapeHtml(p.placeholder || '') + '" style="padding:12px 16px;border:1px solid #c7d2fe;border-radius:11px;font-size:14px;min-width:260px;font-family:inherit;background:#fff">'
    + '<button type="submit" style="background:#4f46e5;color:#fff;border:0;padding:12px 22px;border-radius:11px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit">'
    + escapeHtml(p.button || 'Subscribe') + '</button></form>',
});

def({
  type: 'sectionSpacer', cat: Sections, label: 'Divider section', icon: 'divider', tag: 'section',
  keywords: 'separator break band',
  defaults: { props: {}, style: { w: '100%', h: 1, bg: '#e2e8f0' } },
  render: () => '',
});

