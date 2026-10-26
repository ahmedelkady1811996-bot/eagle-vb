let THREE = null;
let loading = null;

const LOCAL = 'vendor/three/three.min.js';
const LOCAL_ORBIT = 'vendor/three/OrbitControls.js';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
const CDN_ORBIT = 'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/js/controls/OrbitControls.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = () => resolve(true);
    el.onerror = () => reject(new Error('failed ' + src));
    document.head.appendChild(el);
  });
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

export function ensure() {
  if (THREE) return Promise.resolve(THREE);
  if (loading) return loading;
  loading = (async () => {
    if (window.THREE) {
      THREE = window.THREE;
    } else {
      try {
        await loadScript(LOCAL);
      } catch (e) {
        await loadScript(CDN);
      }
      THREE = window.THREE;
    }
    if (!THREE) throw new Error('three.js unavailable');
    if (!THREE.OrbitControls) {
      try {
        await loadScript(LOCAL_ORBIT);
      } catch (e) {
        await loadScript(CDN_ORBIT);
      }
    }
    return THREE;
  })();
  return loading;
}

export function get() {
  return THREE;
}