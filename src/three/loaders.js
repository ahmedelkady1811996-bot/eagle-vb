import { ensure } from './core.js';

const SCRIPTS = {
  GLTFLoader: 'vendor/three/GLTFLoader.js',
  OBJLoader: 'vendor/three/OBJLoader.js',
  STLLoader: 'vendor/three/STLLoader.js',
  FBXLoader: 'vendor/three/FBXLoader.js',
  MTLLoader: 'vendor/three/MTLLoader.js',
};

const loaded = {};

function loadScript(name) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPTS[name];
    el.async = false;
    el.onload = () => resolve(true);
    el.onerror = () => reject(new Error('loader unavailable: ' + name));
    document.head.appendChild(el);
  });
}

async function loader(name) {
  const T = await ensure();
  if (T[name]) return T[name];
  if (loaded[name]) return loaded[name];
  loaded[name] = loadScript(name).then(() => {
    const got = T[name];
    if (!got) throw new Error('loader did not register: ' + name);
    return got;
  });
  return loaded[name];
}

export function kindOf(src, fileName) {
  const name = String(fileName || '').toLowerCase();
  const fromName = name.match(/\.(glb|gltf|obj|stl|fbx|mtl)$/);
  if (fromName) {
    const ext = fromName[1].toLowerCase();
    return ext === 'glb' ? 'gltf' : ext;
  }
  if (/^data:model\/gltf-binary/i.test(src)) return 'gltf';
  if (/^data:model\/gltf\+json/i.test(src)) return 'gltf';
  if (/^data:model\/obj/i.test(src)) return 'obj';
  if (/^data:model\/stl/i.test(src)) return 'stl';
  if (/^data:model\/fbx/i.test(src)) return 'fbx';
  if (/\.glb(\?|$)/i.test(src)) return 'gltf';
  if (/\.gltf(\?|$)/i.test(src)) return 'gltf';
  if (/\.obj(\?|$)/i.test(src)) return 'obj';
  if (/\.stl(\?|$)/i.test(src)) return 'stl';
  if (/\.fbx(\?|$)/i.test(src)) return 'fbx';
  return 'gltf';
}

function isDataUrl(src) {
  return typeof src === 'string' && /^data:/i.test(src);
}

function decodeDataUrlText(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl;
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    const bin = atob(payload);
    try {
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      let out = '';
      for (let i = 0; i < bin.length; i += 1) out += String.fromCharCode(bin.charCodeAt(i));
      return out;
    }
  }
  return decodeURIComponent(payload);
}

function arrayBufferFrom(src) {
  if (!isDataUrl(src)) return src;
  const comma = src.indexOf(',');
  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  const text = decodeURIComponent(payload);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i);
  return out.buffer;
}

function ensureMeshMaterials(T, root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.material) {
      child.material = new T.MeshStandardMaterial({
        color: '#cbd5e1',
        metalness: 0.15,
        roughness: 0.65,
        side: T.DoubleSide,
      });
      return;
    }
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (m.side === undefined) m.side = T.DoubleSide;
      m.needsUpdate = true;
    }
    if (child.geometry && !child.geometry.attributes.normal) {
      try { child.geometry.computeVertexNormals(); } catch (e) { void e; }
    }
  });
  return root;
}

async function loadObj(src, fileName, companions) {
  const T = await ensure();
  const OBJLoader = await loader('OBJLoader');
  const text = isDataUrl(src) ? decodeDataUrlText(src) : src;
  if (!text || !String(text).trim()) throw new Error('empty OBJ file');

  const extras = companions || {};
  let materials = null;

  // Prefer data URLs for maps when present (export/preview); else blob URLs (live editor)
  const texMap = (extras.texturesData && Object.keys(extras.texturesData).length)
    ? extras.texturesData
    : (extras.textures || {});

  if (extras.mtl && extras.mtl.src) {
    try {
      const MTLLoader = await loader('MTLLoader');
      const mtlText = isDataUrl(extras.mtl.src) ? decodeDataUrlText(extras.mtl.src) : extras.mtl.src;
      const mtlLoader = new MTLLoader();
      if (texMap && Object.keys(texMap).length) {
        const manager = new T.LoadingManager();
        manager.setURLModifier((url) => {
          const base = String(url).split(/[\\/]/).pop().toLowerCase().split('?')[0];
          if (texMap[base]) return texMap[base];
          // fuzzy match: map_Kd path may include folders
          for (const k of Object.keys(texMap)) {
            if (base && (k === base || k.endsWith(base) || base.endsWith(k))) return texMap[k];
          }
          return url;
        });
        mtlLoader.manager = manager;
        // Wait until texture images finish loading so colours show immediately
        await new Promise((resolve) => {
          let settled = false;
          const done = () => { if (!settled) { settled = true; resolve(); } };
          manager.onLoad = done;
          manager.onError = done;
          materials = mtlLoader.parse(mtlText, '');
          if (materials && materials.preload) materials.preload();
          setTimeout(done, 2500);
        });
      } else {
        materials = mtlLoader.parse(mtlText, '');
        if (materials && materials.preload) materials.preload();
      }
    } catch (err) {
      console.warn('[OBJ] MTL parse failed', err);
      materials = null;
    }
  }

  const objLoader = new OBJLoader();
  if (materials) {
    try { objLoader.setMaterials(materials); } catch (e) { void e; }
  }
  const object = objLoader.parse(text);
  return ensureMeshMaterials(T, object);
}

async function loadGltf(src, fileName) {
  const GLTFLoader = await loader('GLTFLoader');
  if (isDataUrl(src) && (/gltf-binary/i.test(src) || /\.glb$/i.test(fileName || ''))) {
    const buffer = arrayBufferFrom(src);
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(
        buffer,
        '',
        (gltf) => resolve(gltf.scene || gltf.scenes[0]),
        reject
      );
    });
  }
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(src, (gltf) => resolve(gltf.scene || gltf.scenes[0]), undefined, reject);
  });
}

async function loadStl(src) {
  const T = await ensure();
  const STLLoader = await loader('STLLoader');
  let geo;
  if (isDataUrl(src)) {
    const text = decodeDataUrlText(src);
    if (typeof text === 'string' && text.trimStart().startsWith('solid') && text.indexOf('facet') >= 0) {
      geo = new STLLoader().parse(text);
    } else {
      geo = new STLLoader().parse(arrayBufferFrom(src));
    }
  } else {
    geo = new STLLoader().parse(src);
  }
  return groupFromGeometry(T, geo);
}

async function loadFbx(src) {
  const FBXLoader = await loader('FBXLoader');
  return new Promise((resolve, reject) => {
    new FBXLoader().load(src, resolve, undefined, reject);
  });
}

function groupFromGeometry(T, geometry) {
  if (geometry && !geometry.attributes.normal) {
    try { geometry.computeVertexNormals(); } catch (e) { void e; }
  }
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.2, roughness: 0.55, side: T.DoubleSide })
  );
  const group = new T.Group();
  group.add(mesh);
  return group;
}

async function loadModel(src, fileName, options) {
  const kind = kindOf(src, fileName);
  const companions = (options && options.companions) || null;

  if (kind === 'gltf') return loadGltf(src, fileName);
  if (kind === 'obj') return loadObj(src, fileName, companions);
  if (kind === 'stl') return loadStl(src);
  if (kind === 'fbx') return loadFbx(src);

  throw new Error('unsupported model format: ' + kind);
}

export function pickModelFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.glb,.gltf,.obj,.mtl,.stl,.fbx,model/gltf-binary,model/gltf+json,image/png,image/jpeg,image/webp,image/*';
    input.addEventListener('change', async () => {
      const files = input.files ? Array.from(input.files) : [];
      if (!files.length) {
        resolve(null);
        return;
      }

      const byExt = (ext) => files.filter((f) => f.name.toLowerCase().endsWith(ext));
      const objFiles = byExt('.obj');
      const mtlFiles = byExt('.mtl');
      const glb = byExt('.glb').concat(byExt('.gltf'));
      const stl = byExt('.stl');
      const fbx = byExt('.fbx');
      const images = files.filter((f) => /\.(png|jpe?g|webp|gif|bmp|tga)$/i.test(f.name));

      const readAsDataURL = (file) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = () => rej(reader.error);
        reader.readAsDataURL(file);
      });

      try {
        const primary = glb[0] || objFiles[0] || stl[0] || fbx[0] || files[0];
        if (!primary) {
          resolve(null);
          return;
        }

        const src = await readAsDataURL(primary);
        const result = {
          src,
          name: primary.name,
          size: primary.size,
          companions: null,
        };

        if (/\.obj$/i.test(primary.name)) {
          const companions = { mtl: null, textures: {} };
          if (mtlFiles[0]) {
            companions.mtl = {
              src: await readAsDataURL(mtlFiles[0]),
              name: mtlFiles[0].name,
            };
          }
          companions.texturesData = {};
          for (const img of images) {
            const base = img.name.split(/[\\/]/).pop().toLowerCase();
            // blob: fast in the live editor; data URL survives preview + export
            const blobUrl = URL.createObjectURL(img);
            const dataUrl = await readAsDataURL(img);
            companions.textures[base] = blobUrl;
            companions.textures[img.name.toLowerCase()] = blobUrl;
            companions.texturesData[base] = dataUrl;
            companions.texturesData[img.name.toLowerCase()] = dataUrl;
          }
          result.companions = companions;
        }

        resolve(result);
      } catch (err) {
        console.error('[pickModelFile]', err);
        resolve(null);
      }
    });
    input.click();
  });
}

export const MODEL_EXTENSIONS = ['glb', 'gltf', 'obj', 'stl', 'fbx'];


export { loader, loadModel };
