import * as THREE from 'three';
import { buildWorld, updateAvatar, STOPS, SHARED, PAL, RENDERS } from './world.js';
import { Lab } from './lab.js';
import { postVertex, postFragment, uvVertex, uvFragment } from './shaders/world-shaders.js';
import { titleCardTexture, mediaTexture } from './titlecards.js';
import { CONFIG } from './config.js';
import { LAB_SHADERS } from './shaders/lab-shaders.js';

// Colors are authored in display space; skip three's color conversions.
THREE.ColorManagement.enabled = false;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

const easeInOut = (t) => t * t * t * (t * (t * 6 - 15) + 10);   // smootherstep
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

// Page structure first (works with or without WebGL)
buildModelSections();
buildRenderSections();
setupLightbox();
const nav = createNav();

if (!hasWebGL2()) {
  document.documentElement.classList.add('gl-off');
} else {
  try { init(); }
  catch (err) { console.error(err); document.documentElement.classList.add('gl-off'); }
}

function init() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.info.autoReset = false;
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;
  const maxDpr = lowPower ? 1.25 : 1.75;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);

  // Scene renders into a target with a depth texture, then a post pass draws to screen
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: new THREE.DepthTexture(1, 1),
    samples: lowPower ? 0 : 4,
  });
  const resolution = { value: new THREE.Vector2(1, 1) };
  const time = { value: 0 };

  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture },
      uResolution: resolution, uNear: { value: camera.near }, uFar: { value: camera.far },
      uTime: time, uVelocity: { value: 0 }, uMode: { value: 0 },
      uOutline: { value: 0.85 }, uOutlineColor: { value: new THREE.Color(PAL.ink) },
      uPixel: { value: 1 },
    },
    vertexShader: postVertex, fragmentShader: postFragment, depthTest: false, depthWrite: false,
  });
  const postScene = new THREE.Scene();
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const world = buildWorld(scene);
  const lab = new Lab(scene, world.pedestals, resolution, time);

  // ── Game screen textures ────────────────────────────────────────────
  document.fonts.load('800 100px "Bricolage Grotesque"').catch(() => {}).finally(() => {
    for (const s of world.screens) {
      s.material.uniforms.tMap.value = titleCardTexture(s.id);
      const media = CONFIG.games[s.id]?.media;
      if (media) mediaTexture(media).then(t => { s.material.uniforms.tMap.value = t; }).catch(e => console.warn('[screens]', e));
    }
  });

  // ── View modes ──────────────────────────────────────────────────────
  const overrides = {
    1: new THREE.MeshBasicMaterial({ color: '#9aa6ff', wireframe: true }),
    2: new THREE.MeshNormalMaterial(),
    3: new THREE.ShaderMaterial({ vertexShader: uvVertex, fragmentShader: uvFragment }),
  };
  let viewMode = 0;
  const fxObjects = [];   // transparent / helper objects that should hide in debug views
  scene.traverse(o => { if (o.material && (o.material.transparent || o.material.blending === THREE.AdditiveBlending)) fxObjects.push(o); });

  function setViewMode(m) {
    viewMode = m;
    post.uniforms.uMode.value = m;
    scene.overrideMaterial = overrides[m] || null;
    SHARED.uLightingOnly.value = m === 5 ? 1 : 0;
    const debug = m >= 1 && m <= 3;
    world.sky.visible = !debug;
    scene.background = debug ? new THREE.Color(m === 1 ? '#0d0f26' : '#202020') : null;
    fxObjects.forEach(o => o.visible = !debug && m !== 4);
    lab.debugView = debug || m === 4;
    lab.refreshOutlines();
    document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.mode) === m)));
  }
  document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => setViewMode(Number(b.dataset.mode))));

  // ── Model panels: shader picker, controls, reset ────────────────────
  const resets = {};
  document.querySelectorAll('[data-model]').forEach(panel => {
    const id = panel.dataset.model;
    const select = panel.querySelector('select');
    const desc = panel.querySelector('.shader-desc');
    const hint = panel.querySelector('[data-pointer-hint]');
    const controls = panel.querySelector('.controls');
    const show = () => {
      const def = LAB_SHADERS[lab.models[id].shaderId];
      select.value = def.id;
      desc.textContent = def.description;
      if (hint) hint.textContent = def.flashlight
        ? 'Drag the model to rotate it. Your cursor aims the flashlight.'
        : 'Drag the model to rotate it. Your cursor moves the light.';
      resets[id] = lab.buildControls(controls, id);
    };
    select.addEventListener('change', () => { lab.setShader(id, select.value); show(); });
    panel.querySelector('[data-reset]').addEventListener('click', () => resets[id]());
    show();
  });
  if (coarse) document.querySelectorAll('[data-pointer-hint]').forEach(p => p.hidden = true);

  const dialog = document.getElementById('source');
  const code = dialog.querySelector('code');
  let currentSource = null;
  const showTab = (tab) => {
    code.textContent = currentSource[tab];
    dialog.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    dialog.querySelector('pre').scrollTop = 0;
  };
  document.querySelectorAll('[data-source]').forEach(b => b.addEventListener('click', () => {
    currentSource = lab.source(b.closest('[data-model]').dataset.model);
    dialog.querySelector('.source__title').textContent = `${currentSource.name} source`;
    showTab('fragment');
    dialog.showModal();
  }));
  dialog.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  dialog.querySelector('.source__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  // ── Scroll → camera stops ───────────────────────────────────────────
  const stops = nav.sections.map(s => ({ id: s.dataset.stop, el: s, ...STOPS[s.dataset.stop] }));

  // Returns {i, t} where t is the eased progress from stop i to stop i+1
  function locate(y) {
    const anchors = nav.anchors;
    if (y <= anchors[0]) return { i: 0, t: 0 };
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y < anchors[i + 1]) {
        const raw = (y - anchors[i]) / Math.max(anchors[i + 1] - anchors[i], 1);
        // Hold still near each stop so the panel can be read, travel in between
        return { i, t: easeInOut(clamp01((raw - 0.18) / 0.64)) };
      }
    }
    return { i: anchors.length - 1, t: 0 };
  }

  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const tmpFocus = new THREE.Vector3(), tmpPos = new THREE.Vector3();
  function poseAt(i, t) {
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const fa = v3(a.focus), fb = v3(b.focus);
    const pa = fa.clone().add(v3(a.offset).multiplyScalar(distScale)), pb = fb.clone().add(v3(b.offset).multiplyScalar(distScale));
    tmpFocus.lerpVectors(fa, fb, t);
    tmpPos.lerpVectors(pa, pb, t);
    // Arc upward on long moves so the trip reads as flying over the level
    const travel = fa.distanceTo(fb);
    tmpPos.y += Math.sin(Math.PI * t) * Math.min(travel * 0.12, 2.2);
    const ax = a.avatar, bx = b.avatar;
    return {
      focus: tmpFocus, pos: tmpPos,
      avatarX: THREE.MathUtils.lerp(ax[0], bx[0], t),
      avatarZ: THREE.MathUtils.lerp(ax[1], bx[1], t),
      face: t < 0.5 ? ax[2] : bx[2],
      active: t < 0.5 ? a.id : b.id,
      // Where the subject sits on screen: beside a left panel, or above a bottom panel
      frame: THREE.MathUtils.lerp(a.frame === 'top' ? 1 : 0, b.frame === 'top' ? 1 : 0, t),
      progress: (i + t) / (stops.length - 1),
    };
  }

  // ── Pointer ─────────────────────────────────────────────────────────
  const mouse = new THREE.Vector2(0, 0), mouseSmooth = new THREE.Vector2(0, 0);
  let activeStop = 'hero';
  const overUI = (e) => e.target.closest && e.target.closest('.panel, .hud, .minimap, .stepper, dialog');
  addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (lab.drag) { lab.moveDrag(e.clientX, e.clientY); return; }
    const ui = overUI(e);
    lab.pointer = (e.pointerType === 'mouse' && !ui) ? mouse.clone() : null;
    // Show a grab cursor over a model that can be rotated
    document.body.classList.toggle('can-grab', !ui && e.pointerType !== 'touch' && !!lab.hit(mouse, camera, activeStop));
  }, { passive: true });
  document.addEventListener('pointerleave', () => { lab.pointer = null; });

  // Drag a model to rotate it (mouse and pen; touch keeps scrolling the page)
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch' || overUI(e)) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const id = lab.hit(ndc, camera, activeStop);
    if (!id) return;
    e.preventDefault();   // no text selection while dragging
    lab.startDrag(id, e.clientX, e.clientY);
    document.body.classList.add('grabbing');
  });
  const endDrag = () => { if (lab.drag) { lab.endDrag(); document.body.classList.remove('grabbing'); } };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  addEventListener('blur', endDrag);

  // ── Resize ──────────────────────────────────────────────────────────
  let wide = true;
  let distScale = 1;   // pull the camera back on narrow (portrait) screens
  let viewW = innerWidth, viewH = innerHeight, lastFrame = 0;
  // Shift the projection so the subject sits beside (or above) the text panel.
  // f = 0: panel on the left, subject to the right. f = 1: panel at the bottom, subject above.
  function applyFraming(f) {
    lastFrame = f;
    const ox = wide ? -0.17 * (1 - f) : 0;
    const oy = wide ? 0.13 * f : 0.2;
    camera.setViewOffset(viewW, viewH, ox * viewW, oy * viewH, viewW, viewH);
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
    rt.setSize(bw, bh);
    resolution.value.set(bw, bh);
    post.uniforms.uPixel.value = dpr;
    camera.aspect = w / h;
    wide = w >= 900;
    distScale = wide ? 1 : Math.min(Math.max(Math.pow(1 / camera.aspect, 0.5), 1), 1.6);
    camera.fov = wide ? 38 : 50;
    viewW = w; viewH = h;
    applyFraming(lastFrame);
  }
  addEventListener('resize', resize);
  resize();

  // ── Intro: one camera swoop from above the level down to the start ─
  let intro = reducedMotion ? 1 : 0;

  // ── Loop ────────────────────────────────────────────────────────────
  let smoothY = scrollY;
  let last = performance.now();
  let frames = 0, fpsTime = 0;
  const statEls = Object.fromEntries([...document.querySelectorAll('[data-stat]')].map(e => [e.dataset.stat, e]));
  const lookAt = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let first = true;
  let running = true;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time.value += dt;

    // Smoothed scroll
    const targetY = scrollY;
    // Arrow buttons, keys and links travel at half the speed of normal scrolling
    const rate = nav.travelling ? 2.5 : 5;
    smoothY = reducedMotion ? targetY : smoothY + (targetY - smoothY) * (1 - Math.exp(-dt * rate));
    if (nav.travelling && Math.abs(targetY - smoothY) < 2) nav.travelling = false;
    const velocity = Math.abs(targetY - smoothY) / innerHeight;
    post.uniforms.uVelocity.value = reducedMotion ? 0 : Math.min(velocity * 2.5, 1.5);

    const { i, t } = locate(smoothY);
    const pose = poseAt(i, t);

    // Camera with gentle mouse parallax
    mouseSmooth.lerp(lab.pointer ? new THREE.Vector2(0, 0) : mouse, Math.min(dt * 3, 1));
    camPos.copy(pose.pos).add(new THREE.Vector3(mouseSmooth.x * 0.35, mouseSmooth.y * 0.2, 0));
    if (intro < 1) {
      intro = Math.min(intro + dt / 2.6, 1);
      const k = easeInOut(intro);
      camPos.lerp(new THREE.Vector3(-14, 16, 26), 1 - k);
    }
    if (first) { lookAt.copy(pose.focus); first = false; }
    lookAt.lerp(pose.focus, Math.min(dt * 8, 1));
    camera.position.copy(camPos);
    camera.lookAt(lookAt);

    // Avatar
    updateAvatar(world.avatar, pose.avatarX, pose.avatarZ, pose.face, dt);

    // Screens: all on in the Games overview; the one you pick replays its reveal
    const prevStop = activeStop;
    activeStop = pose.active;
    applyFraming(pose.frame);
    for (const s of world.screens) {
      if (pose.active === s.id && prevStop !== s.id) s.active = 0;   // restart the sweep
      const target = pose.active === s.id || pose.active === 'games' ? 1 : 0;
      s.active += (target - s.active) * Math.min(dt * (target ? 2.2 : 6), 1);
      if (target && s.active > 0.995) s.active = 1;
      s.material.uniforms.uActive.value = reducedMotion ? target : s.active;
      s.material.uniforms.uTime.value = time.value;
    }

    // Pedestal light cones brighten for the model in focus
    for (const [id, p] of Object.entries(world.pedestals)) {
      const u = p.cone.material.uniforms.uIntensity;
      u.value += ((pose.active === `model-${id}` ? 0.42 : 0.16) - u.value) * Math.min(dt * 4, 1);
    }

    world.portalMat.uniforms.uTime.value = time.value;
    world.portalMat.uniforms.uHover.value += ((pose.active === 'contact' ? 1 : 0) - world.portalMat.uniforms.uHover.value) * Math.min(dt * 3, 1);
    world.sky.material.uniforms.uTime.value = time.value;
    for (const d of world.debris) d.m.position.y = d.y + Math.sin(time.value * d.sp + d.ph) * 0.25;

    lab.update(dt, camera, pose.active);

    document.body.classList.toggle('past-hero', smoothY > innerHeight * 0.5);
    nav.minimap.update(pose.progress, pose.active);

    // Framed renders brighten when in focus
    world.frames.forEach((f, k) => {
      const u = f.material.uniforms.uActive;
      u.value += ((pose.active === `render-${k}` ? 1 : 0) - u.value) * Math.min(dt * 4, 1);
    });

    // Render
    renderer.info.reset();
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);

    frames++; fpsTime += dt;
    if (fpsTime > 0.5) {
      statEls.fps.textContent = Math.round(frames / fpsTime);
      statEls.calls.textContent = renderer.info.render.calls;
      const tri = renderer.info.render.triangles;
      statEls.tris.textContent = tri > 1000 ? (tri / 1000).toFixed(1) + 'k' : tri;
      frames = 0; fpsTime = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Exposed for debugging in the console
  window.__portfolio = { renderer, scene, camera, lab, world, setViewMode };
}

// ── Model sections: one per entry in CONFIG.models ──────────────────────
function buildModelSections() {
  const slot = document.querySelector('[data-model-sections]');
  if (!slot) return;
  const frag = document.createDocumentFragment();
  Object.entries(CONFIG.models).slice(0, 3).forEach(([id, cfg], i) => {
    const sec = document.createElement('section');
    sec.className = 'stop stop--lab';
    sec.id = `model-${i + 1}`;
    sec.dataset.stop = `model-${id}`;
    sec.dataset.title = cfg.name || id;
    const options = Object.values(LAB_SHADERS).map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    sec.innerHTML = `<div class="panel panel--lab" data-model="${id}">
        <h3></h3>
        <div class="shader-pick">
          <label for="shader-${id}">Shader</label>
          <select id="shader-${id}">${options}</select>
        </div>
        <p class="shader-desc"></p>
        <p class="hint" data-pointer-hint></p>
        <div class="controls"></div>
        <div class="actions">
          <button type="button" class="btn btn--quiet" data-reset>Reset</button>
          <button type="button" class="btn btn--quiet" data-source>View source</button>
        </div>
      </div>`;
    sec.querySelector('h3').textContent = cfg.name || id;
    const def = LAB_SHADERS[cfg.shader] || LAB_SHADERS.psx;
    sec.querySelector('select').value = def.id;
    sec.querySelector('.shader-desc').textContent = def.description;
    frag.appendChild(sec);
  });
  slot.replaceWith(frag);
}

// ── Render sections: one per entry in CONFIG.renders ────────────────────
function buildRenderSections() {
  const slot = document.querySelector('[data-render-sections]');
  const jump = document.querySelector('[data-render-jump]');
  if (!slot) return;
  const frag = document.createDocumentFragment();
  RENDERS.forEach((r, i) => {
    const sec = document.createElement('section');
    sec.className = 'stop stop--render';
    sec.id = `render-${i + 1}`;
    sec.dataset.stop = `render-${i}`;
    sec.dataset.title = r.title || `Render ${i + 1}`;
    sec.innerHTML = `<figure class="panel panel--render"><h3></h3><p></p>
      <button type="button" class="btn btn--quiet" data-zoom="${i}">View full size</button></figure>`;
    sec.querySelector('h3').textContent = r.title || '';
    if (r.caption) sec.querySelector('p').textContent = r.caption;
    else sec.querySelector('p').remove();
    frag.appendChild(sec);
    if (jump) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${sec.id}`;
      a.textContent = r.title || `Render ${i + 1}`;
      li.appendChild(a); jump.appendChild(li);
    }
  });
  slot.replaceWith(frag);
}

// ── Full-size viewer for renders ─────────────────────────────────────────
function setupLightbox() {
  const box = document.getElementById('lightbox');
  const img = box.querySelector('img');
  const title = box.querySelector('.lightbox__title');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    const r = RENDERS[Number(b.dataset.zoom)];
    img.src = r.src; img.alt = r.title || '';
    title.textContent = r.title || '';
    box.showModal();
  });
  box.querySelector('.lightbox__close').addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box || e.target === img) box.close(); });
}

// ── Navigation: anchors, prev/next buttons, arrow keys, minimap ─────────
function createNav() {
  const sections = [...document.querySelectorAll('[data-stop]')];
  let anchors = [];
  const measure = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    // Wide screens: a stop is "reached" when its section is centered.
    // Narrow screens: when its section's bottom meets the screen's bottom, so the panel clears the step buttons.
    const narrow = innerWidth < 900;
    anchors = sections.map(s => {
      const r = s.getBoundingClientRect();
      const top = r.top + scrollY;
      const y = narrow ? top + r.height - innerHeight : top + r.height / 2 - innerHeight / 2;
      return clamp01(y / Math.max(max, 1)) * max;
    });
    updateStepper();
  };

  // Which stop is the page on right now (nearest anchor)
  const currentIndex = () => {
    let best = 0, bd = Infinity;
    anchors.forEach((a, i) => { const d = Math.abs(a - scrollY); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const targetIndex = (dir) => {
    const y = scrollY, eps = 4;
    // Close to a stop counts as being at that stop, so "next" is the one after it
    const cur = currentIndex();
    if (anchors.length && Math.abs(anchors[cur] - y) < innerHeight * 0.35) {
      const i = cur + dir;
      return i >= 0 && i < anchors.length ? i : -1;
    }
    if (dir > 0) { const i = anchors.findIndex(a => a > y + eps); return i === -1 ? -1 : i; }
    for (let i = anchors.length - 1; i >= 0; i--) if (anchors[i] < y - eps) return i;
    return -1;
  };
  const goTo = (i) => {
    if (i < 0 || i >= anchors.length) return;
    // Jump the page instantly; the camera glides there on its own
    window.scrollTo({ top: anchors[i], behavior: 'instant' });
    nav.travelling = true;
    updateStepper();
  };

  const prev = document.querySelector('.step--prev');
  const next = document.querySelector('.step--next');
  function updateStepper() {
    if (!prev) return;
    const pi = targetIndex(-1), ni = targetIndex(1);
    const label = (i) => i >= 0 ? sections[i].dataset.title || '' : '';
    prev.disabled = pi < 0; next.disabled = ni < 0;
    prev.querySelector('.step__label').textContent = label(pi);
    next.querySelector('.step__label').textContent = label(ni);
    prev.setAttribute('aria-label', pi >= 0 ? `Previous: ${label(pi)}` : 'Previous');
    next.setAttribute('aria-label', ni >= 0 ? `Next: ${label(ni)}` : 'Next');
  }
  // In-page links (Games list, Renders list, wordmark) land exactly on the stop, like the arrows
  const indexForHash = (hash) => {
    const el = hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    const sec = el && el.closest('[data-stop]');
    return sec ? sections.indexOf(sec) : -1;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const i = indexForHash(a.getAttribute('href'));
    if (i < 0) return;
    e.preventDefault();
    goTo(i);
    try { history.replaceState(null, '', a.getAttribute('href')); } catch {}
  });

  prev?.addEventListener('click', () => goTo(targetIndex(-1)));
  next?.addEventListener('click', () => goTo(targetIndex(1)));

  addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], dialog')) return;
    if (document.querySelector('dialog[open]')) return;
    e.preventDefault();
    goTo(targetIndex(e.key === 'ArrowRight' ? 1 : -1));
  });

  let raf = 0;
  addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(updateStepper); }, { passive: true });
  addEventListener('resize', measure);
  document.fonts.ready.then(measure);
  addEventListener('load', measure);

  // Minimap: group labels sit evenly along the track; the dot moves piecewise between them
  const mm = document.querySelector('.minimap');
  const list = mm.querySelector('ol');
  const dot = mm.querySelector('.minimap__dot');
  const n = sections.length - 1;
  const groups = sections.map((s, idx) => ({ s, idx, label: s.dataset.group })).filter(g => g.label);
  const slots = groups.length - 1;
  const buttons = groups.map((g, k) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = g.label;
    b.addEventListener('click', () => goTo(g.idx));
    li.appendChild(b); list.appendChild(li);
    return { b, idx: g.idx, pos: k / slots };
  });
  const toTrack = (progress) => {
    const x = progress * n;
    for (let k = 0; k < buttons.length - 1; k++) {
      const a = buttons[k], b = buttons[k + 1];
      if (x <= b.idx) return a.pos + (b.pos - a.pos) * clamp01((x - a.idx) / (b.idx - a.idx));
    }
    return 1;
  };
  const minimap = {
    update(progress, activeId) {
      dot.style.left = `${toTrack(progress) * 100}%`;
      const ai = sections.findIndex(s => s.dataset.stop === activeId);
      let current = buttons[0];
      for (const btn of buttons) if (btn.idx <= ai) current = btn;
      buttons.forEach(btn => btn.b.setAttribute('aria-current', String(btn === current)));
    },
  };

  const nav = { sections, get anchors() { return anchors; }, measure, minimap, currentIndex, travelling: false };
  // Manual scrolling always uses the normal (faster) follow speed
  const manual = () => { nav.travelling = false; };
  addEventListener('wheel', manual, { passive: true });
  addEventListener('touchstart', manual, { passive: true });

  measure();
  // Opened with a #section link: settle on that stop once layout is final
  const startIndex = indexForHash(location.hash);
  if (startIndex >= 0) {
    goTo(startIndex);
    document.fonts.ready.then(() => { measure(); goTo(startIndex); });
  }
  return nav;
}
