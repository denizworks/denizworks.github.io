// Models & shaders: one model per pedestal. Every shader works on every model;
// each model keeps its own settings per shader. Controls are generated from the shader's params.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LAB_SHADERS, outlineVertex, outlineFragment } from './shaders/lab-shaders.js';
import { CONFIG } from './config.js';

const DEFAULT_LIGHT = new THREE.Vector3(-0.55, 0.65, 0.6).normalize();

// ── Procedural textures for the placeholder models ─────────────────────
function canvasTex(size, draw, nearest) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}

function placeholder(kind) {
  const g = new THREE.Group();
  if (kind === 'psx') {
    // Training dummy: chunky low-poly, big faces so affine warping shows
    const tex = canvasTex(64, (x, s) => {
      x.fillStyle = '#8e2f2f'; x.fillRect(0, 0, s, s);
      x.fillStyle = '#b8473c'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 8, s, 4);
      x.fillStyle = '#e8d8b0'; x.fillRect(0, 30, s, 4); x.fillRect(30, 0, 4, s);
      x.strokeStyle = '#2a0e0e'; x.lineWidth = 2; for (let i = 2; i < s; i += 6) { x.beginPath(); x.moveTo(i, 28); x.lineTo(i + 3, 36); x.stroke(); }
    }, true);
    const wood = canvasTex(32, (x, s) => {
      x.fillStyle = '#8a5a34'; x.fillRect(0, 0, s, s);
      x.fillStyle = '#6a4224'; for (let i = 0; i < s; i += 5) x.fillRect(i, 0, 2, s);
    }, true);
    const m = (geo, map, y, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(geo, null); me.userData.map = map; me.position.y = y; me.scale.set(sx, sy, sz); g.add(me); return me; };
    m(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 6), wood, 0.5);
    m(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 6), wood, 0.06);
    m(new THREE.CylinderGeometry(0.3, 0.26, 0.75, 6, 1), tex, 1.05);
    m(new THREE.IcosahedronGeometry(0.22, 0), tex, 1.62);
    const arm = m(new THREE.BoxGeometry(1.0, 0.14, 0.14), tex, 1.25);
    arm.rotation.z = 0.08;
  } else if (kind === 'toon') {
    // Spray can + skateboard deck: curvy shapes show off bands, rim and halftone
    const label = canvasTex(256, (x, s) => {
      x.fillStyle = '#ffd23f'; x.fillRect(0, 0, s, s);
      x.fillStyle = '#ff5a8a'; x.fillRect(0, s * 0.3, s, s * 0.4);
      x.fillStyle = '#1e2247'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(i * 46 + 20, s * 0.5, 14, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#ffffff'; x.fillRect(0, s * 0.27, s, 6); x.fillRect(0, s * 0.7, s, 6);
    });
    const plain = canvasTex(8, (x, s) => { x.fillStyle = '#e9e6f2'; x.fillRect(0, 0, s, s); });
    const deckTex = canvasTex(128, (x, s) => {
      x.fillStyle = '#5b4bd1'; x.fillRect(0, 0, s, s);
      x.fillStyle = '#ffd23f'; for (let i = 0; i < s; i += 24) x.fillRect(0, i, s, 10);
    });
    const can = new THREE.Group(); g.add(can);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 40)); body.userData.map = label; body.position.y = 0.48; can.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)); top.userData.map = plain; top.position.y = 0.95; top.scale.y = 0.55; can.add(top);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 20)); cap.userData.map = plain; cap.position.y = 1.18; can.add(cap);
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.1)); nozzle.userData.map = deckTex; nozzle.position.set(0, 1.22, 0.06); can.add(nozzle);
    can.position.x = -0.15;
    const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.85, 8, 24)); deck.userData.map = deckTex;
    deck.scale.set(1, 1, 0.16); deck.position.set(0.42, 0.62, -0.12); deck.rotation.set(0.15, -0.5, -0.32); g.add(deck);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20)); w.userData.map = plain;
      w.position.set(0.42 + s * 0.12, 0.62 + s * 0.36, -0.06); w.rotation.set(0.15, -0.5, -0.32 + Math.PI / 2); g.add(w);
    }
  } else {
    // Hooded figure for the horror shader
    const cloth = canvasTex(128, (x, s) => {
      x.fillStyle = '#6b6870'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) { const v = 60 + Math.random() * 50; x.fillStyle = `rgba(${v},${v - 4},${v + 2},0.5)`; x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 6 + Math.random() * 14); }
    });
    const pts = [];
    const prof = [[0.0, 0], [0.55, 0], [0.5, 0.15], [0.42, 0.5], [0.33, 0.9], [0.26, 1.2], [0.2, 1.36], [0.0, 1.38]];
    prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
    const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 28)); robe.userData.map = cloth; g.add(robe);
    // Hood: a sphere shell with an opening facing the viewer (+z)
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 20, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.72)); hood.userData.map = cloth;
    hood.position.y = 1.5; hood.scale.set(1, 1.2, 1.1); g.add(hood);
    const voidTex = canvasTex(4, (x) => { x.fillStyle = '#14100f'; x.fillRect(0, 0, 4, 4); });
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14)); face.userData.map = voidTex;
    face.position.set(0, 1.47, -0.02); face.scale.set(0.95, 1.1, 0.9); g.add(face);
    const paleTex = canvasTex(4, (x) => { x.fillStyle = '#efe6c8'; x.fillRect(0, 0, 4, 4); });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8)); eye.userData.map = paleTex;
      eye.position.set(s * 0.07, 1.5, 0.17); eye.scale.set(1, 0.6, 0.6); g.add(eye);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.75, 12)); arm.userData.map = cloth;
      arm.position.set(s * 0.33, 0.98, 0.04); arm.rotation.z = s * 0.12; g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8)); hand.userData.map = paleTex;
      hand.position.set(s * 0.38, 0.58, 0.05); hand.scale.set(0.9, 1.7, 0.9); g.add(hand);
    }
  }
  return g;
}

// ── Shader state: one per (model, shader) pair ─────────────────────────
function toUniform(p, v) {
  if (p.type === 'toggle') return v ? 1 : 0;
  if (p.type === 'color') return new THREE.Color(v);
  return v;
}

function makeShaderState(def, resolution, time) {
  const params = {};
  for (const [k, p] of Object.entries(def.params)) params[k] = { value: toUniform(p, p.value) };
  return {
    def,
    params,
    common: { uLightDir: { value: DEFAULT_LIGHT.clone() }, uResolution: resolution, uTime: time },
    extra: def.flashlight ? {
      uFlashPos: { value: new THREE.Vector3() },
      uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
    } : {},
    outlineMat: def.outline ? new THREE.ShaderMaterial({
      uniforms: { uOutlineWidth: params.uOutlineWidth, uOutlineColor: params.uOutlineColor, uResolution: resolution },
      vertexShader: outlineVertex, fragmentShader: outlineFragment, side: THREE.BackSide,
    }) : null,
  };
}

function materialFor(state, part) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...state.params, ...state.common, ...state.extra,
      uMap: { value: part.map || null },
      uHasMap: { value: part.map ? 1 : 0 },
      uBaseColor: { value: part.color || new THREE.Color(1, 1, 1) },
      uObjScale: { value: part.objScale },
    },
    vertexShader: state.def.vertexShader,
    fragmentShader: state.def.fragmentShader,
    vertexColors: part.vc,
  });
}

// Collect every mesh of a model with what the shaders need from its original material
function collectParts(root, textureMode) {
  const parts = [];
  root.updateMatrixWorld(true);
  const ws = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const map = o.userData.map || (src && src.map) || null;
    if (map) {
      map.colorSpace = THREE.NoColorSpace;
      if (textureMode === 'pixelated') {
        // Palette / pixel-art textures: no filtering at all, so colors never bleed between cells
        map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false;
      } else if (textureMode === 'nearest') {
        map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestMipmapNearestFilter;
      }
      map.needsUpdate = true;
    }
    o.getWorldScale(ws);
    o.frustumCulled = false;
    parts.push({
      mesh: o, map,
      color: src && src.color ? src.color.clone() : null,
      vc: !!o.geometry.attributes.color,
      objScale: ws.x * 0.6,
      mats: {},          // material per shader id, created on first use
      outline: null,     // inverted-hull mesh, created when a shader with outlines is first used
    });
  });
  return parts;
}

// Scale a model to a target size, centered on x/z, resting on y = 0.
// mode 'height' fits the height; 'max' fits the longest side (good for props like weapons).
function fit(root, height, mode = 'height') {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const ref = mode === 'max' ? Math.max(size.x, size.y, size.z) : size.y;
  const s = height / Math.max(ref, 1e-4);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = b2.getCenter(new THREE.Vector3());
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b2.min.y;
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

// ── Public ─────────────────────────────────────────────────────────────
export class Lab {
  // pedestals: { [modelId]: { top: Vector3 } }
  constructor(scene, pedestals, resolution, time) {
    this.scene = scene;
    this.resolution = resolution;
    this.time = time;
    this.models = {};
    this.mixers = [];
    this.pointer = null;      // NDC while the mouse is over the 3D view, else null
    this.drag = null;         // { id, lastX, lastY }
    this.raycaster = new THREE.Raycaster();

    const gltf = new GLTFLoader();
    gltf.setDRACOLoader(new DRACOLoader().setDecoderPath('vendor/three/examples/jsm/libs/draco/'));
    gltf.setMeshoptDecoder(MeshoptDecoder);

    for (const [id, cfg] of Object.entries(CONFIG.models)) {
      if (!pedestals[id]) continue;
      const defaultShader = LAB_SHADERS[cfg.shader] ? cfg.shader : 'psx';
      // holder: turntable + drag rotation, pivoting at the model's center
      const holder = new THREE.Group();
      holder.position.copy(pedestals[id].top);
      holder.rotation.y = THREE.MathUtils.degToRad(cfg.rotationY || 0);
      const content = new THREE.Group();
      holder.add(content);
      scene.add(holder);

      const m = this.models[id] = {
        id, cfg, holder, content, parts: [], states: {}, shaderId: defaultShader, defaultShader,
        spin: cfg.spin ?? 0.25, spinPause: 0, velY: 0, tiltTarget: 0,
        sphere: new THREE.Sphere(pedestals[id].top.clone().add(new THREE.Vector3(0, 0.9, 0)), 1.0),
        ready: false, onReady: null,
      };

      const install = (root, mode) => {
        const box = fit(root, cfg.height || 1.6, cfg.fit || 'height');
        const h = box.max.y - box.min.y;
        root.position.y += cfg.lift || 0;
        // Move the pivot to the model's middle so drag-tilting looks natural
        holder.position.y += h / 2 + (cfg.lift || 0);
        content.position.y = -(h / 2 + (cfg.lift || 0));
        content.add(root);
        const textureMode = cfg.pixelated ? 'pixelated' : (defaultShader === 'psx' ? 'nearest' : 'linear');
        m.parts = collectParts(root, textureMode);
        m.sphere.center.copy(holder.position);
        m.sphere.radius = Math.max(h, box.max.x - box.min.x, box.max.z - box.min.z) * 0.55;
        m.ready = true;
        this.setShader(id, m.shaderId);
        if (m.onReady) m.onReady();
      };

      const usePlaceholder = () => install(placeholder(defaultShader));

      if (cfg.src) {
        const onLoad = (res) => {
          const root = res.scene;
          // Leave out objects by name (e.g. stray helpers exported with the model)
          if (cfg.exclude && cfg.exclude.length) {
            const drop = [];
            root.traverse(o => { if (cfg.exclude.includes(o.name)) drop.push(o); });
            drop.forEach(o => o.removeFromParent());
          }
          // Optional tilt (degrees), applied before fitting so the bounds match what you see
          const r = (cfg.rotation || [0, 0, 0]).map(THREE.MathUtils.degToRad);
          root.rotation.set(r[0], r[1], r[2]);
          const wrap = new THREE.Group();
          wrap.add(root);
          install(wrap);
          if (res.animations && res.animations.length && cfg.animation !== null && cfg.animation !== undefined) {
            const mixer = new THREE.AnimationMixer(root);
            mixer.clipAction(res.animations[Math.min(cfg.animation, res.animations.length - 1)]).play();
            this.mixers.push(mixer);
          }
        };
        const onError = (err) => {
          console.warn(`[models] Could not load ${cfg.src}, using placeholder.`, err);
          usePlaceholder();
        };
        if (cfg.src.endsWith('.js')) {
          // A .glb wrapped in a JS module as base64 (for hosts that won't serve .glb)
          import(new URL('../' + cfg.src, import.meta.url).href).then((mod) => {
            const bin = atob(mod.default);
            const buf = new Uint8Array(bin.length);
            for (let k = 0; k < bin.length; k++) buf[k] = bin.charCodeAt(k);
            gltf.parse(buf.buffer, '', onLoad, onError);
          }).catch(onError);
        } else {
          gltf.load(cfg.src, onLoad, undefined, onError);
        }
      } else {
        usePlaceholder();
      }
    }
  }

  state(id, shaderId = this.models[id].shaderId) {
    const m = this.models[id];
    if (!m.states[shaderId]) m.states[shaderId] = makeShaderState(LAB_SHADERS[shaderId], this.resolution, this.time);
    return m.states[shaderId];
  }

  // Swap a model to another shader (its settings for that shader are kept)
  setShader(id, shaderId) {
    const m = this.models[id];
    m.shaderId = shaderId;
    if (!m.ready) return;
    const st = this.state(id, shaderId);
    for (const part of m.parts) {
      if (!part.mats[shaderId]) part.mats[shaderId] = materialFor(st, part);
      part.mesh.material = part.mats[shaderId];
      if (st.outlineMat && !part.outline) {
        const o = part.mesh;
        let ol;
        if (o.isSkinnedMesh) { ol = new THREE.SkinnedMesh(o.geometry, st.outlineMat); ol.bind(o.skeleton, o.bindMatrix); }
        else ol = new THREE.Mesh(o.geometry, st.outlineMat);
        ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
        ol.frustumCulled = false;
        o.parent.add(ol);
        part.outline = ol;
      }
      if (part.outline) {
        if (st.outlineMat) part.outline.material = st.outlineMat;
        part.outline.visible = !!st.outlineMat && st.params.uOutline.value > 0.5 && !this.debugView;
      }
    }
  }

  refreshOutlines() {
    for (const id of Object.keys(this.models)) {
      const m = this.models[id];
      if (m.ready) this.setShader(id, m.shaderId);
    }
  }

  // ── Controls for a model's current shader ───────────────────────────
  buildControls(container, id) {
    const m = this.models[id];
    const shaderId = m.shaderId;
    const state = this.state(id);
    container.innerHTML = '';
    const inputs = [];
    for (const [key, p] of Object.entries(state.def.params)) {
      const row = document.createElement('div');
      row.className = `ctl ctl--${p.type}`;
      const inputId = `ctl-${id}-${shaderId}-${key}`;
      const current = state.params[key].value;
      if (p.type === 'range') {
        row.innerHTML = `<label for="${inputId}">${p.label}</label><output for="${inputId}"></output>
          <input id="${inputId}" type="range" min="${p.min}" max="${p.max}" step="${p.step}">`;
        const input = row.querySelector('input'), out = row.querySelector('output');
        const decimals = (String(p.step).split('.')[1] || '').length;
        const set = (v) => { input.value = v; out.textContent = Number(v).toFixed(decimals); state.params[key].value = Number(v); input.style.setProperty('--fill', ((v - p.min) / (p.max - p.min) * 100) + '%'); };
        input.addEventListener('input', () => set(input.value));
        inputs.push(() => set(p.value)); set(current);
      } else if (p.type === 'toggle') {
        row.innerHTML = `<input id="${inputId}" type="checkbox" role="switch"><label for="${inputId}">${p.label}</label>`;
        const input = row.querySelector('input');
        const set = (v) => { input.checked = v; state.params[key].value = v ? 1 : 0; if (key === 'uOutline') this.setShader(id, m.shaderId); };
        input.addEventListener('change', () => set(input.checked));
        inputs.push(() => set(p.value)); set(current > 0.5);
      } else if (p.type === 'color') {
        row.innerHTML = `<label for="${inputId}">${p.label}</label><input id="${inputId}" type="color">`;
        const input = row.querySelector('input');
        const set = (v) => { input.value = v; state.params[key].value.set(v); };
        input.addEventListener('input', () => set(input.value));
        inputs.push(() => set(p.value)); set('#' + current.getHexString());
      }
      container.appendChild(row);
    }
    return () => inputs.forEach(f => f());   // reset to this shader's defaults
  }

  source(id) {
    const d = LAB_SHADERS[this.models[id].shaderId];
    return { vertex: d.vertexShader.trim(), fragment: d.fragmentShader.trim(), name: d.name };
  }

  // ── Drag to rotate ──────────────────────────────────────────────────
  // Returns the id of the model under the pointer, if it is the one in focus
  hit(ndc, camera, activeStop) {
    for (const m of Object.values(this.models)) {
      if (`model-${m.id}` !== activeStop || !m.ready) continue;
      this.raycaster.setFromCamera(ndc, camera);
      if (this.raycaster.ray.intersectsSphere(m.sphere)) return m.id;
    }
    return null;
  }
  startDrag(id, x, y) { this.drag = { id, lastX: x, lastY: y, lastT: performance.now() }; this.models[id].velY = 0; }
  moveDrag(x, y) {
    if (!this.drag) return;
    const m = this.models[this.drag.id];
    const now = performance.now();
    const dx = x - this.drag.lastX, dy = y - this.drag.lastY;
    const dtMove = Math.max((now - this.drag.lastT) / 1000, 1 / 240);
    this.drag.lastX = x; this.drag.lastY = y; this.drag.lastT = now;
    m.holder.rotation.y += dx * 0.01;
    // Radians per second, for a little momentum on release
    m.velY = THREE.MathUtils.clamp((dx * 0.01) / dtMove, -6, 6);
    m.tiltTarget = THREE.MathUtils.clamp(m.tiltTarget + dy * 0.006, -0.6, 0.6);
  }
  endDrag() {
    if (!this.drag) return;
    const m = this.models[this.drag.id];
    if (performance.now() - this.drag.lastT > 120) m.velY = 0;   // held still before letting go
    m.spinPause = 2.5;     // let the model rest before the turntable resumes
    this.drag = null;
  }

  // ── Per frame ────────────────────────────────────────────────────────
  update(dt, camera, activeStop) {
    for (const mx of this.mixers) mx.update(dt);

    for (const m of Object.values(this.models)) {
      const focused = `model-${m.id}` === activeStop;
      const dragging = this.drag && this.drag.id === m.id;

      // Turntable, drag momentum, and tilt easing back to level
      if (!dragging) {
        m.holder.rotation.y += m.velY * dt;
        m.velY *= Math.exp(-dt * 4);
        if (m.spinPause > 0) m.spinPause -= dt;
        else m.holder.rotation.y += dt * (focused && this.pointer ? m.spin * 0.25 : m.spin);
        m.tiltTarget *= Math.exp(-dt * 1.5);
      }
      m.holder.rotation.x += (m.tiltTarget - m.holder.rotation.x) * Math.min(dt * 10, 1);

      if (!m.ready) continue;
      const state = this.state(m.id);
      const L = state.common.uLightDir.value;
      if (focused && this.pointer && !state.def.flashlight && !dragging) {
        // Cursor = light source
        const target = new THREE.Vector3(this.pointer.x * 1.4, 0.35 + this.pointer.y * 0.9, 0.75).normalize();
        L.lerp(target, Math.min(dt * 10, 1)).normalize();
      } else if (!dragging) {
        L.lerp(DEFAULT_LIGHT, Math.min(dt * 3, 1)).normalize();
      }

      if (state.def.flashlight) {
        const center = m.sphere.center.clone();
        let aim;
        if (focused && this.pointer) {
          this.raycaster.setFromCamera(this.pointer, camera);
          const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -center.z);
          aim = new THREE.Vector3();
          if (!this.raycaster.ray.intersectPlane(plane, aim)) aim.copy(center);
        } else {
          const t = performance.now() / 1000;
          aim = center.clone().add(new THREE.Vector3(Math.sin(t * 0.7) * 0.35, Math.sin(t * 1.1) * 0.3, 0));
        }
        const pos = camera.position.clone().add(new THREE.Vector3(0.35, -0.25, -0.2));
        state.extra.uFlashPos.value.copy(pos);
        state.extra.uFlashDir.value.lerp(aim.sub(pos).normalize(), Math.min(dt * 12, 1)).normalize();
      }
    }
  }
}
