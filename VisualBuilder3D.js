/*
 * Eagle Visual Builder — real 3D block library.
 *
 * The three_* types existed only as switch cases inside buildInnerHTML(). They
 * were never registered in CATALOG, so makeBlock() had no definition to clone
 * and addBlock('three_box') returned undefined — the palette entry never
 * appeared. Worse, the re-mount hook called buildThreeForBlock(), refreshAllThree()
 * and ensureThree(), and none of those three names was defined anywhere, so even
 * a hand-placed host rendered nothing. VisualBuilderSoft3D.js, the software
 * renderer for JavaFX WebKit (no WebGL), was copied next to the page but never
 * loaded.
 *
 * This module registers the types, builds the scenes, loads THREE + OrbitControls
 * with a CDN fallback, and re-mounts after every render. It is deliberately a
 * separate file loaded as a sibling of the scene — the first piece of the module
 * split — so it can be edited and shipped on its own.
 */
(function (global) {
  'use strict';
  if (global.__eagle3DLib) return;
  global.__eagle3DLib = true;

  /* ================= geometry ================= */

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }

  function primitiveGeometry(T, shape) {
    switch (shape) {
      case 'sphere':       return new T.SphereGeometry(1, 40, 28);
      case 'torus':        return new T.TorusGeometry(0.72, 0.3, 20, 60);
      case 'cylinder':     return new T.CylinderGeometry(0.62, 0.62, 1.4, 40);
      case 'cone':         return new T.ConeGeometry(0.72, 1.4, 40);
      case 'plane':        return new T.PlaneGeometry(1.9, 1.9, 1, 1);
      case 'icosahedron':  return new T.IcosahedronGeometry(1, 0);
      case 'dodecahedron': return new T.DodecahedronGeometry(1, 0);
      case 'torusKnot':    return new T.TorusKnotGeometry(0.62, 0.22, 110, 18);
      default:             return new T.BoxGeometry(1.45, 1.45, 1.45);
    }
  }

  function materialFor(T, p) {
    var m = new T.MeshStandardMaterial({
      color: new T.Color(p.color == null ? '#4f8cff' : p.color),
      metalness: num(p.metalness, 0.15),
      roughness: num(p.roughness, 0.6),
      flatShading: !!p.flat
    });
    if (p.emissive) {
      m.emissive = new T.Color(p.emissive);
      m.emissiveIntensity = num(p.emissiveIntensity, 1);
    }
    if (p.opacity != null && p.opacity < 1) { m.transparent = true; m.opacity = num(p.opacity, 1); }
    if (p.wireframe) m.wireframe = true;
    if (p.side === 'double') m.side = T.DoubleSide;
    return m;
  }

  /* ================= scene ================= */

  global.buildThreeForBlock = function (b, host) {
    var T = global.THREE;
    if (!T || !host) return false;
    var p = b.props || {};

    host.innerHTML = '<div class="three-badge">Three.js</div>';
    var W = Math.max(60, Math.round(host.clientWidth || b.w || 320));
    var H = Math.max(60, Math.round(host.clientHeight || b.h || 320));

    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) {
      /* no WebGL here (JavaFX WebKit). The soft renderer is patched in by
         VisualBuilderSoft3D.js, which is loaded alongside this file. */
      return false;
    }
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    renderer.setSize(W, H);
    if (p.bg) renderer.setClearColor(new T.Color(p.bg), 1);
    host.appendChild(renderer.domElement);

    var scene = new T.Scene();
    if (p.bg) scene.background = new T.Color(p.bg);

    var camera = new T.PerspectiveCamera(num(p.fov, 45), W / H, 0.1, 100);
    var d = num(p.distance, 4.4);
    camera.position.set(d * 0.68, d * 0.42, d);

    /* three lights, so metalness and roughness actually read */
    scene.add(new T.AmbientLight(0xffffff, num(p.ambient, 0.55)));
    var key = new T.DirectionalLight(0xffffff, num(p.light, 0.95));
    key.position.set(3.5, 4, 5);
    scene.add(key);
    var fill = new T.DirectionalLight(0xbcd4ff, 0.35);
    fill.position.set(-4, -1.5, 2);
    scene.add(fill);
    if (p.pointLight) {
      var pl = new T.PointLight(new T.Color(p.pointLight), 1.3, 25);
      pl.position.set(0, 2.4, 2.4);
      scene.add(pl);
    }

    var mesh = new T.Mesh(primitiveGeometry(T, p.shape || 'box'), materialFor(T, p));
    var s = num(p.scale, 1);
    mesh.scale.set(s, s, s);
    mesh.position.y = p.shape === 'plane' ? -0.9 : 0;
    scene.add(mesh);

    if (p.grid) {
      var g = new T.GridHelper(7, 28, 0x3b4763, 0x1b2334);
      g.position.y = -0.95;
      scene.add(g);
    }

    var controls = null;
    if (T.OrbitControls) {
      controls = new T.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = !!p.spin;
      controls.autoRotateSpeed = num(p.spinSpeed, 2.2);
      controls.target.set(0, 0, 0);
    }

    var running = true, raf = 0;
    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      mesh.rotation.y += p.rotate === false ? 0 : 0.006;
      mesh.rotation.x = num(p.tilt, 0);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    tick();
    host.__threeCleanup = function () {
      running = false;
      try { cancelAnimationFrame(raf); } catch (e) {}
      try { if (controls) controls.dispose(); } catch (e) {}
      try { renderer.dispose(); } catch (e) {}
    };
    return true;
  };

  /* ================= loading ================= */

  function loadScript(src, cdn) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        if (!cdn) return resolve();
        var s2 = document.createElement('script');
        s2.src = cdn;
        s2.onload = function () { resolve(); };
        s2.onerror = function () { resolve(); };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  global.ensureThree = function () {
    if (global.THREE) return Promise.resolve(global.THREE);
    if (global.__eagleThreePromise) return global.__eagleThreePromise;
    global.__eagleThreePromise =
      loadScript('vendor/three/three.min.js',
                 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js')
        .then(function () {
          return loadScript('vendor/three/OrbitControls.js',
                           'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/js/controls/OrbitControls.js');
        })
        .then(function () { return global.THREE || null; });
    return global.__eagleThreePromise;
  };

  global.refreshAllThree = function () {
    var hosts = document.querySelectorAll('.three-host[data-bid]');
    if (!hosts.length) return;
    global.ensureThree().then(function (T) {
      if (!T) return;
      var list = global.blocks || [];
      for (var i = 0; i < hosts.length; i++) {
        var host = hosts[i];
        if (host.__threeCleanup) {
          try { host.__threeCleanup(); } catch (e) {}
          host.__threeCleanup = null;
        }
        if (host.querySelector('canvas')) continue;   /* already mounted */
        var id = host.getAttribute('data-bid');
        var b = null;
        for (var j = 0; j < list.length; j++) if (list[j].id === id) { b = list[j]; break; }
        if (b) { try { global.buildThreeForBlock(b, host); } catch (e) {} }
      }
    });
  };

  /* ================= the block types ================= */

  var SHAPES = [
    ['box', 'Box', '&#9633;'], ['sphere', 'Sphere', '&#9679;'], ['torus', 'Torus', '&#9675;'],
    ['cylinder', 'Cylinder', '&#9644;'], ['cone', 'Cone', '&#9650;'], ['plane', 'Plane', '&#9646;'],
    ['icosahedron', 'Icosa', '&#9671;'], ['dodecahedron', 'Dodeca', '&#9672;'], ['torusKnot', 'Knot', '&#9678;']
  ];

  var BASE = {
    shape: 'box', color: '#4f8cff', bg: '#0b1220', metalness: 0.15, roughness: 0.6,
    emissive: null, emissiveIntensity: 1, opacity: 1, wireframe: false, flat: false,
    scale: 1, distance: 4.4, fov: 45, ambient: 0.55, light: 0.95, pointLight: null,
    spin: false, spinSpeed: 2.2, rotate: true, tilt: 0, grid: true
  };

  function shapeFields(extra) {
    var f = [
      { k: 'shape', l: 'Shape', t: 'select', o: SHAPES.map(function (x) { return x[0]; }) },
      { k: 'color', l: 'Colour', t: 'color' },
      { k: 'bg', l: 'Background', t: 'color' },
      { k: 'metalness', l: 'Metalness', t: 'slider', min: 0, max: 1, step: 0.05 },
      { k: 'roughness', l: 'Roughness', t: 'slider', min: 0, max: 1, step: 0.05 },
      { k: 'emissive', l: 'Glow', t: 'color' },
      { k: 'wireframe', l: 'Wireframe', t: 'check' },
      { k: 'flat', l: 'Flat shading', t: 'check' },
      { k: 'opacity', l: 'Opacity', t: 'slider', min: 0.1, max: 1, step: 0.05 },
      { k: 'scale', l: 'Scale', t: 'slider', min: 0.2, max: 3, step: 0.1 },
      { k: 'tilt', l: 'Tilt', t: 'slider', min: -0.8, max: 0.8, step: 0.05 },
      { k: 'distance', l: 'Camera distance', t: 'slider', min: 2, max: 10, step: 0.1 },
      { k: 'ambient', l: 'Ambient light', t: 'slider', min: 0, max: 1.5, step: 0.05 },
      { k: 'light', l: 'Key light', t: 'slider', min: 0, max: 2, step: 0.05 },
      { k: 'spin', l: 'Auto-rotate', t: 'check' },
      { k: 'grid', l: 'Floor grid', t: 'check' }
    ];
    if (extra) f = f.concat(extra);
    return f;
  }

  global.registerThreeBlocks = function () {
    var cat = (typeof CATALOG !== 'undefined' && CATALOG) || global.CATALOG;
    if (!cat || !cat.length) return 0;
    if (typeof CATEGORIES !== 'undefined' && CATEGORIES.indexOf('3D') < 0) CATEGORIES.push('3D');
    var added = 0, i, j, k;
    for (i = 0; i < SHAPES.length; i++) {
      var t = 'three_' + SHAPES[i][0];
      for (j = 0; j < cat.length; j++) if (cat[j].type === t) break;
      if (j < cat.length) continue;
      var props = {};
      for (k in BASE) props[k] = BASE[k];
      cat.push({
        type: t, cat: '3D', label: SHAPES[i][1], ic: SHAPES[i][2], w: 320, h: 320,
        props: props, fields: shapeFields()
      });
      added++;
    }
    /* the wide scene block */
    for (j = 0; j < cat.length; j++) if (cat[j].type === 'three_scene') break;
    if (j >= cat.length) {
      var sp = {};
      for (k in BASE) sp[k] = BASE[k];
      cat.push({
        type: 'three_scene', cat: '3D', label: '3D Scene', ic: '&#9707;',
        w: 800, h: 480, props: sp, fields: shapeFields([{ k: 'color2', l: 'Second colour', t: 'color' }])
      });
      added++;
    }
    return added;
  };

  /* ================= markup + re-mount ================= */

  var realBuildInner = global.buildInnerHTML;
  if (typeof realBuildInner === 'function' && !realBuildInner.__eagle3D) {
    global.buildInnerHTML = function (b) {
      if (b && typeof b.type === 'string' && b.type.indexOf('three_') === 0) {
        return '<div class="three-host" data-three="' + b.type + '" data-bid="' + b.id + '">' +
               '<div class="three-badge">Three.js</div></div>';
      }
      return realBuildInner.apply(this, arguments);
    };
    global.buildInnerHTML.__eagle3D = true;
  }

  /* styleFor already has a 3D branch; nothing to add there */

  var realRender = global.render;
  if (typeof realRender === 'function' && !realRender.__eagle3D) {
    global.render = function () {
      var r = realRender.apply(this, arguments);
      try {
        setTimeout(global.refreshAllThree, 30);
        setTimeout(global.refreshAllThree, 220);
        setTimeout(global.refreshAllThree, 900);
      } catch (e) {}
      return r;
    };
    global.render.__eagle3D = true;
  }

  /* the standard export gets a real placeholder, not an empty box */
  var realExport = global.htmlForBlockExport;
  if (typeof realExport === 'function' && !realExport.__eagle3D) {
    global.htmlForBlockExport = function (b) {
      if (b && typeof b.type === 'string' && b.type.indexOf('three_') === 0) {
        var id = global.getBlockDomId ? global.getBlockDomId(b) : b.id;
        var cls = 'vb-' + String(b.type).replace(/[^a-z0-9]/gi, '');
        return '<div id="' + id + '" class="' + cls + '" ' +
          'style="width:' + (b.w || 320) + 'px;height:' + (b.h || 320) + 'px;' +
          'background:' + (b.props && b.props.bg ? b.props.bg : '#0b1220') + ';' +
          'border-radius:8px;position:relative;overflow:hidden">' +
          '<div style="position:absolute;left:12px;top:10px;font-size:11px;color:#64748b">' +
          String(b.props && b.props.shape ? b.props.shape : b.type) + ' — 3D</div></div>';
      }
      return realExport.apply(this, arguments);
    };
    global.htmlForBlockExport.__eagle3D = true;
  }

  /* register as soon as the catalogue exists; re-try briefly if it is not */
  var tries = 0;
  (function boot() {
    try {
      var n = global.registerThreeBlocks();
      if (n) { global.__eagleThreeRegistered = n; return; }
    } catch (e) {}
    if (++tries < 12) setTimeout(boot, 250);
  })();
})(window);