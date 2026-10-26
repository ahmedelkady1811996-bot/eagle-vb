const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 45999);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/visualbuilder.html';
  if (rel === '/__selftest.html') {
    const src = fs.readFileSync(path.join(ROOT, 'visualbuilder.html'), 'utf8');
    const head = "<script>window.__earlyErrors=[];window.addEventListener('error',function(e){window.__earlyErrors.push('ERROR: '+(e.message||e.error));});</script>";
    const out = src
      .replace('<title>.*?</title>', '<title>selftest</title>' + head)
      .replace('<script type="module" src="src/app.js"></script>',
        '<script type="module" src="src/app.js"></script>\n<script type="module" src="dev/selftest.js"></script>\n<pre id="results" style="position:fixed;left:-9999px">running</pre>');
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
    return res.end(out);
  }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found: ' + rel);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  process.stdout.write('Visual Builder dev server -> http://127.0.0.1:' + PORT + '/\n');
});