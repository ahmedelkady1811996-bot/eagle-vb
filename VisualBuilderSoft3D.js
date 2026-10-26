/*
 * Eagle Visual Builder — software rasterizer fallback.
 * JavaFX WebKit ships no WebGL, so THREE.WebGLRenderer construction throws
 * and every 3D block mounts nothing.  When WebGL is unavailable this script
 * replaces THREE.WebGLRenderer / THREE.WebGL1Renderer with a Canvas-2D
 * software renderer that renders the same THREE scene graph (meshes with
 * BufferGeometry, perspective camera, orbit controls, optional UV textures).
 * In real browsers (WebGL present) nothing is touched.
 */
(function () {
  "use strict";

  if (typeof window.__eagleSoft3D !== "undefined") return;
  window.__eagleSoft3D = true;
  window.__eagleSoftRenderer = SoftRenderer;

  function supportsWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl") || c.getContext("webgl2"));
    } catch (e) { return false; }
  }

  function mulM(e, x, y, z) {
    var w = e[3] * x + e[7] * y + e[11] * z + e[15];
    return {
      x: e[0] * x + e[4] * y + e[8] * z + e[12],
      y: e[1] * x + e[5] * y + e[9] * z + e[13],
      z: e[2] * x + e[6] * y + e[10] * z + e[14],
      w: w
    };
  }

  function colorCss(c) {
    if (c == null) return "#4a5568";
    if (typeof c === "number") {
      c = c >>> 0;
      return "rgb(" + ((c >> 16) & 255) + "," + ((c >> 8) & 255) + "," + (c & 255) + ")";
    }
    if (c.r !== undefined && c.g !== undefined && c.b !== undefined) {
      return "rgb(" + Math.round(c.r * 255) + "," + Math.round(c.g * 255) + "," + Math.round(c.b * 255) + ")";
    }
    if (c.getStyle) { try { return c.getStyle(); } catch (e) {} }
    return String(c);
  }

  function SoftRenderer(opts) {
    opts = opts || {};
    this.domElement = opts.canvas || document.createElement("canvas");
    this.domElement.width = 300;
    this.domElement.height = 150;
    this.shadowMap = { enabled: false, type: 1 };
    this.outputEncoding = undefined;
    this.outputColorSpace = undefined;
    this.physicallyCorrectLights = false;
    this._clear = "#4a5568";
    this._clearAlpha = 1;
    this._pr = 1;
  }

  SoftRenderer.prototype.setPixelRatio = function (r) { this._pr = r || 1; };
  SoftRenderer.prototype.getPixelRatio = function () { return this._pr; };

  SoftRenderer.prototype.setSize = function (w, h, updateStyle) {
    this.domElement.width = Math.max(1, Math.floor(w * this._pr));
    this.domElement.height = Math.max(1, Math.floor(h * this._pr));
    if (updateStyle !== false) { this.domElement.style.width = w + "px"; this.domElement.style.height = h + "px"; }
  };

  SoftRenderer.prototype.setClearColor = function (color, alpha) {
    this._clear = colorCss(color);
    this._clearAlpha = (alpha === undefined) ? 1 : alpha;
  };

  SoftRenderer.prototype.setAnimationLoop = function () {};
  SoftRenderer.prototype.dispose = function () {};

  SoftRenderer.prototype.render = function (scene, camera) {
    var canvas = this.domElement;
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    var W = canvas.width, H = canvas.height;
    if (!W || !H) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = (scene && scene.background) ? colorCss(scene.background) : this._clear;
    ctx.fillRect(0, 0, W, H);
    if (!scene || !camera) { return; }

    if (scene.updateMatrixWorld) { try { scene.updateMatrixWorld(true); } catch (e) {} }
    if (camera.updateMatrixWorld) { try { camera.updateMatrixWorld(true); } catch (e) {} }
    if (camera.updateProjectionMatrix) { try { camera.updateProjectionMatrix(); } catch (e) {} }
    if (camera.matrixWorldInverse && camera.matrixWorldInverse.copy && camera.matrixWorldInverse.invert) {
      try { camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); } catch (e) {}
    }

    var view = (camera.matrixWorldInverse && camera.matrixWorldInverse.elements) || null;
    var proj = (camera.projectionMatrix && camera.projectionMatrix.elements) || null;
    if (!view || !proj) return;

    var tris = [];
    var camPos = (camera.position) ? { x: camera.position.x || 0, y: camera.position.y || 0, z: camera.position.z || 0 } : { x: 0, y: 0, z: 4 };
    this._collect(scene, view, proj, W, H, tris, camPos);
    tris.sort(function (a, b) { return a.z - b.z; });

    var maxTri = 35000;
    var step = (tris.length > maxTri) ? Math.ceil(tris.length / maxTri) : 1;
    for (var i = 0; i < tris.length; i += step) { this._drawTri(ctx, tris[i]); }
    ctx.globalAlpha = 1;
  };

  SoftRenderer.prototype._collect = function (obj, view, proj, W, H, tris, camPos) {
    if (!obj) return;
    if (obj.visible === false) return;
    if (obj.isMesh && obj.geometry && obj.geometry.attributes) {
      this._collectMesh(obj, view, proj, W, H, tris, camPos);
    }
    var ch = obj.children;
    if (ch) { for (var i = 0; i < ch.length; i++) { this._collect(ch[i], view, proj, W, H, tris, camPos); } }
  };

  SoftRenderer.prototype._collectMesh = function (obj, view, proj, W, H, tris, camPos) {
    var g = obj.geometry;
    var posAttr = g.attributes.position;
    if (!posAttr || !posAttr.array) return;
    var pos = posAttr.array;
    var idxa = (g.index && g.index.array) ? g.index.array : null;

    var mat = obj.material;
    if (Object.prototype.toString.call(mat) === "[object Array]") mat = mat[0];
    var cr = 0.8, cg = 0.75, cb = 0.68;
    var twoSided = true;
    var opacity = 1;
    var mapImg = null;
    var hasUv = !!(g.attributes.uv && g.attributes.uv.array);
    if (mat) {
      if (mat.color && mat.color.r !== undefined) { cr = mat.color.r; cg = mat.color.g; cb = mat.color.b; }
      if (mat.side !== undefined) twoSided = (mat.side === 2);
      if (mat.opacity !== undefined) opacity = mat.opacity;
      if (mapImg === null && mat.map && mat.map.image) {
        var im = mat.map.image;
        if (im && (typeof im.src === "string" && im.src || im.width || im.complete || im.height)) mapImg = im;
      }
    }

    var we = (obj.matrixWorld && obj.matrixWorld.elements) ? obj.matrixWorld.elements : [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    var uvArr = hasUv ? g.attributes.uv.array : null;

    var count = idxa ? idxa.length : pos.length;
    for (var i = 0; i + 2 < count; i += 3) {
      var o0 = (idxa ? idxa[i] : i) * 3;
      var o1 = (idxa ? idxa[i + 1] : i) * 3;
      var o2 = (idxa ? idxa[i + 2] : i) * 3;
      if (o1 + 2 >= pos.length || o2 + 2 >= pos.length) continue;

      var w0 = mulM(we, pos[o0], pos[o0 + 1], pos[o0 + 2]);
      var w1 = mulM(we, pos[o1], pos[o1 + 1], pos[o1 + 2]);
      var w2 = mulM(we, pos[o2], pos[o2 + 1], pos[o2 + 2]);
      var v0 = mulM(view, w0.x, w0.y, w0.z);
      var v1 = mulM(view, w1.x, w1.y, w1.z);
      var v2 = mulM(view, w2.x, w2.y, w2.z);

      var zAvg = (v0.z + v1.z + v2.z) / 3;
      // cull behind camera
      if (v0.z > -0.05 && v1.z > -0.05 && v2.z > -0.05) continue;

      var c0 = mulM(proj, v0.x, v0.y, v0.z);
      var c1 = mulM(proj, v1.x, v1.y, v1.z);
      var c2 = mulM(proj, v2.x, v2.y, v2.z);
      if (Math.abs(c0.w) < 1e-6 || Math.abs(c1.w) < 1e-6 || Math.abs(c2.w) < 1e-6) continue;

      var nx0 = c0.x / c0.w, ny0 = c0.y / c0.w;
      var nx1 = c1.x / c1.w, ny1 = c1.y / c1.w;
      var nx2 = c2.x / c2.w, ny2 = c2.y / c2.w;

      // backface (NDC, y up): keep CCW front faces unless DoubleSide
      var area = (nx1 - nx0) * (ny2 - ny0) - (ny1 - ny0) * (nx2 - nx0);
      if (!twoSided && area <= 0) continue;

      var sx0 = (nx0 * 0.5 + 0.5) * W, sy0 = (0.5 - ny0 * 0.5) * H;
      var sx1 = (nx1 * 0.5 + 0.5) * W, sy1 = (0.5 - ny1 * 0.5) * H;
      var sx2 = (nx2 * 0.5 + 0.5) * W, sy2 = (0.5 - ny2 * 0.5) * H;

      // lighting
      var ux = v1.x - v0.x, uy = v1.y - v0.y, uz = v1.z - v0.z;
      var bxx = v2.x - v0.x, byy = v2.y - v0.y, bzz = v2.z - v0.z;
      var nxn = uy * bzz - uz * byy;
      var nyn = uz * bxx - ux * bzz;
      var nzn = ux * byy - uy * bxx;
      var len = Math.sqrt(nxn * nxn + nyn * nyn + nzn * nzn) || 1;
      nxn /= len; nyn /= len; nzn /= len;
      if (nzn > 0) { nxn = -nxn; nyn = -nyn; nzn = -nzn; }

      var lx = 0.4, ly = 0.6, lz = 0.62;
      var ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
      var d1 = (nxn * lx + nyn * ly + nzn * lz) / ll;
      var d2 = (nxn * -0.5 + nyn * 0.2 + nzn * -0.4);
      var shade = 0.4 + 0.55 * Math.max(0, d1) + 0.12 * Math.max(0, d2);
      if (shade > 1) shade = 1;
      var r = Math.round(Math.min(255, cr * 255 * shade));
      var gg = Math.round(Math.min(255, cg * 255 * shade));
      var b = Math.round(Math.min(255, cb * 255 * shade));

      var t = {
        x0: sx0, y0: sy0, x1: sx1, y1: sy1, x2: sx2, y2: sy2,
        z: zAvg, a: (opacity === undefined ? 1 : opacity),
        solid: "rgb(" + r + "," + gg + "," + b + ")",
        dark: "rgba(0,0,0," + (0.10 * shade) + ")",
        img: mapImg
      };
      if (mapImg && uvArr) {
        var u0 = (idxa ? idxa[i] : i) * 2;
        var u1 = (idxa ? idxa[i + 1] : i) * 2;
        var u2 = (idxa ? idxa[i + 2] : i) * 2;
        if (u2 + 1 < uvArr.length) {
          t.uv = [uvArr[u0], uvArr[u0 + 1], uvArr[u1], uvArr[u1 + 1], uvArr[u2], uvArr[u2 + 1]];
          t.img = mapImg;
        }
      } else if (mapImg) {
        // textured material but mesh has no UVs: flat-shade fallback
        t.img = null;
      }
      tris.push(t);
    }
  };

  SoftRenderer.prototype._drawTri = function (ctx, t) {
    ctx.globalAlpha = t.a;
    if (t.img && t.uv) {
      var im = t.img;
      var iw = im.width || im.videoWidth || 0, ih = im.height || im.videoHeight || 0;
      if (iw > 0 && ih > 0) {
        var s0x = t.uv[0] * iw, s0y = (1 - t.uv[1]) * ih;
        var s1x = t.uv[2] * iw, s1y = (1 - t.uv[3]) * ih;
        var s2x = t.uv[4] * iw, s2y = (1 - t.uv[5]) * ih;
        var d0x = t.x0, d0y = t.y0, d1x = t.x1, d1y = t.y1, d2x = t.x2, d2y = t.y2;
        var den = s0x * (s1y - s2y) + s1x * (s2y - s0y) + s2x * (s0y - s1y);
        if (Math.abs(den) > 1e-9) {
          var a = (d0x * (s1y - s2y) + d1x * (s2y - s0y) + d2x * (s0y - s1y)) / den;
          var c = (d0x * (s2x - s1x) + d1x * (s0x - s2x) + d2x * (s1x - s0x)) / den;
          var e = (d0x * (s1x * s2y - s2x * s1y) + d1x * (s2x * s0y - s0x * s2y) + d2x * (s0x * s1y - s1x * s0y)) / den;
          var b2 = (d0y * (s1y - s2y) + d1y * (s2y - s0y) + d2y * (s0y - s1y)) / den;
          var d2 = (d0y * (s2x - s1x) + d1y * (s0x - s2x) + d2y * (s1x - s0x)) / den;
          var f = (d0y * (s1x * s2y - s2x * s1y) + d1y * (s2x * s0y - s0x * s2y) + d2y * (s0x * s1y - s1x * s0y)) / den;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.closePath();
          ctx.clip();
          ctx.setTransform(a, b2, c, d2, e, f);
          ctx.drawImage(im, 0, 0);
          ctx.restore();
          ctx.globalAlpha = t.a * 0.12;
          ctx.beginPath();
          ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2);
          ctx.closePath();
          ctx.fillStyle = t.dark;
          ctx.fill();
          ctx.globalAlpha = t.a;
          return;
        }
      }
    }
    ctx.fillStyle = t.solid;
    ctx.strokeStyle = t.solid;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = t.a;
  };

  var lastThree = null;
  function ensurePatch() {
    var T = window.THREE;
    if (!T) return;
    if (T !== lastThree) {
      if (!supportsWebGL()) {
        if (T.WebGLRenderer && T.WebGLRenderer !== SoftRenderer) T.__realWebGLRenderer = T.WebGLRenderer;
        if (T.WebGL1Renderer && T.WebGL1Renderer !== SoftRenderer) T.WebGLRenderer = T.WebGL1Renderer;
        T.WebGLRenderer = SoftRenderer;
        T.WebGL1Renderer = SoftRenderer;
      }
      lastThree = T;
    }
  }

  if (window.THREE) ensurePatch();
  setInterval(ensurePatch, 250);
})();