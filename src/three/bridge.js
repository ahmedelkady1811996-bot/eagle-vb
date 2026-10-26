import { canvas, nodeMap } from '../render/canvas.js';
import { ensure } from './core.js';
import { isThreeType, mount as threeMount, dispose as threeDispose } from './engine.js';

let scheduled = false;

export function mountAll() {
  const root = canvas();
  if (!root) return;
  for (const [id, el] of nodeMap()) {
    if (!isThreeType(el.dataset.type)) continue;
    if (!el.querySelector('.three-mount')) {
      const mount = document.createElement('div');
      mount.className = 'three-mount';
      // pointer-events auto so orbit / zoom work as a real viewer
      // pointer-events:none in editor so the parent .vb-b receives selection/drag;
      // preview mode re-enables interaction via CSS (#app.is-preview .three-mount)
      mount.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
      el.style.position = el.style.position || 'relative';
      el.style.minHeight = el.style.minHeight || '200px';
      el.appendChild(mount);
      void id;
    }
  }
  schedule();
}

export function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    flush();
  }, 40);
}

/** Force remount of one block (e.g. after picking a model file). */
export function remount(blockId) {
  for (const el of nodeMap().values()) {
    if (el.dataset.id !== blockId) continue;
    const mount = el.querySelector('.three-mount');
    if (mount) {
      delete mount.dataset.sig;
      threeDispose(mount);
    }
  }
  mountAll();
}

export function flush() {
  const root = canvas();
  if (!root) return;
  for (const el of nodeMap().values()) {
    if (!isThreeType(el.dataset.type)) continue;
    let mount = el.querySelector('.three-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.className = 'three-mount';
      mount.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
      el.style.position = el.style.position || 'relative';
      el.style.minHeight = el.style.minHeight || '200px';
      el.appendChild(mount);
    }
    // Keep pointer-events none while editing so selection handles work
    if (!document.getElementById('app') || !document.getElementById('app').classList.contains('is-preview')) {
      mount.style.pointerEvents = 'none';
    } else {
      mount.style.pointerEvents = 'auto';
    }
    const block = el.__vbBlock;
    if (!block) continue;
    const sig = sigOf(block);
    if (mount.dataset.sig === sig) continue;
    mount.dataset.sig = sig;
    threeMount(mount, block);
  }
}

function sigOf(block) {
  const p = block.props || {};
  // MUST include model source — otherwise picking a file never remounts the viewer
  let companionsKey = '';
  try {
    if (p.companions) {
      companionsKey = typeof p.companions === 'string'
        ? p.companions.slice(0, 80)
        : (p.companions.mtl && p.companions.mtl.name) || Object.keys(p.companions.textures || {}).join(',');
    }
  } catch (e) { companionsKey = ''; }

  return [
    block.type,
    p.src ? String(p.src).length + ':' + String(p.srcName || '') : '',
    companionsKey,
    p.tint, p.tintColor, p.modelOpacity,
    p.shape, p.color, p.color2, p.count, p.spread,
    p.bg, p.metalness, p.roughness, p.flatShading, p.wireframe,
    p.emissive, p.emissiveIntensity, p.opacity,
    p.spin, p.spinSpeed, p.autoRotate, p.orbitSpeed, p.orbit, p.pan,
    p.ground, p.planeFloor, p.preset, p.ambient, p.key, p.fill, p.rim,
    p.fov, p.camDist, p.camX, p.camY, p.shadows, p.exposure, p.fog,
  ].join('~');
}

export function init() {
  ensure().then(() => mountAll()).catch(() => undefined);
  window.addEventListener('resize', () => schedule());
}
