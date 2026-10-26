import { def } from './registry.js';
import { Layout, Typography, Buttons } from './categories.js';

def({
  type: 'frame', cat: Layout, label: 'Frame', icon: 'container', tag: 'div', container: true,
  keywords: 'box wrapper div canvas panel',
  defaults: {
    props: { name: 'Frame' },
    style: { display: 'flex', dir: 'column', gap: 16, pT: 24, pR: 24, pB: 24, pL: 24, radius: 16, bg: '#ffffff', borderW: 1, borderColor: '#e5e7eb', shadow: '0 1px 2px rgba(0,0,0,.06)' },
  },
  fields: [{ k: 'name', l: 'Name', t: 'text' }],
  render: () => '',
});

def({
  type: 'section', cat: Layout, label: 'Section', icon: 'section', tag: 'section', container: true,
  keywords: 'band hero band full width',
  defaults: {
    props: { name: 'Section' },
    style: { display: 'flex', dir: 'column', gap: 32, pT: 80, pR: 32, pB: 80, pL: 32, justify: 'center', align: 'center' },
  },
  fields: [{ k: 'name', l: 'Name', t: 'text' }],
  render: () => '',
});

def({
  type: 'stack', cat: Layout, label: 'Stack', icon: 'row', tag: 'div', container: true,
  keywords: 'column vertical flow group',
  defaults: {
    props: { name: 'Stack' },
    style: { display: 'flex', dir: 'column', gap: 12 },
  },
  fields: [{ k: 'name', l: 'Name', t: 'text' }],
  render: () => '',
});

def({
  type: 'grid', cat: Layout, label: 'Grid', icon: 'grid', tag: 'div', container: true,
  keywords: 'columns gallery masonry tiles',
  defaults: {
    props: { name: 'Grid', cols: 'repeat(3, 1fr)', gap: 20 },
    style: { display: 'grid', cols: 'repeat(3, 1fr)', colGap: 20, rowGap: 20 },
  },
  fields: [
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'cols', l: 'Columns', t: 'text' },
    { k: 'gap', l: 'Gap', t: 'number' },
  ],
  render: () => '',
});

def({
  type: 'columns', cat: Layout, label: 'Columns', icon: 'col', tag: 'div', container: true,
  keywords: 'split two three equal',
  defaults: {
    props: { name: 'Columns', count: 3, gap: 24 },
    style: { display: 'grid', cols: 'repeat(3, 1fr)', colGap: 24, rowGap: 24 },
  },
  fields: [
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'count', l: 'Count', t: 'select', opts: ['2', '3', '4'] },
    { k: 'gap', l: 'Gap', t: 'number' },
  ],
  render: () => '',
});

def({
  type: 'spacer', cat: Layout, label: 'Spacer', icon: 'spacer', tag: 'div',
  keywords: 'gap blank space push',
  defaults: { props: {}, style: { h: 40, grow: 1 } },
  render: () => '',
});

def({
  type: 'divider', cat: Layout, label: 'Divider', icon: 'divider', tag: 'hr',
  keywords: 'hr line rule separator',
  defaults: { props: { label: '' }, style: { borderW: 1, borderColor: '#e5e7eb', borderStyle: 'solid', bg: 'transparent', mT: 12, mB: 12 } },
  fields: [{ k: 'label', l: 'Label', t: 'text' }],
  render: () => '',
});

def({
  type: 'heading', cat: Typography, label: 'Heading', icon: 'heading', tag: 'h1', text: true,
  keywords: 'title h1 h2 h3 title',
  defaults: {
    props: { text: 'A bold headline that sells the idea', tag: 'h1' },
    style: { fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', mB: 12, letterSpacing: -1 },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'textarea' },
    { k: 'tag', l: 'Tag', t: 'select', opts: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'p'] },
  ],
  render: (p) => String(p.text || ''),
});

def({
  type: 'subheading', cat: Typography, label: 'Subheading', icon: 'subheading', tag: 'h3', text: true,
  keywords: 'subtitle h3 lead intro',
  defaults: {
    props: { text: 'A supporting line that explains the value in one breath.', tag: 'h2' },
    style: { fontSize: 22, fontWeight: 600, lineHeight: 1.3, color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', mB: 12 },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'textarea' },
    { k: 'tag', l: 'Tag', t: 'select', opts: ['h2', 'h3', 'h4', 'h5', 'p'] },
  ],
  render: (p) => String(p.text || ''),
});

def({
  type: 'paragraph', cat: Typography, label: 'Paragraph', icon: 'paragraph', tag: 'p', text: true,
  keywords: 'body text copy prose',
  defaults: {
    props: { text: 'Write your story here. Keep it clear, specific, and short enough that people actually read it to the end.' },
    style: { fontSize: 16, lineHeight: 1.65, color: '#475569', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', maxW: 680, fontWeight: 400 },
  },
  fields: [{ k: 'text', l: 'Text', t: 'textarea' }],
  render: (p) => String(p.text || ''),
});

def({
  type: 'label', cat: Typography, label: 'Label', icon: 'label', tag: 'label', text: true,
  keywords: 'eyebrow caption small overline',
  defaults: {
    props: { text: 'NEW RELEASE' },
    style: { fontSize: 12, fontWeight: 700, letterSpacing: 2, textCase: 'uppercase', color: '#6366f1', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', mB: 10 },
  },
  fields: [{ k: 'text', l: 'Text', t: 'text' }],
  render: (p) => String(p.text || ''),
});

def({
  type: 'quote', cat: Typography, label: 'Quote', icon: 'quote', tag: 'blockquote', text: true,
  keywords: 'testimonial citation blockquote',
  defaults: {
    props: { text: 'This product completely changed how our team ships.', author: 'Jane Cooper', role: 'Head of Product, Acme' },
    style: { fontSize: 22, fontWeight: 500, lineHeight: 1.5, color: '#0f172a', textAlign: 'center', pT: 24, pB: 24, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [
    { k: 'text', l: 'Quote', t: 'textarea' },
    { k: 'author', l: 'Author', t: 'text' },
    { k: 'role', l: 'Role', t: 'text' },
  ],
  render: (p) => '<p>' + String(p.text || '') + '</p>'
    + ((p.author || p.role)
      ? '<footer class="vb-quote-foot"><strong>' + String(p.author || '') + '</strong>'
        + (p.role ? '<span>' + String(p.role) + '</span>' : '') + '</footer>'
      : ''),
});

def({
  type: 'code', cat: Typography, label: 'Code', icon: 'code-block', tag: 'pre', text: true,
  keywords: 'snippet pre monospace developer',
  defaults: {
    props: { code: "const greeting = 'hello';\nconsole.log(greeting);" },
    style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, color: '#e2e8f0', bg: '#0f172a', radius: 12, pT: 16, pR: 20, pB: 16, pL: 20, textAlign: 'left', overflow: 'auto' },
  },
  fields: [{ k: 'code', l: 'Code', t: 'textarea' }],
  render: (p) => String(p.code || ''),
});

def({
  type: 'list', cat: Typography, label: 'List', icon: 'list', tag: 'ul', text: true,
  keywords: 'bullets ul points checklist',
  defaults: {
    props: { items: ['Fast and reliable', 'Built for teams', 'Works everywhere'], style: 'bullet' },
    style: { fontSize: 16, lineHeight: 1.8, color: '#334155', pL: 22, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [
    { k: 'items', l: 'Items', t: 'list' },
    { k: 'style', l: 'Marker', t: 'select', opts: ['bullet', 'number', 'check'] },
  ],
  render: (p) => {
    const arr = Array.isArray(p.items) ? p.items : [];
    const style = p.style || 'bullet';
    if (style === 'check') {
      return '<ul class="vb-list-check">' + arr.map((i) => '<li>' + String(i) + '</li>').join('') + '</ul>';
    }
    return '<' + (style === 'number' ? 'ol' : 'ul') + '>' + arr.map((i) => '<li>' + String(i) + '</li>').join('') + '</' + (style === 'number' ? 'ol' : 'ul') + '>';
  },
});

def({
  type: 'button', cat: Buttons, label: 'Button', icon: 'button', tag: 'button',
  keywords: 'cta action link press',
  defaults: {
    props: { text: 'Get started', href: '', variant: 'primary', size: 'md', icon: 'arrow', iconPos: 'right', full: false },
    style: { display: 'inline-flex', dir: 'row', justify: 'center', align: 'center', gap: 8, pT: 12, pR: 24, pB: 12, pL: 24, radius: 10, bg: '#6366f1', color: '#ffffff', fontSize: 15, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', shadow: '0 6px 16px rgba(99,102,241,.28)' },
  },
  states: { hover: { bg: '#4f46e5', transform: 'translateY(-1px)' }, active: { transform: 'translateY(0)' } },
  fields: [
    { k: 'text', l: 'Text', t: 'text' },
    { k: 'href', l: 'Link', t: 'text' },
    { k: 'icon', l: 'Icon', t: 'icon' },
    { k: 'iconPos', l: 'Icon position', t: 'select', opts: ['left', 'right'] },
    { k: 'variant', l: 'Variant', t: 'select', opts: ['primary', 'secondary', 'ghost', 'outline', 'danger'] },
    { k: 'size', l: 'Size', t: 'select', opts: ['sm', 'md', 'lg'] },
  ],
  render: (p) => String(p.text || 'Button'),
});

def({
  type: 'link', cat: Buttons, label: 'Link', icon: 'link', tag: 'a', text: true,
  keywords: 'anchor text url navigation',
  defaults: {
    props: { text: 'Read the docs', href: '#', underline: true },
    style: { fontSize: 15, color: '#6366f1', fontWeight: 500, decoration: 'none', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'text' },
    { k: 'href', l: 'URL', t: 'text' },
    { k: 'underline', l: 'Underline', t: 'check' },
  ],
  render: (p) => String(p.text || ''),
});

def({
  type: 'iconButton', cat: Buttons, label: 'Icon button', icon: 'iconbutton', tag: 'button',
  keywords: 'icon only square action',
  defaults: {
    props: { icon: 'plus', size: 'md', shape: 'circle' },
    style: { display: 'inline-flex', justify: 'center', align: 'center', w: 44, h: 44, radius: 12, bg: '#6366f1', color: '#ffffff', shadow: '0 4px 12px rgba(99,102,241,.3)' },
  },
  fields: [
    { k: 'icon', l: 'Icon', t: 'icon' },
    { k: 'shape', l: 'Shape', t: 'select', opts: ['circle', 'square', 'rounded'] },
  ],
  render: () => '',
});

def({
  type: 'buttonGroup', cat: Buttons, label: 'Button group', icon: 'button_group', tag: 'div', container: true,
  keywords: 'segmented toolbar actions row',
  defaults: {
    props: { name: 'Actions', labels: 'Cancel', variant: 'ghost' },
    style: { display: 'flex', dir: 'row', gap: 12, justify: 'center', align: 'center' },
  },
  fields: [
    { k: 'labels', l: 'Buttons', t: 'csv', item: 'button', short: 'Btn' },
    { k: 'variant', l: 'Variant', t: 'select', opts: ['primary', 'outline', 'ghost'] },
  ],
  render: (p) => {
    const arr = String(p.labels || '').split(',').map((s) => s.trim()).filter(Boolean);
    return arr.map((label, i) => {
      const variant = p.variant === 'primary' && i === arr.length - 1 ? 'primary' : p.variant;
      const style = variant === 'primary'
        ? 'background:#6366f1;color:#fff;border-radius:10px;padding:12px 22px;font-weight:600'
        : variant === 'outline'
          ? 'background:transparent;color:#334155;border:1px solid #cbd5e1;border-radius:10px;padding:12px 22px;font-weight:600'
          : 'background:transparent;color:#64748b;border-radius:10px;padding:12px 22px;font-weight:500';
      return '<a class="vb-btn" style="' + style + '">' + label + '</a>';
    }).join('');
  },
});

def({
  type: 'chip', cat: Buttons, label: 'Chip', icon: 'tag', tag: 'span',
  keywords: 'tag pill badge label filter',
  defaults: {
    props: { text: 'Design', tone: 'indigo' },
    style: { display: 'inline-flex', align: 'center', radius: 999, pT: 5, pR: 12, pB: 5, pL: 12, fontSize: 12, fontWeight: 600, bg: '#eef2ff', color: '#4338ca', letterSpacing: 0 },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'text' },
    { k: 'tone', l: 'Tone', t: 'select', opts: ['indigo', 'emerald', 'amber', 'rose', 'slate'] },
  ],
  render: (p) => String(p.text || ''),
});


