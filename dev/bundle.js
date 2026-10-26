const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'app.js');

function toId(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

const NS_IMPORT_RE = /^[ \t]*import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/gm;
const NAMED_IMPORT_RE = /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?/gm;
const BARE_IMPORT_RE = /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const EXPORT_LIST_RE = /^[ \t]*export\s*\{([\s\S]*?)\}\s*;?[ \t]*$/gm;

function pairNames(list) {
  return list.split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
    const parts = entry.split(/\s+as\s+/);
    return { local: parts[1] ? parts[1].trim() : parts[0].trim(), imported: parts[0].trim() };
  });
}

function parseDeps(source) {
  const deps = [];
  let m;
  NS_IMPORT_RE.lastIndex = 0;
  while ((m = NS_IMPORT_RE.exec(source))) deps.push({ spec: m[2], namespace: m[1] });
  NAMED_IMPORT_RE.lastIndex = 0;
  while ((m = NAMED_IMPORT_RE.exec(source))) deps.push({ spec: m[2], named: pairNames(m[1]) });
  BARE_IMPORT_RE.lastIndex = 0;
  while ((m = BARE_IMPORT_RE.exec(source))) deps.push({ spec: m[1], bare: true });
  return deps;
}

function rewrite(source, file, registry) {
  const deps = parseDeps(source);
  const preambles = [];
  let body = source;

  const note = (spec) => {
    console.log('note called with spec:', spec, 'file:', file, 'dirname:', path.dirname(file));
    const depId = toId(path.resolve(path.dirname(file), spec));
    if (!registry.has(depId)) registry.set(depId, path.join(ROOT, depId));
    return depId;
  };

  body = body.replace(NS_IMPORT_RE, (full, alias, spec) => {
    preambles.push('const ' + alias + ' = __m[' + JSON.stringify(note(spec)) + '];');
    return '';
  });

  body = body.replace(NAMED_IMPORT_RE, (full, list, spec) => {
    const depId = note(spec);
    for (const n of pairNames(list)) {
      preambles.push('const ' + n.local + ' = __m[' + JSON.stringify(depId) + '][' + JSON.stringify(n.imported) + '];');
    }
    return '';
  });

  body = body.replace(BARE_IMPORT_RE, (full, spec) => {
    preambles.push('void __m[' + JSON.stringify(note(spec)) + '];');
    return '';
  });

  const exportedNames = [];
  body = body.replace(/^[ \t]*export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, (full, asyncKw, name) => {
    exportedNames.push(name);
    return (asyncKw || '') + 'function ' + name;
  });
  body = body.replace(/^[ \t]*export\s+class\s+([A-Za-z_$][\w$]*)/gm, (full, name) => {
    exportedNames.push(name);
    return 'class ' + name;
  });
  body = body.replace(/^[ \t]*export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (full, kind, name) => {
    exportedNames.push(name);
    return kind + ' ' + name;
  });

  body = body.replace(EXPORT_LIST_RE, (full, list) => {
    for (const entry of list.split(',').map((s) => s.trim()).filter(Boolean)) {
      const parts = entry.split(/\s+as\s+/);
      const local = parts[0].trim();
      const exported = parts[1] ? parts[1].trim() : local;
      exportedNames.push(exported + '=' + local);
    }
    return '';
  });

  /* A hand-written `const X = __m["..."];` line in a module is the BUNDLER'S
     OWN OUTPUT pasted back into the source. The bundler already emits that
     line from the module's import statement, so the pasted copy declares X a
     second time in the same scope and the whole page fails to parse with
     "Identifier 'X' has already been declared" (that is exactly what the
     `uid` in core/store.js did). Drop the pasted line whenever the import
     already provides that name. A name that is NOT imported is a re-export
     and must stay. */
  const importedLocals = new Set();
  for (const p of preambles) {
    const m = /^const\s+([A-Za-z_$][\w$]*)\s*=/.exec(p);
    if (m) importedLocals.add(m[1]);
  }
  body = body.replace(/^[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*__m\[[^\n]*;?[ \t]*$/gm,
    (full, name) => (importedLocals.has(name) ? '' : full));

  const tail = exportedNames
    .map((entry) => {
      if (entry.indexOf('=') > 0) {
        const [exported, local] = entry.split('=');
        return '__x[' + JSON.stringify(exported) + '] = ' + local + ';';
      }
      return '__x[' + JSON.stringify(entry) + '] = ' + entry + ';';
    })
    .join('\n');

  return { preambles, body, tail, deps };
}

function buildOrder(entry) {
  const registry = new Map();
  registry.set(toId(entry), entry);
  const modules = new Map();
  const order = [];
  const visiting = new Set();

  function visit(file) {
    // Ensure file is absolute
    file = path.resolve(ROOT, file);
    const id = toId(file);
    if (order.includes(id)) return;
    if (visiting.has(id)) throw new Error('circular import: ' + id);
    visiting.add(id);
    const source = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    console.log('Reading:', id, 'length:', source.length, 'has AI:', source.includes('ins.ai'));
    const result = rewrite(source, file, registry);
    for (const dep of result.deps) {
      const depFile = path.resolve(path.dirname(file), dep.spec);
      console.log('Dep:', dep.spec, '->', depFile, 'id:', toId(depFile));
      registry.set(toId(depFile), depFile);
      visit(depFile);
    }
    visiting.delete(id);
    modules.set(id, result);
    order.push(id);
  }

  visit(entry);
  return { registry, modules, order };
}

function bundle() {
  /* ===== THE SHIPPED PAGE IS READ-ONLY FOR EVERY TOOL =====
     dist/visualbuilder.html is EDITED BY HAND. It is the source of truth:
     the build copies it, the jar ships it and the Electron app runs it - byte
     for byte. No tool may ever write it, or a hand-made page is silently
     replaced by a generated one and the edit is lost.

     That is why --out is MANDATORY here: the bundler writes into the build
     folder (or anywhere else you name) and NEVER into dist/. Publishing a
     bundled page over the shipped one is a deliberate, MANUAL copy.

     The check runs FIRST, before a single module is read: a refused run must
     not leave half-written files behind. */
  const SHIPPED_PAGE = path.join(PROJECT_ROOT, 'dist', 'visualbuilder.html');
  const outIdx = process.argv.indexOf('--out');
  if (outIdx < 0 || !process.argv[outIdx + 1]) {
    console.error('[vb-bundle] REFUSING to run: --out <file> is required.');
    console.error('[vb-bundle]   the shipped page ' + SHIPPED_PAGE + ' is edited by hand and');
    console.error('[vb-bundle]   must never be written by the bundler.');
    console.error('[vb-bundle]   example: node dev/bundle.js --out ../build/vb-bundle/visualbuilder.html');
    process.exit(2);
  }
  const outFile = path.resolve(process.argv[outIdx + 1]);
  if (path.resolve(outFile) === path.resolve(SHIPPED_PAGE)) {
    console.error('[vb-bundle] REFUSING to write the shipped page: ' + SHIPPED_PAGE);
    console.error('[vb-bundle]   it is edited by hand. Write the bundle somewhere else and');
    console.error('[vb-bundle]   publish it by hand if you really mean to.');
    process.exit(2);
  }

  const { order, modules } = buildOrder(ENTRY);
  const chunks = [];
  for (const id of order) {
    const mod = modules.get(id);
    chunks.push(
      '__m[' + JSON.stringify(id) + '] = {};\n'
      + '(function () {\n'
      + 'var __x = __m[' + JSON.stringify(id) + '];\n'
      + (mod.preambles.length ? mod.preambles.join('\n') + '\n' : '')
      + mod.body
      + '\n' + mod.tail + '\n'
      + '})();\n'
    );
  }

  /* The template lives at src/shell.html and is NEVER written by this script.
     It used to be read from ../visualbuilder.html, which is also where the built
     page was written — so the SECOND run in a row read the built page back in as
     its own template and produced a page with the whole bundle inlined twice. */
  const template = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'ui', 'app.css'), 'utf8');
     const guard = fs.readFileSync(path.join(__dirname, 'file-guard.js'), 'utf8');
     /* The guard must appear EXACTLY ONCE in the finished page. It used to be
        injected here while the template ALSO carried it, and a template that had
        been copy-pasted 57 times produced 58 copies - each with its own "shown"
        flag, so opening the page over file:// stacked 57 identical warning
        bars on top of each other.
        The check is against the TEMPLATE, not against the text being
        substituted in - checking the replacement would always say "no guard
        here" and add a second copy. */
     const templateHasGuard = template.indexOf('Open this file over http') >= 0;
     const withGuard = (text) => (templateHasGuard ? text : guard + text);

  const raw = 'var __m = {};\n(function () {\n' + chunks.join('\n') + '\n})();\n';
  const js = raw.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

  let html = template;
  // IMPORTANT: use function replacers so `$` inside js/css is not treated as replace tokens ($' $& etc.)
  if (html.indexOf('<link rel="stylesheet" href="src/ui/app.css">') >= 0) {
    html = html.replace('<link rel="stylesheet" href="src/ui/app.css">', () => '<style>\n' + css + '\n</style>');
  } else {
    html = html.replace(/<style>[\s\S]*?<\/style>/, () => '<style>\n' + css + '\n</style>');
  }
     if (html.indexOf('<script type="module" src="src/app.js"></script>') >= 0) {
       html = html.replace('<script type="module" src="src/app.js"></script>', () => withGuard('\n<script>\n' + js + '\n</script>'));
     } else {
       html = html.replace(/<script>\s*var __m = \{\};[\s\S]*?<\/script>/, () => withGuard('\n<script>\n' + js + '\n</script>'));
     }
  html = html.replace(/[\u00e2\u20ac\u00a6]/g, '\u2026')
    .replace(/[\u00e2\u20ac\u201d]/g, '\u2014');

  /* ===== the output path was already validated at the top of bundle() =====
     The shipped page can never be the target (see the guard above). */
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');

  /* the assets go NEXT TO the page that was written - never into dist/.
     Copying them into dist/ unconditionally meant that a stray bundler run
     rewrote the shipped asset tree even when the page itself was written
     somewhere else. */
  copyTree(path.join(PROJECT_ROOT, 'IMAGES'), path.join(outDir, 'IMAGES'));
  copyTree(path.join(PROJECT_ROOT, 'vendor'), path.join(outDir, 'vendor'));

  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  process.stdout.write('Built ' + outFile + '  (' + order.length + ' modules, ' + kb + ' KB, assets copied)\n');
  process.stdout.write('The shipped page ' + SHIPPED_PAGE + ' was NOT touched.\n');
}

function copyTree(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

bundle();