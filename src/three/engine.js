import { ensure, hasWebGL, get as getThree } from './core.js';
import { loadModel } from './loaders.js';

const SCENE_PRESETS = {
  studio: { bg: '#eef2f7', ambient: 0.85, key: 1.15, fill: 0.45, rim: 0.5, keyColor: '#ffffff', fillColor: '#c7d2fe', ground: true, fog: 0, exposure: 1.05, env: 'studio' },
  night: { bg: '#070b16', ambient: 0.25, key: 1.5, fill: 0.5, rim: 0.9, keyColor: '#e2e8f0', fillColor: '#4c1d95', ground: true, fog: 0.5, exposure: 1.2, env: 'night' },
  neon: { bg: '#0b0b1a', ambient: 0.3, key: 1.4, fill: 0.9, rim: 1.2, keyColor: '#f0abfc', fillColor: '#22d3ee', ground: true, fog: 0.65, exposure: 1.3, env: 'neon' },
  daylight: { bg: '#dbeafe', ambient: 1.1, key: 2.1, fill: 0.8, rim: 0.4, keyColor: '#fffbeb', fillColor: '#bfdbfe', ground: true, fog: 0, exposure: 1, env: 'outdoor' },
  clay: { bg: '#1a1a1a', ambient: 1.2, key: 0.6, fill: 0.3, rim: 0.2, keyColor: '#ffffff', fillColor: '#3f3f46', ground: true, fog: 0, exposure: 1, env: 'clay' },
  void: { bg: '#05070d', ambient: 0.35, key: 1.1, fill: 0.3, rim: 0.4, keyColor: '#ffffff', fillColor: '#334155', ground: false, fog: 0.2, exposure: 1.15, env: 'void' },
};

export const PRESETS = SCENE_PRESETS;

export function isThreeType(type) {
  return typeof type === 'string' && (type.indexOf('three_') === 0 || type === 'model3d');
}

function num(v, fallback) {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function geometryFor(T, shape) {
  const map = {
    box: () => new T.BoxGeometry(1.45, 1.45, 1.45),
    sphere: () => new T.SphereGeometry(0.95, 64, 40),
    torus: () => new T.TorusGeometry(0.72, 0.26, 32, 96),
    cylinder: () => new T.CylinderGeometry(0.7, 0.7, 1.4, 48),
    cone: () => new T.ConeGeometry(0.85, 1.5, 48),
    plane: () => new T.PlaneGeometry(1.8, 1.8),
    icosahedron: () => new T.IcosahedronGeometry(0.95, 0),
    dodecahedron: () => new T.DodecahedronGeometry(0.95, 0),
    torusKnot: () => new T.TorusKnotGeometry(0.62, 0.22, 180, 32),
    capsule: () => new T.CapsuleGeometry(0.55, 1.0, 12, 32),
    ring: () => new T.TorusGeometry(0.8, 0.12, 24, 80),
    heart: () => new T.TorusKnotGeometry(0.55, 0.24, 180, 28),
  };
  try {
    return (map[shape] || map.box)();
  } catch (e) {
    return new T.BoxGeometry(1.4, 1.4, 1.4);
  }
}

export function materialFor(T, p, second) {
  const params = {
    color: new T.Color(second || p.color || '#6366f1'),
    metalness: clamp(num(p.metalness, 0.25), 0, 1),
    roughness: clamp(num(p.roughness, 0.45), 0, 1),
    flatShading: !!p.flatShading,
    wireframe: !!p.wireframe,
    side: p.side === 'front' ? T.FrontSide : T.DoubleSide,
    transparent: clamp(num(p.opacity, 1), 0, 1) < 1,
    opacity: clamp(num(p.opacity, 1), 0, 1),
  };
  if (p.emissive && p.emissive !== '#000000') {
    params.emissive = new T.Color(p.emissive);
    params.emissiveIntensity = clamp(num(p.emissiveIntensity, 1), 0, 4);
  }
  try {
    return new T.MeshStandardMaterial(params);
  } catch (e) {
    return new T.MeshBasicMaterial({ color: params.color });
  }
}

function presetOf(p) {
  return SCENE_PRESETS[p.preset] || SCENE_PRESETS.studio;
}

const instances = new WeakMap();

export function isMounted(hostEl) {
  return instances.has(hostEl);
}

export function dispose(hostEl) {
  const inst = instances.get(hostEl);
  if (!inst) return;
  cancelAnimationFrame(inst.raf);
  window.removeEventListener('resize', inst.onResize);
  window.removeEventListener('scroll', inst.onScroll);
  if (inst.controls && inst.controls.dispose) inst.controls.dispose();
  try {
    inst.renderer.dispose();
  } catch (e) {
    void 0;
  }
  instances.delete(hostEl);
}

export function mount(hostEl, block) {
  if (!hostEl || !block) return;
  if (instances.has(hostEl)) dispose(hostEl);

  hostEl.innerHTML = '<div class="three-loading">Loading 3D…</div>';

  ensure().then((T) => {
    if (!hostEl.isConnected || instances.has(hostEl)) return;
    return build(T, hostEl, block);
  }).then((built) => {
    if (!built && hostEl.isConnected) {
      hostEl.innerHTML = '<div class="three-fallback">3D needs WebGL</div>';
    }
  }).catch((err) => {
    console.error('[three]', err);
    if (hostEl.isConnected) hostEl.innerHTML = '<div class="three-fallback">Could not load 3D</div>';
  });
}

async function build(T, hostEl, block) {
  if (!hasWebGL()) {
    hostEl.innerHTML = '<div class="three-fallback">3D needs WebGL — try turning on hardware acceleration</div>';
    return false;
  }

  const p = block.props || {};
  const preset = presetOf(p);
  const w = hostEl.clientWidth || 320;
  const h = hostEl.clientHeight || 320;

  const scene = new T.Scene();
  const bg = p.bg || preset.bg;
  scene.background = new T.Color(bg);
  if (p.fog > 0 || preset.fog > 0) {
    const amount = num(p.fog, preset.fog);
    scene.fog = new T.Fog(new T.Color(bg), 4, 4 + amount * 12);
  }

  const camera = new T.PerspectiveCamera(clamp(num(p.fov, 45), 12, 100), w / h, 0.05, 200);
  const camDist = clamp(num(p.camDist, 4.4), 1.2, 40);
  const camY = clamp(num(p.camY, 1.3), -6, 6);
  const camX = clamp(num(p.camX, 0), -10, 10);
  camera.position.set(camX, camY, camDist);
  const target = new T.Vector3(num(p.targetX, 0), num(p.targetY, 0), num(p.targetZ, 0));

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: p.alpha === true });
  } catch (e) {
    hostEl.innerHTML = '<div class="three-fallback">WebGL unavailable</div>';
    return false;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = p.shadows !== false;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if (renderer.toneMapping !== undefined) renderer.toneMapping = T.ACESFilmicToneMapping;
  if (renderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = num(p.exposure, preset.exposure);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  hostEl.innerHTML = '';
  hostEl.appendChild(renderer.domElement);
  // Real viewer controls — don't let canvas mousedown bubble to the block drag system
  renderer.domElement.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); });
  renderer.domElement.addEventListener('mousedown', (ev) => { ev.stopPropagation(); });
  renderer.domElement.addEventListener('wheel', (ev) => { ev.stopPropagation(); }, { passive: true });
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  scene.add(new T.AmbientLight(new T.Color(p.ambientColor || '#ffffff'), clamp(num(p.ambient, preset.ambient), 0, 4)));

  const key = new T.DirectionalLight(new T.Color(p.keyColor || preset.keyColor), clamp(num(p.key, preset.key), 0, 6));
  key.position.set(3, 4, 3);
  if (key.castShadow !== undefined) key.castShadow = p.shadows !== false;
  scene.add(key);

  const fill = new T.DirectionalLight(new T.Color(p.fillColor || preset.fillColor), clamp(num(p.fill, preset.fill), 0, 6));
  fill.position.set(-3, 2, -2);
  scene.add(fill);

  const rim = new T.DirectionalLight(new T.Color(p.rimColor || '#ffffff'), clamp(num(p.rim, preset.rim), 0, 6));
  rim.position.set(-1, 2, -4);
  scene.add(rim);

  const group = new T.Group();
  scene.add(group);

  const shape = p.shape || 'box';
  const material = materialFor(T, p);

  if (block.type === 'model3d' || p.src) {
    if (!p.src) {
      hostEl.insertAdjacentHTML('beforeend', '<div class="three-hint">Pick a model (.glb / .obj+.mtl / .stl / .fbx). For full OBJ colours select the .obj, .mtl and texture images together.</div>');
    } else {
      try {
        let companions = null;
        try {
          companions = p.companions ? (typeof p.companions === 'string' ? JSON.parse(p.companions) : p.companions) : null;
        } catch (e) { companions = null; }
        const model = await loadModel(p.src, p.srcName, { companions: companions });
        fitModel(T, model, group, p);
        // Keep original materials unless user asks for a tint
        if (p.tint && p.tint !== 'none' && p.tintColor) applyTint(model, p.tintColor);
        if (p.modelOpacity != null && Number(p.modelOpacity) < 1) applyOpacity(model, num(p.modelOpacity, 1));
      } catch (err) {
        console.error('[3D model]', err);
        const msg = (err && err.message) ? String(err.message).slice(0, 120) : 'parse error';
        hostEl.insertAdjacentHTML('beforeend', '<div class="three-hint">Could not load model: ' + msg + '. For OBJ, select .obj + .mtl together. Prefer .glb for best results.</div>');
        const fallback = new T.Mesh(geometryFor(T, shape), material);
        group.add(fallback);
      }
    }
  }

  if (group.children.length === 0) {
    const count = block.type === 'three_scene' ? clamp(num(p.count, 3), 1, 24) : 1;
    const spread = num(p.spread, 1.4);
    for (let i = 0; i < count; i += 1) {
      const mesh = new T.Mesh(geometryFor(T, shape), materialFor(T, p, count > 1 ? p.color2 : null));
      if (count > 1) {
        mesh.position.set((i % 3) * spread - spread, Math.floor(i / 3) * spread * 0.8 - spread * 0.4, (i % 2) * 0.3);
        mesh.rotation.set(i * 0.4, i * 0.7, 0);
      }
      group.add(mesh);
    }
  }

  if (p.ground !== false) {
    const grid = new T.GridHelper(num(p.groundSize, 14), num(p.gridLines, 26), new T.Color(p.gridColor || '#334155'), new T.Color(p.gridColor2 || '#1e293b'));
    grid.position.y = -1.35;
    scene.add(grid);
    if (p.planeFloor) {
      const floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshStandardMaterial({ color: p.floorColor || bg, roughness: 0.95, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.36;
      floor.receiveShadow = true;
      scene.add(floor);
    }
  }

  let controls = null;
  if (T.OrbitControls && p.orbit !== false) {
    try {
      controls = new T.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = p.damping !== false;
      controls.dampingFactor = num(p.damping, 0.08);
      controls.autoRotate = !!p.autoRotate;
      controls.autoRotateSpeed = num(p.orbitSpeed, 1.4);
      controls.minDistance = clamp(num(p.minDist, 1.6), 0.2, 40);
      controls.maxDistance = clamp(num(p.maxDist, 14), 1, 80);
      controls.enablePan = p.pan !== false;
      controls.target.copy(target);
      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.addEventListener('pointerdown', () => { renderer.domElement.style.cursor = 'grabbing'; });
      window.addEventListener('pointerup', () => { renderer.domElement.style.cursor = 'grab'; });
    } catch (e) {
      controls = null;
    }
  }

  const spin = !!p.spin;
  const speed = num(p.spinSpeed, 0.6) * 0.012;
  const wobble = p.wobble === true ? num(p.wobbleAmount, 0.6) * 0.01 : 0;
  const scrollSpin = !!p.scrollSpin;
  let scrollFactor = 0;
  let raf = 0;

  const onScroll = () => {
    if (!scrollSpin) return;
    const r = hostEl.getBoundingClientRect();
    const progress = 1 - (r.top + r.height) / (window.innerHeight + r.height);
    scrollFactor = clamp(progress, 0, 1);
  };
  if (scrollSpin) {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (spin) group.rotation.y += speed;
    if (wobble) {
      group.rotation.x = Math.sin(Date.now() * 0.0006) * wobble;
      group.position.y = Math.cos(Date.now() * 0.0008) * wobble;
    }
    if (scrollSpin) group.rotation.y = scrollFactor * Math.PI * num(p.scrollTurns, 2);
    if (controls) controls.update();
    try {
      renderer.render(scene, camera);
    } catch (err) {
      cancelAnimationFrame(raf);
    }
  };
  loop();

  const onResize = () => {
    const nw = hostEl.clientWidth || w;
    const nh = hostEl.clientHeight || h;
    camera.aspect = nw / Math.max(1, nh);
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  };
  window.addEventListener('resize', onResize);

  instances.set(hostEl, { scene, renderer, controls, dispose: () => dispose(hostEl) });
  return true;
}

/** Auto upright + manual rotations so models stand correctly (Y-up / Z-up sources). */
function fitModel(T, model, group, props) {
  const p = props || {};
  // Manual rotations (degrees) from inspector
  const rx = (Number(p.rotX) || 0) * Math.PI / 180;
  const ry = (Number(p.rotY) || 0) * Math.PI / 180;
  const rz = (Number(p.rotZ) || 0) * Math.PI / 180;
  model.rotation.set(rx, ry, rz);

  // Auto upright: if height is not the largest axis, model is likely Z-up or side-lying
  const mode = p.upAxis || 'auto';
  if (mode !== 'none') {
    model.updateMatrixWorld(true);
    const box0 = new T.Box3().setFromObject(model);
    const size0 = box0.getSize(new T.Vector3());
    if (mode === 'z-up' || (mode === 'auto' && size0.z > size0.y && size0.z >= size0.x * 0.85)) {
      // Common DCC export: Z is up → rotate -90° around X so Y becomes up
      model.rotation.x += -Math.PI / 2;
    } else if (mode === 'x-up' || (mode === 'auto' && size0.x > size0.y && size0.x > size0.z)) {
      model.rotation.z += Math.PI / 2;
    }
  }

  model.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(model);
  const size = box.getSize(new T.Vector3());
  const center = box.getCenter(new T.Vector3());
  model.position.sub(center);
  // Sit on ground (y=0)
  const box2 = new T.Box3().setFromObject(model);
  model.position.y -= box2.min.y;

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.4 / maxDim;
  model.scale.setScalar(scale);
  // Re-center after scale
  model.updateMatrixWorld(true);
  const box3 = new T.Box3().setFromObject(model);
  const c3 = box3.getCenter(new T.Vector3());
  model.position.x -= c3.x;
  model.position.z -= c3.z;
  model.position.y -= box3.min.y;

  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.geometry && !child.geometry.attributes.normal) {
      try { child.geometry.computeVertexNormals(); } catch (e) { void e; }
    }
    // Do NOT strip maps — textures may still be loading; clearing map made models pure white
    const mats = child.material
      ? (Array.isArray(child.material) ? child.material : [child.material])
      : [];
    for (const m of mats) {
      if (!m) continue;
      m.side = T.DoubleSide;
      m.needsUpdate = true;
    }
  });
  group.add(model);
}

function applyTint(model, color) {
  model.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (m.color) m.color.set(color);
      m.needsUpdate = true;
    }
  });
}

function applyOpacity(model, value) {
  model.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      m.transparent = value < 1;
      m.opacity = value;
      m.needsUpdate = true;
    }
  });
}