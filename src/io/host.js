const D = window.vbDesktop || null;

export const isElectron = !!(D && D.isElectron);

export function call(name, ...args) {
  if (!D || typeof D[name] !== 'function') return Promise.resolve(null);
  try {
    return Promise.resolve(D[name](...args));
  } catch (err) {
    console.warn('[host:' + name + ']', err);
    return Promise.resolve(null);
  }
}

export function available(name) {
  return !!(D && typeof D[name] === 'function');
}

function browserDownload(filename, content, mime) {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: mime || 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 400);
  return { path: filename, ok: true };
}

function browserOpenFiles(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = !!opts.multiple;
    const filter = (opts.filter || '').toLowerCase();
    if (filter === 'json') input.accept = '.json,.vb.json,application/json';
    else if (filter === 'html') input.accept = '.html,.htm,text/html';
    else if (filter === 'image') input.accept = 'image/*';
    else if (filter === 'model' || filter === '3d') input.accept = '.glb,.gltf,.obj,.fbx,.stl,model/*';
    else if (opts.accept) input.accept = opts.accept;
    else input.accept = '*/*';

    input.addEventListener('change', async () => {
      const list = Array.from(input.files || []);
      if (!list.length) {
        resolve({ files: [] });
        return;
      }
      const files = [];
      for (const file of list) {
        const isBinary = /image|model|octet|zip|fbx|glb|stl/i.test(file.type)
          || /\.(png|jpe?g|gif|webp|svg|glb|gltf|obj|fbx|stl|zip)$/i.test(file.name);
        try {
          if (isBinary && !/\.svg$/i.test(file.name) && !/\.json$/i.test(file.name) && !/\.html?/i.test(file.name)) {
            const dataUrl = await readAsDataURL(file);
            files.push({ name: file.name, content: dataUrl, path: file.name, size: file.size, type: file.type });
          } else {
            const text = await readAsText(file);
            files.push({ name: file.name, content: text, path: file.name, size: file.size, type: file.type });
          }
        } catch (e) {
          console.warn('[openFiles]', e);
        }
      }
      resolve({ files });
    });
    input.addEventListener('cancel', () => resolve({ files: [] }));
    input.click();
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function saveText(filename, content) {
  if (available('saveText')) {
    const res = await call('saveText', filename, content);
    if (res) return res;
  }
  return browserDownload(filename, content, 'application/json;charset=utf-8');
}

async function saveBytes(filename, base64) {
  if (available('saveBytes')) {
    const res = await call('saveBytes', filename, base64);
    if (res) return res;
  }
  try {
    const bin = atob(String(base64).replace(/^data:[^;]+;base64,/, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return browserDownload(filename, new Blob([bytes]), 'application/octet-stream');
  } catch (e) {
    return browserDownload(filename, base64, 'application/octet-stream');
  }
}

async function openFiles(opts) {
  if (available('openFiles')) {
    const res = await call('openFiles', opts || {});
    if (res) return res;
  }
  return browserOpenFiles(opts || {});
}

async function openFolder() {
  if (available('openFolder')) return call('openFolder', {});

  // Prefer modern directory picker (real folder, not a JSON file dialog)
  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const files = [];
      const walk = async (handle, prefix) => {
        for await (const entry of handle.values()) {
          const rel = prefix ? prefix + '/' + entry.name : entry.name;
          if (entry.kind === 'directory') {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
            await walk(entry, rel);
          } else if (entry.kind === 'file') {
            try {
              const file = await entry.getFile();
              const isText = /\.(html?|css|js|mjs|cjs|json|txt|md|svg|xml|csv)$/i.test(file.name)
                || (file.type && /text|json|xml|javascript|svg/i.test(file.type));
              if (isText && file.size < 8 * 1024 * 1024) {
                const text = await file.text();
                files.push({ name: file.name, path: rel, text, content: text, size: file.size, type: file.type });
              } else {
                files.push({ name: file.name, path: rel, text: '', content: '', size: file.size, type: file.type, binary: true });
              }
            } catch (e) {
              void e;
            }
          }
        }
      };
      await walk(dirHandle, '');
      return { name: dirHandle.name || 'folder', path: dirHandle.name || 'folder', files };
    } catch (e) {
      // User cancelled or unsupported — fall through to input fallback
      if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return null;
    }
  }

  // Fallback: webkitdirectory (still a folder picker, never a JSON file picker)
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.directory = true;
    // Do NOT set accept — that forces a file-type dialog on some browsers
    let done = false;
    let reading = false;
    const finish = (payload) => {
      if (done) return;
      done = true;
      resolve(payload);
    };
    input.addEventListener('change', async () => {
      reading = true;
      const list = Array.from(input.files || []);
      if (!list.length) {
        finish(null);
        return;
      }
      const files = [];
      for (const f of list) {
        try {
          const isText = /\.(html?|css|js|mjs|cjs|json|txt|md|svg|xml|csv)$/i.test(f.name)
            || (f.type && /text|json|xml|javascript|svg/i.test(f.type));
          if (isText && f.size < 8 * 1024 * 1024) {
            const text = await f.text();
            files.push({
              name: f.name,
              path: f.webkitRelativePath || f.name,
              text,
              content: text,
              size: f.size,
              type: f.type,
            });
          } else {
            files.push({
              name: f.name,
              path: f.webkitRelativePath || f.name,
              text: '',
              content: '',
              size: f.size,
              type: f.type,
              binary: true,
            });
          }
        } catch (e) {
          files.push({
            name: f.name,
            path: f.webkitRelativePath || f.name,
            text: '',
            content: '',
            size: f.size,
            binary: true,
          });
        }
      }
      const top = (list[0].webkitRelativePath || '').split('/')[0] || 'folder';
      finish({ name: top, path: top, files });
    });
    input.addEventListener('cancel', () => {
      if (!reading) finish(null);
    });
    // Only treat focus-return as cancel if the user never started a selection read
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (!reading && !done) finish(null);
      }, 1500);
    }, { once: true });
    input.click();
  });
}

async function preview(html) {
  if (available('preview')) return call('preview', html);
  if (typeof window.__vbShowPreview === 'function') {
    window.__vbShowPreview(html);
    return null;
  }
  const w = window.open('', 'vb-preview');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return null;
  }
  return null;
}

async function external(url) {
  if (available('openExternal')) return call('openExternal', url);
  window.open(url, '_blank', 'noopener');
  return null;
}

export function clipboard(text) {
  if (D && typeof D.clipboard === 'function') {
    try {
      D.clipboard(String(text));
      return;
    } catch (e) {
      void 0;
    }
  }
  if (navigator.clipboard) navigator.clipboard.writeText(String(text)).catch(() => undefined);
}

export function alertBox(message) {
  if (D && typeof D.alert === 'function') {
    try {
      D.alert(String(message));
      return;
    } catch (e) {
      void 0;
    }
  }
  window.alert(message);
}

export function confirmBox(message, okLabel, cancelLabel) {
  if (D && typeof D.confirm === 'function') {
    try {
      return D.confirm(String(message), okLabel, cancelLabel);
    } catch (e) {
      void 0;
    }
  }
  return window.confirm(message);
}

export function promptBox(message, def) {
  if (D && typeof D.prompt === 'function') {
    try {
      return D.prompt(String(message), def == null ? '' : def);
    } catch (e) {
      void 0;
    }
  }
  return window.prompt(message, def);
}

async function takeOpen() {
  if (!available('takeOpen')) return null;
  return call('takeOpen');
}

async function readText(path) {
  if (!available('readText')) return null;
  return call('readText', path);
}


export { saveText, saveBytes, openFiles, openFolder, preview, external, takeOpen, readText };
