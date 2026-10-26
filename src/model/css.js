const UNITLESS = new Set([
  'opacity', 'z-index', 'flex', 'flex-grow', 'flex-shrink', 'order',
  'font-weight', 'line-height', 'zoom', 'grid-row', 'grid-column',
]);

const LENGTH_KEYS = new Set([
  'w', 'h', 'minW', 'maxW', 'minH', 'maxH',
  'mT', 'mR', 'mB', 'mL', 'pT', 'pR', 'pB', 'pL',
  'gap', 'rowGap', 'colGap', 'radius', 'borderW',
  'fontSize', 'letterSpacing', 'x', 'y', 'blur', 'spread',
]);

const SIDE = [
  ['mT', 'margin-top', 'mR', 'margin-right', 'mB', 'margin-bottom', 'mL', 'margin-left'],
  ['pT', 'padding-top', 'pR', 'padding-right', 'pB', 'padding-bottom', 'pL', 'padding-left'],
];

export function px(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return value + 'px';
  const raw = String(value).trim();
  if (/^-?\d*\.?\d+$/.test(raw)) return raw + 'px';
  return raw;
}

function isEmpty(value) {
  return value == null || value === '' || value === 'none' || value === 'normal';
}

export function isContainerStyle(style) {
  const d = (style && style.display) || '';
  return d === 'flex' || d === 'grid' || d === 'inline-flex';
}

export function styleToCss(style, opts) {
  const s = style || {};
  const o = opts || {};
  const out = [];
  const push = (prop, value) => {
    if (isEmpty(value)) return;
    out.push(prop + ':' + value);
  };
  const num = (key, value) => {
    if (value == null || value === '') return '';
    return LENGTH_KEYS.has(key) ? px(value) : value;
  };

  if (s.pos === 'absolute' || (o.absolute && !o.flow)) {
    push('position', 'absolute');
    push('left', px(s.x != null ? s.x : 0));
    push('top', px(s.y != null ? s.y : 0));
  }

  push('display', s.display);
  push('align-self', s.alignSelf);
  if (s.display === 'flex' || s.display === 'inline-flex') {
    push('flex-direction', s.dir);
    push('flex-wrap', s.wrap === true || s.wrap === 'wrap' ? 'wrap' : '');
    push('justify-content', s.justify);
    push('align-items', s.align);
    push('gap', num('gap', s.gap));
    if (s.flex != null && s.flex !== '') push('flex', UNITLESS.has('flex') ? String(s.flex) : String(s.flex));
  } else if (s.display === 'grid') {
    push('grid-template-columns', s.cols);
    push('grid-template-rows', s.rows);
    push('column-gap', num('colGap', s.colGap));
    push('row-gap', num('rowGap', s.rowGap));
    push('justify-items', s.align);
    push('align-content', s.justify);
  }

  push('width', num('w', s.w));
  push('min-width', num('minW', s.minW));
  push('max-width', num('maxW', s.maxW));
  push('height', num('h', s.h));
  push('min-height', num('minH', s.minH));
  push('max-height', num('maxH', s.maxH));
  if (s.grow != null && s.grow !== '') push('flex-grow', String(s.grow));

  for (const group of SIDE) {
    const [tk, tp, rk, rp, bk, bp, lk, lp] = group;
    push(tp, num(tk, s[tk]));
    push(rp, num(rk, s[rk]));
    push(bp, num(bk, s[bk]));
    push(lp, num(lk, s[lk]));
  }

  push('background-color', s.bg);
  push('background-image', s.bgImage);
  push('background-size', s.bgSize);
  push('background-position', s.bgPos);
  push('background-repeat', s.bgRepeat);
  push('background-attachment', s.bgAttachment);

  push('border-radius', num('radius', s.radius));
  if (s.borderW != null && s.borderW !== '' && Number(s.borderW) > 0) {
    const style = s.borderStyle || 'solid';
    const color = s.borderColor || 'transparent';
    push('border', px(s.borderW) + ' ' + style + ' ' + color);
    if (s.borderSides && s.borderSides !== 'all') {
      const sides = String(s.borderSides).split(',').map((x) => x.trim());
      for (const side of sides) {
        const prop = side === 't' ? 'border-top' : side === 'r' ? 'border-right' : side === 'b' ? 'border-bottom' : side === 'l' ? 'border-left' : null;
        if (prop) push(prop, px(s.borderW) + ' ' + style + ' ' + color);
      }
    }
  }

  push('box-shadow', s.shadow);

  push('color', s.color);
  push('font-family', s.fontFamily);
  push('font-size', num('fontSize', s.fontSize));
  push('font-weight', UNITLESS.has('font-weight') ? String(s.fontWeight ?? '') : String(s.fontWeight ?? ''));
  push('font-style', s.fontStyle);
  push('line-height', UNITLESS.has('line-height') ? String(s.lineHeight ?? '') : num('lineHeight', s.lineHeight));
  push('letter-spacing', num('letterSpacing', s.letterSpacing));
  push('text-align', s.textAlign);
  push('text-transform', s.textCase);
  push('text-decoration', s.decoration || s.textDecor);
  push('white-space', s.whiteSpace);
  push('overflow-wrap', s.wrapText ? 'break-word' : '');
  if (s.wrapText) push('word-break', 'break-word');

  push('opacity', UNITLESS.has('opacity') ? String(s.opacity ?? '') : String(s.opacity ?? ''));
  push('mix-blend-mode', s.blend);
  push('filter', s.filter);
  push('backdrop-filter', s.backdropFilter);
  push('-webkit-backdrop-filter', s.backdropFilter);
  push('transform', s.transform);
  push('transform-origin', s.transformOrigin);
  push('box-sizing', 'border-box');
  push('overflow', s.overflow);
  push('z-index', UNITLESS.has('z-index') ? String(s.z ?? '') : String(s.z ?? ''));

  return out.filter(Boolean).join(';');
}

export function stateToCss(stateStyle, stateName) {
  if (!stateStyle) return '';
  const decls = [];
  for (const key in stateStyle) {
    const v = stateStyle[key];
    if (isEmpty(v)) continue;
    if (key === 'transform') decls.push('transform:' + v);
    else if (key === 'scale') decls.push('transform:scale(' + v + ')');
    else if (key === 'rotate') decls.push('transform:rotate(' + v + ')');
    else decls.push(key.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + (LENGTH_KEYS.has(key) ? px(v) : v));
  }
  return decls.length ? '.' + stateName + '{' + decls.join(';') + '}' : '';
}

export function animRule(style, selector) {
  const s = style || {};
  if (!s.anim || s.anim === 'none') return '';
  const name = 'vb-' + String(s.anim);
  const dur = (s.animDur == null ? 0.6 : s.animDur) + 's';
  const delay = s.animDelay || 0;
  const easing = s.animEase || 'cubic-bezier(.22,1,.36,1)';
  const count = s.animIter === 'infinite' ? 'infinite' : s.animIter || 1;
  const fill = s.animFill || 'both';
  return selector + '{animation:' + name + ' ' + dur + ' ' + easing + ' ' + delay + 's ' + count + ' ' + fill + ';}';
}

export function keyframesFor(anim) {
  const map = {
    fade: '@keyframes vb-fade{from{opacity:0}to{opacity:1}}',
    'fade-up': '@keyframes vb-fade-up{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:none}}',
    'fade-down': '@keyframes vb-fade-down{from{opacity:0;transform:translate3d(0,-16px,0)}to{opacity:1;transform:none}}',
    'fade-left': '@keyframes vb-fade-left{from{opacity:0;transform:translate3d(16px,0,0)}to{opacity:1;transform:none}}',
    'fade-right': '@keyframes vb-fade-right{from{opacity:0;transform:translate3d(-16px,0,0)}to{opacity:1;transform:none}}',
    zoom: '@keyframes vb-zoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}',
    pop: '@keyframes vb-pop{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:none}}',
    'slide-up': '@keyframes vb-slide-up{from{opacity:0;transform:translate3d(0,40px,0)}to{opacity:1;transform:none}}',
    'slide-down': '@keyframes vb-slide-down{from{opacity:0;transform:translate3d(0,-40px,0)}to{opacity:1;transform:none}}',
    flip: '@keyframes vb-flip{from{opacity:0;transform:perspective(600px) rotateX(-40deg)}to{opacity:1;transform:none}}',
    pulse: '@keyframes vb-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
    bounce: '@keyframes vb-bounce{0%,20%,53%,100%{transform:translate3d(0,0,0)}40%,43%{transform:translate3d(0,-22px,0)}70%{transform:translate3d(0,-9px,0)}}',
    spin: '@keyframes vb-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
    'blur-in': '@keyframes vb-blur-in{from{opacity:0;filter:blur(14px)}to{opacity:1;filter:none}}',
    typing: '@keyframes vb-typing{from{width:0}to{width:var(--vb-type,100%)}}',
  };
  return map[anim] || '';
}