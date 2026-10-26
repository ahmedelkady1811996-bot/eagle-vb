import { def } from './registry.js';
import { Forms } from './categories.js';
import { svgIcon } from '../render/helpers.js';
import { escapeHtml } from '../core/util.js';

const fieldStyle = 'width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;background:#fff;color:#0f172a;font-family:inherit;box-sizing:border-box;';
const labelStyle = 'display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px;font-family:inherit;';

def({
  type: 'input', cat: Forms, label: 'Input', icon: 'input', tag: 'input',
  keywords: 'text field form entry',
  defaults: {
    props: { label: 'Email address', name: 'email', placeholder: 'you@company.com', inputType: 'email', required: false, hint: '' },
    style: { display: 'flex', dir: 'column', w: '100%', maxW: 420, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [
    { k: 'label', l: 'Label', t: 'text' },
    { k: 'placeholder', l: 'Placeholder', t: 'text' },
    { k: 'inputType', l: 'Type', t: 'select', opts: ['text', 'email', 'password', 'number', 'date', 'tel', 'url', 'search'] },
    { k: 'required', l: 'Required', t: 'check' },
    { k: 'hint', l: 'Hint', t: 'text' },
  ],
  render: (p) => (p.label ? '<label class="vb-lbl" style="' + labelStyle + '" for="' + escapeHtml(p.name || '') + '">' + escapeHtml(p.label) + (p.required ? '<span style="color:#ef4444"> *</span>' : '') + '</label>' : '')
    + '<input class="vb-input" id="' + escapeHtml(p.name || '') + '" name="' + escapeHtml(p.name || '') + '" type="' + escapeHtml(p.inputType || 'text') + '"'
    + ' placeholder="' + escapeHtml(p.placeholder || '') + '"' + (p.required ? ' required' : '')
    + ' style="' + fieldStyle + '">'
    + (p.hint ? '<small class="vb-hint" style="display:block;margin-top:6px;color:#64748b;font-size:12px">' + escapeHtml(p.hint) + '</small>' : ''),
});

def({
  type: 'textarea', cat: Forms, label: 'Textarea', icon: 'textarea', tag: 'textarea',
  keywords: 'message multiline comments',
  defaults: {
    props: { label: 'Message', name: 'message', placeholder: 'Tell us more…', rows: 5, required: false },
    style: { display: 'flex', dir: 'column', w: '100%', maxW: 560, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [
    { k: 'label', l: 'Label', t: 'text' },
    { k: 'placeholder', l: 'Placeholder', t: 'text' },
    { k: 'rows', l: 'Rows', t: 'number' },
  ],
  render: (p) => (p.label ? '<label style="' + labelStyle + '">' + escapeHtml(p.label) + '</label>' : '')
    + '<textarea class="vb-input" name="' + escapeHtml(p.name || '') + '" rows="' + (Number(p.rows) || 5) + '"'
    + ' placeholder="' + escapeHtml(p.placeholder || '') + '" style="' + fieldStyle + ';min-height:110px;resize:vertical"></textarea>',
});

def({
  type: 'select', cat: Forms, label: 'Select', icon: 'select', tag: 'select',
  keywords: 'dropdown options picker',
  defaults: {
    props: { label: 'Choose a plan', name: 'plan', options: 'Starter, Pro, Business', selected: 0 },
    style: { display: 'flex', dir: 'column', w: '100%', maxW: 420, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [
    { k: 'label', l: 'Label', t: 'text' },
    { k: 'options', l: 'Options', t: 'csv', item: 'option', short: 'Option' },
  ],
  render: (p) => (p.label ? '<label style="' + labelStyle + '">' + escapeHtml(p.label) + '</label>' : '')
    + '<select class="vb-input" style="' + fieldStyle + '">'
    + String(p.options || '').split(',').map((s) => s.trim()).filter(Boolean)
      .map((o, i) => '<option' + (i === Number(p.selected) ? ' selected' : '') + '>' + escapeHtml(o) + '</option>').join('')
    + '</select>',
});

def({
  type: 'checkbox', cat: Forms, label: 'Checkbox', icon: 'checkbox', tag: 'label',
  keywords: 'tick check agree boolean',
  defaults: {
    props: { text: 'I agree to the terms and conditions', checked: false, tone: '#6366f1' },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 10, fontSize: 14, color: '#334155', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'text' },
    { k: 'checked', l: 'Checked', t: 'check' },
    { k: 'tone', l: 'Accent', t: 'color' },
  ],
  render: (p) => '<input type="checkbox"' + (p.checked ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:' + (p.tone || '#6366f1') + ';margin:0">'
    + '<span>' + escapeHtml(p.text || '') + '</span>',
});

def({
  type: 'radio', cat: Forms, label: 'Radio', icon: 'radio', tag: 'label',
  keywords: 'choice option single select',
  defaults: {
    props: { name: 'plan', text: 'Monthly', checked: true, tone: '#6366f1' },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 10, fontSize: 14, color: '#334155', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'text' },
    { k: 'name', l: 'Group', t: 'text' },
  ],
  render: (p) => '<input type="radio" name="' + escapeHtml(p.name || 'r') + '"' + (p.checked ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:' + (p.tone || '#6366f1') + ';margin:0">'
    + '<span>' + escapeHtml(p.text || '') + '</span>',
});

def({
  type: 'switch', cat: Forms, label: 'Switch', icon: 'toggle', tag: 'label',
  keywords: 'toggle boolean on off',
  defaults: {
    props: { text: 'Email notifications', checked: true, tone: '#6366f1' },
    style: { display: 'flex', dir: 'row', justify: 'space-between', align: 'center', gap: 16, w: '100%', maxW: 320, fontSize: 14, color: '#334155', fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer' },
  },
  fields: [
    { k: 'text', l: 'Text', t: 'text' },
    { k: 'checked', l: 'On', t: 'check' },
  ],
  render: (p) => '<span>' + escapeHtml(p.text || '') + '</span>'
    + '<span class="vb-switch' + (p.checked ? ' on' : '') + '" style="--tone:' + (p.tone || '#6366f1') + '"><span></span></span>',
});

def({
  type: 'form', cat: Forms, label: 'Form', icon: 'form', tag: 'form', container: true,
  keywords: 'submit contact signup',
  defaults: {
    props: { name: 'Form', action: '#', method: 'post', button: 'Send message' },
    style: { display: 'flex', dir: 'column', gap: 16, pT: 24, pR: 24, pB: 24, pL: 24, bg: '#ffffff', radius: 16, borderW: 1, borderColor: '#e2e8f0', w: '100%', maxW: 520 },
  },
  fields: [
    { k: 'name', l: 'Name', t: 'text' },
    { k: 'action', l: 'Action URL', t: 'text' },
    { k: 'method', l: 'Method', t: 'select', opts: ['get', 'post'] },
    { k: 'button', l: 'Submit label', t: 'text' },
  ],
  render: (p) => '<button type="submit" class="vb-btn vb-btn--primary" style="background:#6366f1;color:#fff;border:0;border-radius:10px;padding:13px 20px;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit">'
    + escapeHtml(p.button || 'Submit') + '</button>',
});

def({
  type: 'searchBar', cat: Forms, label: 'Search bar', icon: 'search', tag: 'div',
  keywords: 'find query filter input',
  defaults: {
    props: { placeholder: 'Search…', radius: 999 },
    style: { display: 'flex', dir: 'row', align: 'center', gap: 10, w: '100%', maxW: 420, pT: 10, pR: 16, pB: 10, pL: 16, bg: '#f1f5f9', radius: 999, color: '#64748b', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' },
  },
  fields: [{ k: 'placeholder', l: 'Placeholder', t: 'text' }],
  render: (p) => svgIcon('search', 18) + '<span>' + escapeHtml(p.placeholder || 'Search') + '</span>',
});


