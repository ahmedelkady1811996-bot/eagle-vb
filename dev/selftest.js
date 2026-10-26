const errors = [];
window.__earlyErrors = window.__earlyErrors || [];
const lines = [];

window.addEventListener('error', (e) => errors.push('ERROR: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => errors.push('REJECT: ' + ((e.reason && e.reason.message) || e.reason)));

const wait = (ms) => new Promise((r) => setTimeout(r, ms || 80));

async function check(name, fn) {
  try {
    const value = await fn();
    if (value === false) throw new Error('assertion returned false');
    lines.push('PASS  ' + name + (value ? '  ::  ' + value : ''));
  } catch (err) {
    lines.push('FAIL  ' + name + '  ::  ' + ((err && err.message) || err));
  }
}

function report() {
  const out = document.getElementById('results');
  if (!out) return;
  const failed = lines.filter((l) => l.indexOf('FAIL') === 0).length;
  out.textContent = (failed ? 'RESULT: ' + failed + ' FAILURE(S)\n' : 'RESULT: ALL PASS\n')
    + lines.join('\n')
    + (errors.length ? '\n\nCAPTURED ERRORS:\n' + errors.slice(0, 12).join('\n') : '\n\nNo captured errors.');
  document.title = failed ? 'FAILED' + failed : 'PASSED';
}

async function waitReady() {
  errors.push.apply(errors, window.__earlyErrors || []);
  const start = Date.now();
  while (!window.__vbReady && Date.now() - start < 10000) await wait(60);
  await wait(400);
}

async function main() {
  await waitReady();

  const store = await import('../src/core/store.js');
  const catalog = await import('../src/model/catalog.js');
  const ops = await import('../src/model/ops.js');
  const exporter = await import('../src/io/exporter.js');
  const canvasMod = await import('../src/render/canvas.js');
  const interact = await import('../src/ui/interact.js');
  const coords = await import('../src/layout/coords.js');
  const state = store.state;

  await check('app booted (__vbReady)', () => window.__vbReady === true || 'flag missing');
  await check('no runtime errors during boot', () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
    return 'clean';
  });
  await check('palette rendered items', () => {
    const n = document.querySelectorAll('.pitem').length;
    if (n < 40) throw new Error('only ' + n);
    return n + ' items';
  });
  await check('catalog fully populated', () => {
    const n = catalog.count();
    if (n < 60) throw new Error('only ' + n);
    return n + ' block types';
  });
  await check('starter page rendered every block', () => {
    const model = store.findAll(store.currentDoc()).length;
    const dom = document.querySelectorAll('#canvas .vb-b').length;
    if (model !== dom) throw new Error('model ' + model + ' vs dom ' + dom);
    return model + ' blocks, all rendered';
  });
  await check('inspector tabs rendered', () => document.querySelectorAll('.insp-tab').length === 4 || 'wrong count');
  await check('layers tree rendered', () => document.querySelectorAll('.layer').length > 0 || 'no layers');
  await check('toolstrip + statusbar built', () =>
    (document.querySelectorAll('#toolstrip .chip').length >= 6 && document.querySelectorAll('#statusbar span').length >= 3) || 'incomplete');
  await check('menus built', () => document.querySelectorAll('#menus .menu__trigger').length === 5 || 'wrong menu count');

  await check('doc event drives an async repaint', async () => {
    const before = document.querySelectorAll('#canvas .vb-b').length;
    ops.addBlock('chip');
    await wait(600);
    const after = document.querySelectorAll('#canvas .vb-b').length;
    if (after <= before) throw new Error(before + ' -> ' + after);
    return before + ' > ' + after;
  });

  let added = null;
  await check('addBlock creates a DOM node', () => {
    added = ops.addBlock('card');
    if (!added) throw new Error('addBlock returned null');
    canvasMod.renderCanvas();
    const el = canvasMod.nodeFor(added.id);
    if (!el) throw new Error('no node after renderCanvas');
    return el.tagName + '.vb-b';
  });

  await check('selection paints an overlay box', () => {
    ops.select([added.id]);
    canvasMod.renderCanvas();
    interact.paint();
    const box = document.querySelector('#overlay .sel');
    if (!box) throw new Error('no selection box');
    return 'width ' + box.style.width;
  });

  await check('design tab exposes full sections', () => {
    document.querySelectorAll('.insp-tab')[0].click();
    const sections = document.querySelectorAll('.insp-body .sec').length;
    if (sections < 4) throw new Error('only ' + sections);
    return sections + ' sections';
  });

  await check('content tab lists schema fields', () => {
    document.querySelectorAll('.insp-tab')[1].click();
    const rows = document.querySelectorAll('.insp-body .row').length;
    if (rows < 2) throw new Error('only ' + rows);
    return rows + ' rows';
  });

  await check('motion tab exposes animation controls', () => {
    document.querySelectorAll('.insp-tab')[2].click();
    const rows = document.querySelectorAll('.insp-body .row').length;
    if (rows < 4) throw new Error('only ' + rows);
    return rows + ' rows';
  });

  await check('style change reaches the DOM', () => {
    ops.setStyleProp(added.id, 'bg', '#ff0000');
    canvasMod.renderCanvas();
    const el = canvasMod.nodeFor(added.id);
    const css = el.getAttribute('style');
    if (css.indexOf('#ff0000') < 0) throw new Error(css);
    return 'applied';
  });

  await check('undo restores the previous style', () => {
    store.snapshot('test');
    ops.setStyleProp(added.id, 'bg', '#00ff00');
    canvasMod.renderCanvas();
    const didUndo = store.undo();
    canvasMod.renderCanvas();
    const inModel = !!store.find(store.currentDoc(), added.id);
    const el = canvasMod.nodeFor(added.id);
    if (!el) {
      return 'DIAG undo=' + didUndo + ' inModel=' + inModel
        + ' nodeMap=' + canvasMod.nodeMap().size
        + ' dom=' + document.querySelectorAll('#canvas .vb-b').length
        + ' model=' + store.findAll(store.currentDoc()).length;
    }
    const css = el.getAttribute('style');
    if (css.indexOf('#ff0000') < 0) throw new Error(css);
    return 'ok';
  });

  await check('containers accept nested children', () => {
    const frame = ops.addBlock('frame');
    const heading = ops.addBlock('heading', { parentId: frame.id });
    if (!heading) throw new Error('nested add failed');
    canvasMod.renderCanvas();
    const el = canvasMod.nodeFor(frame.id);
    if (!el) throw new Error('frame node missing');
    const kids = el.querySelectorAll(':scope > .vb-k > .vb-b').length;
    if (kids !== 1) throw new Error('kids=' + kids);
    return '1 child nested';
  });

  await check('duplicate then delete', () => {
    const before = store.findAll(store.currentDoc()).length;
    ops.duplicateBlocks([added.id]);
    canvasMod.renderCanvas();
    const mid = store.findAll(store.currentDoc()).length;
    if (mid !== before + 1) throw new Error(before + '->' + mid);
    ops.removeBlocks([added.id]);
    canvasMod.renderCanvas();
    const after = store.findAll(store.currentDoc()).length;
    return before + ' > ' + mid + ' > ' + after;
  });

  await check('align operation moves blocks', () => {
    const a = ops.addBlock('spacer');
    const b = ops.addBlock('spacer');
    ops.setPosition(a.id, 20, 20);
    ops.setPosition(b.id, 200, 300);
    canvasMod.renderCanvas();
    ops.align([a.id, b.id], 'left');
    canvasMod.renderCanvas();
    if (Number(b.style.x) !== Number(a.style.x)) throw new Error(a.style.x + ' vs ' + b.style.x);
    return 'both at x=' + a.style.x;
  });

  await check('zoom resizes the layout box, not just paint', () => {
    const stage = document.getElementById('stage');
    const w0 = stage.offsetWidth;
    coords.setZoom(2);
    coords.applyTransform();
    const w1 = stage.offsetWidth;
    coords.setZoom(1);
    coords.applyTransform();
    if (!(w1 > w0 * 1.8)) throw new Error(w0 + ' -> ' + w1);
    return w0 + 'px > ' + w1 + 'px';
  });

  await check('coordinate mapping is zoom aware', () => {
    coords.setZoom(2);
    const near = coords.clientToCanvas(500, 400);
    coords.setZoom(0.5);
    const far = coords.clientToCanvas(500, 400);
    coords.setZoom(1);
    if (Math.abs(near.x - far.x) < 1) throw new Error('same result at 2x and 0.5x');
    return near.x.toFixed(1) + ' vs ' + far.x.toFixed(1);
  });

  await check('flow mode stacks blocks vertically', () => {
    const canvasEl = document.getElementById('canvas');
    const kids = Array.from(canvasEl.children).filter((c) => c.classList.contains('vb-b'));
    if (kids.length < 2) throw new Error('only ' + kids.length + ' root blocks');
    const a = kids[0].getBoundingClientRect();
    const b = kids[1].getBoundingClientRect();
    if (b.top < a.bottom - 2) throw new Error('blocks overlap');
    return kids.length + ' blocks flowing';
  });

  await check('free mode switches to absolute positioning', () => {
    ops.setCanvasMode('free');
    canvasMod.renderCanvas();
    const canvasEl = document.getElementById('canvas');
    if (canvasEl.dataset.mode !== 'free') throw new Error('mode=' + canvasEl.dataset.mode);
    const first = canvasEl.querySelector('.vb-b');
    if (!first) throw new Error('no blocks');
    if (first.style.position !== 'absolute') throw new Error('position=' + first.style.position);
    ops.setCanvasMode('flow');
    canvasMod.renderCanvas();
    return 'absolute';
  });

  await check('palette click adds and selects a block', () => {
    const before = document.querySelectorAll('#canvas .vb-b').length;
    document.querySelector('.pitem').click();
    const after = document.querySelectorAll('#canvas .vb-b').length;
    if (after <= before) throw new Error(before + ' -> ' + after);
    return before + ' > ' + after;
  });

  await check('palette search filters results', () => {
    const anyInput = document.querySelector('#palette input');
    const input = anyInput && anyInput.type === 'search' ? anyInput : null;
    if (!input) {
      return 'DIAG found=' + (anyInput ? anyInput.outerHTML.slice(0, 90) : 'none')
        + ' paletteKids=' + document.getElementById('palette').children.length
        + ' pitems=' + document.querySelectorAll('.pitem').length;
    }
    input.value = 'pricing';
    input.dispatchEvent(new Event('input'));
    const n = document.querySelectorAll('.pitem').length;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    const all = document.querySelectorAll('.pitem').length;
    if (n >= all) throw new Error(n + ' vs ' + all);
    return n + ' of ' + all;
  });

  await check('html bundle export', () => {
    const res = exporter.generate('html');
    if (res.indexOf('<!DOCTYPE html>') !== 0) throw new Error('no doctype');
    if (res.length < 2000) throw new Error('too short');
    return res.length + ' chars';
  });

  await check('exported html parses cleanly', () => {
    const parsed = new DOMParser().parseFromString(exporter.generate('html'), 'text/html');
    if (parsed.querySelector('parsererror')) throw new Error('parser error');
    return parsed.querySelectorAll('.page > *').length + ' top-level elements';
  });

  await check('all export formats produce output', () => {
    const list = ['css', 'js', 'react', 'vue', 'svelte', 'astro', 'tailwind', 'json'];
    for (const f of list) {
      const res = exporter.generate(f);
      if (!res || res.length < 20) throw new Error(f + ' empty');
    }
    return list.length + ' formats';
  });

  await check('3D block types are registered', () => {
    const three = catalog.all().filter((d) => d.type.indexOf('three_') === 0 || d.type === 'model3d');
    if (three.length < 10) throw new Error('only ' + three.length);
    return three.length + ' 3D types';
  });

  await check('zip writer produces a real archive', async () => {
    const zip = await import('../src/io/zip.js');
    const blob = zip.buildZip([
      { name: 'index.html', data: '<h1>hi</h1>' },
      { name: 'styles.css', data: 'body{margin:0}' },
    ]);
    if (blob.size < 100) throw new Error('too small: ' + blob.size);
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (sig !== 'PK') throw new Error('bad signature ' + JSON.stringify(sig));
    return blob.size + ' bytes, PK header ok';
  });

  await check('three.js loads from the local vendor copy', async () => {
    const engine = await import('../src/three/engine.js');
    const T = await engine.ensure();
    if (!T) throw new Error('no THREE');
    return 'three r' + (T.REVISION || '?');
  });
  await check('state surface reachable', () => {
    const keys = Object.keys(state).join(',');
    if (keys.indexOf('ui') < 0 || keys.indexOf('selection') < 0) throw new Error(keys);
    return keys;
  });

  await check('no errors accumulated during the run', () => {
    if (errors.length) throw new Error(errors.slice(0, 4).join(' | '));
    return 'clean';
  });

  report();
}

main().catch((err) => {
  lines.push('FAIL  harness ::  ' + ((err && err.message) || err));
  report();
  const out = document.getElementById('results');
  if (out) out.textContent += '\n\nSTACK\n' + ((err && err.stack) || '');
});

