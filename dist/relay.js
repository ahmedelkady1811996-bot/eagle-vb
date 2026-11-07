#!/usr/bin/env node
/* Eagle Visual Builder - local collaboration relay.
   No dependencies, no internet. Run:   node relay.js [path/to/visualbuilder.html] [port]
   Then everyone on the same network opens the printed address and clicks 👥 -> Connect. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const htmlArg = process.argv[2] && !/^\d+$/.test(process.argv[2]) ? process.argv[2] : path.join(__dirname, 'visualbuilder.html');
const PORT = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a))) || 8080;
const ROOT = path.dirname(path.resolve(htmlArg));
const INDEX = path.basename(htmlArg);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/' + INDEX;
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

/* ---------- minimal WebSocket (RFC 6455) ---------- */
const clients = []; /* {sock, cid, seq, buf, frag} */
let seq = 0;

function frame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function sendText(c, str) { try { c.sock.write(frame(1, Buffer.from(str, 'utf8'))); } catch (e) { /* closed */ } }

function onText(c, text) {
  let m; try { m = JSON.parse(text); } catch (e) { return; }
  if (m.from && !c.cid) c.cid = m.from;
  if (m.t === 'need-snap') {
    const older = clients.filter((o) => o !== c && o.cid).sort((a, b) => a.seq - b.seq)[0];
    if (older) sendText(older, text); else sendText(c, JSON.stringify({ t: 'relay-first' }));
    return;
  }
  if (m.to) { const t = clients.find((o) => o.cid === m.to); if (t) sendText(t, text); return; }
  clients.forEach((o) => { if (o !== c) sendText(o, text); });
}

function onData(c, chunk) {
  c.buf = Buffer.concat([c.buf, chunk]);
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    const mask = masked ? b.slice(off, off + 4) : null;
    if (masked) off += 4;
    if (b.length < off + len) return;
    let payload = Buffer.from(b.slice(off, off + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    c.buf = b.slice(off + len);
    if (op === 8) { try { c.sock.end(frame(8, Buffer.alloc(0))); } catch (e) { /* */ } return; }
    if (op === 9) { try { c.sock.write(frame(10, payload)); } catch (e) { /* */ } continue; }
    if (op === 1 || op === 2) { c.frag = [payload]; c.fragOp = op; } else if (op === 0) { c.frag.push(payload); }
    if ((op === 0 || op === 1 || op === 2) && fin) { const full = Buffer.concat(c.frag); c.frag = []; if (c.fragOp === 1) onText(c, full.toString('utf8')); }
  }
}

server.on('upgrade', (req, sock) => {
  if ((req.url || '').split('?')[0] !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { sock, cid: '', seq: ++seq, buf: Buffer.alloc(0), frag: [], fragOp: 1 };
  clients.push(c);
  console.log('+ connected (' + clients.length + ' online)');
  sock.on('data', (d) => onData(c, d));
  const bye = () => {
    const i = clients.indexOf(c); if (i < 0) return; clients.splice(i, 1);
    if (c.cid) clients.forEach((o) => sendText(o, JSON.stringify({ t: 'bye', from: c.cid })));
    console.log('- disconnected (' + clients.length + ' online)');
  };
  sock.on('close', bye); sock.on('error', bye);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nEagle Visual Builder - live collaboration relay');
  console.log('Serving ' + path.basename(htmlArg) + ' from ' + ROOT + '\n');
  console.log('Open one of these on every device (same Wi-Fi / network):');
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((n) => nets[n].forEach((a) => { if (a.family === 'IPv4' && !a.internal) console.log('   http://' + a.address + ':' + PORT); }));
  console.log('   http://localhost:' + PORT + '   (this computer)\n');
  console.log('Then click the 👥 button in the toolbar and press Connect.\nPress Ctrl+C to stop.\n');
});
