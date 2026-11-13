import * as THREE from 'three';
import {
  houseVertex, houseFragment, MAX_POINTS,
  skyVertex, skyFragment, screenVertex, screenFragment,
  coneVertex, coneFragment, portalFragment, blobFragment,
} from './shaders/world-shaders.js';
import { CONFIG } from './config.js';

// ── Gallery layout: its length depends on how many renders there are ──
export const RENDERS = CONFIG.renders || [];
const GALLERY_X0 = 45;
const RENDER_SPACING = 3.6;
const GALLERY_LEN = Math.max(11, RENDERS.length * RENDER_SPACING + 4);
export const RENDER_X = RENDERS.map((_, i) => GALLERY_X0 + GALLERY_LEN / 2 + (i - (RENDERS.length - 1) / 2) * RENDER_SPACING);
const S = GALLERY_LEN + 2.5;   // everything after the gallery moves right by this much

// ── Palette ────────────────────────────────────────────────────────────
export const PAL = {
  voidTop: '#161a3d', horizon: '#3a3c76', voidBottom: '#0e1130',
  concrete: '#cfc6ba', concreteDark: '#a99f96', rock: '#4b4573', rockDark: '#383259',
  moss: '#7fa36f', wood: '#a8744a', woodDark: '#7b5232', metal: '#8b90aa',
  ink: '#1e2247', pink: '#ff5a8a', sodium: '#ffb04a', cream: '#efe9df',
};

// ── Shared lighting uniforms (one object, referenced by every house material)
export const SHARED = {
  uLightDir:   { value: new THREE.Vector3(-0.45, 0.8, 0.5).normalize() },
  uLightColor: { value: new THREE.Color('#ffd9b8').multiplyScalar(0.62) },
  uSky:        { value: new THREE.Color('#6d70b8').multiplyScalar(0.62) },
  uGround:     { value: new THREE.Color('#3a2f5e').multiplyScalar(0.7) },
  uFogColor:   { value: new THREE.Color('#34376f') },
  uFogNear:    { value: 22 },
  uFogFar:     { value: 70 },
  uPointPos:   { value: Array.from({ length: MAX_POINTS }, () => new THREE.Vector3(0, -100, 0)) },
  uPointColor: { value: Array.from({ length: MAX_POINTS }, () => new THREE.Color(0, 0, 0)) },
  uLightingOnly: { value: 0 },
};

const matCache = new Map();
export function house(color, emissive = null) {
  const key = color + '|' + emissive;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...SHARED,
      uColor: { value: new THREE.Color(color) },
      uEmissive: { value: new THREE.Color(emissive || '#000000') },
    },
    vertexShader: houseVertex,
    fragmentShader: houseFragment,
  });
  matCache.set(key, m);
  return m;
}

// Low-poly look: split vertices so every face gets a flat normal
function faceted(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

function box(w, h, d, color, x, y, z, parent) {
  return mesh(new THREE.BoxGeometry(w, h, d), house(color), x, y, z, parent);
}

// ── Pieces ─────────────────────────────────────────────────────────────
function island(scene, x0, x1, z0, z1, seed = 1) {
  const g = new THREE.Group();
  const w = x1 - x0, d = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // Top slab with a darker lip
  box(w, 0.35, d, PAL.concrete, cx, -0.175, cz, g);
  box(w + 0.12, 0.25, d + 0.12, PAL.concreteDark, cx, -0.45, cz, g);
  // Rocky underside: a few faceted cones pointing down
  const rnd = mulberry(seed);
  const n = Math.max(2, Math.round(w / 3.2));
  for (let i = 0; i < n; i++) {
    const r = Math.min(d * 0.55, 1.6 + rnd() * 1.2);
    const h = 2.2 + rnd() * 3.2;
    const cone = new THREE.ConeGeometry(r, h, 5 + Math.floor(rnd() * 3), 2);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) > -h / 2 + 0.01 && p.getY(k) < h / 2 - 0.01) {
        p.setX(k, p.getX(k) * (0.85 + rnd() * 0.3));
        p.setZ(k, p.getZ(k) * (0.85 + rnd() * 0.3));
      }
    }
    const m = mesh(faceted(cone), house(i % 2 ? PAL.rock : PAL.rockDark),
      x0 + (i + 0.5) * (w / n) + (rnd() - 0.5), -0.55 - h / 2, cz + (rnd() - 0.5) * 0.6, g);
    m.rotation.x = Math.PI;
    m.rotation.y = rnd() * 6;
  }
  // Moss patches along the edges
  for (let i = 0; i < Math.round(w / 2.5); i++) {
    const mw = 0.6 + rnd() * 1.4;
    box(mw, 0.06, 0.4 + rnd() * 0.5, PAL.moss, x0 + 0.5 + rnd() * (w - 1), 0.01, z1 - 0.25 - rnd() * 0.3, g);
  }
  scene.add(g);
  return g;
}

function bridge(scene, x0, x1, z = 0.6) {
  const g = new THREE.Group();
  const len = x1 - x0;
  const planks = Math.round(len / 0.36);
  for (let i = 0; i < planks; i++) {
    const p = box(0.3, 0.08, 1.8, i % 2 ? PAL.wood : PAL.woodDark, x0 + 0.18 + i * (len / planks), -0.12 - Math.sin((i / planks) * Math.PI) * 0.12, z, g);
    p.rotation.y = (Math.random() - 0.5) * 0.06;
  }
  for (const s of [-1, 1]) {
    box(len, 0.05, 0.05, PAL.woodDark, (x0 + x1) / 2, 0.55, z + s * 0.9, g);
    for (const x of [x0 + 0.1, x1 - 0.1]) box(0.1, 0.8, 0.1, PAL.woodDark, x, 0.25, z + s * 0.9, g);
  }
  scene.add(g);
}

function tree(scene, x, z, s = 1, dead = false) {
  const g = new THREE.Group();
  const trunk = mesh(faceted(new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 1.2 * s, 5)), house(dead ? '#3d3448' : PAL.woodDark), 0, 0.6 * s, 0, g);
  if (dead) {
    for (let i = 0; i < 4; i++) {
      const b = mesh(faceted(new THREE.CylinderGeometry(0.02 * s, 0.05 * s, 0.9 * s, 4)), house('#3d3448'), 0, (0.9 + i * 0.25) * s, 0, g);
      b.rotation.z = (i % 2 ? 1 : -1) * (0.7 + i * 0.1);
      b.rotation.y = i * 1.7;
      b.position.x = Math.sin(i * 1.7) * 0.25 * s;
      b.position.z = Math.cos(i * 1.7) * 0.25 * s;
    }
    trunk.scale.y = 1.6;
    trunk.position.y = 0.95 * s;
  } else {
    const cols = ['#5f8f68', '#6fa173', '#86b57d'];
    for (let i = 0; i < 3; i++) {
      mesh(faceted(new THREE.ConeGeometry((0.75 - i * 0.18) * s, 0.9 * s, 6)), house(cols[i]), 0, (1.3 + i * 0.5) * s, 0, g);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * 6;
  scene.add(g);
  return g;
}

function rock(scene, x, y, z, s, color = PAL.rock) {
  const m = mesh(faceted(new THREE.DodecahedronGeometry(s, 0)), house(color), x, y, z, scene);
  m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  m.scale.y = 0.7;
  return m;
}

function lamp(scene, x, z, h = 2.6) {
  const g = new THREE.Group();
  mesh(faceted(new THREE.CylinderGeometry(0.05, 0.08, h, 6)), house(PAL.ink), 0, h / 2, 0, g);
  box(0.5, 0.06, 0.06, PAL.ink, 0.22, h - 0.05, 0, g);
  mesh(faceted(new THREE.ConeGeometry(0.18, 0.2, 6)), house(PAL.ink), 0.45, h - 0.15, 0, g);
  mesh(new THREE.SphereGeometry(0.08, 10, 8), house(PAL.sodium, PAL.sodium), 0.45, h - 0.26, 0, g);
  g.position.set(x, 0, z);
  scene.add(g);
  return new THREE.Vector3(x + 0.45, h - 0.4, z);
}

function blob(scene, x, z, r = 0.6, opacity = 0.55) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: opacity } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: blobFragment,
      transparent: true, depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.012, z);
  scene.add(m);
  return m;
}

// ── Game screens ───────────────────────────────────────────────────────
function screenMaterial(style) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tMap: { value: null },
      uTime: { value: 0 },
      uActive: { value: 0 },
      uStyle: { value: { psx: 0, toon: 1, horror: 2 }[style] },
    },
    vertexShader: screenVertex,
    fragmentShader: screenFragment,
  });
}

function gameScreen(scene, id, style, x) {
  const g = new THREE.Group();
  const W = 3.2, H = 1.8, y = 2.25, z = -1.9;
  const mat = screenMaterial(style);
  const screen = mesh(new THREE.PlaneGeometry(W, H), mat, 0, 0, 0.001, g);

  if (style === 'psx') {
    // Chunky grey CRT on a stack of crates
    box(W + 0.5, H + 0.5, 1.4, '#8f8a9c', 0, 0, -0.72, g);
    box(W + 0.2, H + 0.2, 0.06, '#56526a', 0, 0, -0.04, g);
    box(0.5, 0.12, 0.05, '#56526a', W / 2 - 0.2, -H / 2 - 0.15, 0.01, g);
    mesh(new THREE.SphereGeometry(0.05, 8, 6), house(PAL.pink, PAL.pink), W / 2 - 0.02, -H / 2 - 0.15, 0.03, g);
    const crates = new THREE.Group();
    box(1.6, 0.9, 1.2, PAL.wood, -0.85, -H / 2 - 0.25 - 0.45 - 0.05, -0.6, crates);
    box(1.6, 0.9, 1.2, PAL.woodDark, 0.85, -H / 2 - 0.25 - 0.45 - 0.05, -0.6, crates);
    g.add(crates);
    box(0.9, 0.7, 0.9, PAL.wood, 1.9, -y + 0.35, 0.9, g).rotation.y = 0.4;
  } else if (style === 'toon') {
    // Billboard on posts with a quarter-pipe in front
    box(W + 0.36, H + 0.36, 0.14, PAL.pink, 0, 0, -0.08, g);
    box(W + 0.1, 0.1, 0.3, PAL.sodium, 0, H / 2 + 0.25, 0.05, g);
    for (const s of [-1, 1]) box(0.16, y + 0.5, 0.16, PAL.ink, s * (W / 2 - 0.3), -y / 2 - 0.4, -0.2, g);
    // quarter pipe
    const R = 1.1;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(R + 0.15, 0); shape.lineTo(R + 0.15, R); shape.lineTo(R, R);
    shape.absarc(0, R, R, 0, -Math.PI / 2, true);
    const qp = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false, curveSegments: 12 });
    const ramp = mesh(qp, house('#e8dccb'), -3.3, -y, -0.1, g);
    ramp.rotation.y = 0;
    const coping = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), house(PAL.metal), -3.3 + R, -y + R, 0.65, g);
    coping.rotation.x = Math.PI / 2;
  } else {
    // Rotten wooden frame, leaning
    const frame = new THREE.Group();
    box(W + 0.4, 0.22, 0.2, '#4a3a3e', 0, H / 2 + 0.1, -0.05, frame);
    box(W + 0.5, 0.22, 0.2, '#4a3a3e', 0, -H / 2 - 0.1, -0.05, frame).rotation.z = 0.03;
    box(0.22, H + 0.3, 0.2, '#3d3036', -W / 2 - 0.1, 0, -0.05, frame);
    box(0.22, H + 0.6, 0.2, '#3d3036', W / 2 + 0.1, -0.1, -0.05, frame).rotation.z = -0.04;
    box(W, H, 0.1, '#1a1720', 0, 0, -0.12, frame);
    g.add(frame);
    for (const s of [-1, 1]) box(0.14, y, 0.14, '#3d3036', s * (W / 2 - 0.2), -y / 2 - H / 2 + 0.2, -0.2, g);
    g.rotation.z = 0.025;
  }

  g.position.set(x, y, z);
  scene.add(g);
  return { id, style, group: g, screen, material: mat, active: 0, target: 0 };
}

// ── Pedestal for the shader lab ────────────────────────────────────────
function pedestal(scene, x, z, color) {
  const g = new THREE.Group();
  mesh(faceted(new THREE.CylinderGeometry(0.72, 0.85, 0.85, 6)), house(PAL.cream), 0, 0.425, 0, g);
  mesh(faceted(new THREE.CylinderGeometry(0.78, 0.78, 0.07, 6)), house(PAL.ink, color), 0, 0.88, 0, g);
  mesh(faceted(new THREE.CylinderGeometry(0.95, 1.0, 0.1, 6)), house(PAL.concreteDark), 0, 0.05, 0, g);
  // Fixture + light cone
  box(0.5, 0.12, 0.5, PAL.ink, 0, 4.6, 0, g);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 2, 4), house(PAL.ink), 0, 5.6, 0, g);
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 1.05, 3.65, 24, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: 0.18 } },
      vertexShader: coneVertex, fragmentShader: coneFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
  );
  cone.position.y = 2.72;
  g.add(cone);
  g.position.set(x, 0, z);
  scene.add(g);
  return { group: g, cone, top: new THREE.Vector3(x, 0.92, z) };
}

// ── Renders gallery: framed pictures on a long wall ────────────────────
const pictureFragment = /* glsl */ `
uniform sampler2D tMap;
uniform float uHas;
uniform float uActive;
varying vec2 vUv;
void main(){
  vec3 c = uHas > 0.5 ? texture2D(tMap, vUv).rgb : vec3(0.82, 0.79, 0.75);
  // Picture light from above: brighter at the top, a touch brighter when in focus
  float light = mix(0.8, 1.02, smoothstep(0.0, 1.0, vUv.y)) * (0.9 + 0.1 * uActive);
  gl_FragColor = vec4(c * light, 1.0);
}
`;

function makeFrame(scene, render, x, i) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uHas: { value: 0 }, uActive: { value: 0 } },
    vertexShader: screenVertex, fragmentShader: pictureFragment,
  });
  const picture = mesh(new THREE.PlaneGeometry(1, 1), mat, 0, 0, 0.04, g);
  const board = mesh(new THREE.BoxGeometry(1, 1, 0.04), house('#f3efe7', '#2e2a26'), 0, 0, 0.0, g);
  const frameMat = house(i % 2 ? PAL.woodDark : PAL.ink);
  const bars = [0, 1, 2, 3].map(() => mesh(new THREE.BoxGeometry(1, 1, 1), frameMat, 0, 0, 0.03, g));
  const lampBar = mesh(new THREE.BoxGeometry(1, 0.06, 0.1), house('#c9a46a', '#3a2a10'), 0, 0, 0.25, g);
  const lampArm = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.25), house('#c9a46a'), 0, 0, 0.13, g);

  function layout(aspect) {
    const maxW = 2.3, maxH = 2.2;
    let w = maxW, h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    const m = 0.2, t = 0.1, d = 0.14;
    picture.scale.set(w, h, 1);
    board.scale.set(w + 2 * m, h + 2 * m, 1);
    const ow = w + 2 * m + 2 * t, oh = h + 2 * m + 2 * t;
    bars[0].scale.set(ow, t, d); bars[0].position.set(0, oh / 2 - t / 2, 0.03);
    bars[1].scale.set(ow, t, d); bars[1].position.set(0, -oh / 2 + t / 2, 0.03);
    bars[2].scale.set(t, oh, d); bars[2].position.set(-ow / 2 + t / 2, 0, 0.03);
    bars[3].scale.set(t, oh, d); bars[3].position.set(ow / 2 - t / 2, 0, 0.03);
    lampBar.scale.x = Math.min(w * 0.55, 1.2); lampBar.position.y = oh / 2 + 0.16;
    lampArm.position.y = oh / 2 + 0.16;
  }
  layout(render.aspect || 1.5);

  if (render.src) {
    new THREE.TextureLoader().load(render.src, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 4;
      mat.uniforms.tMap.value = tex;
      mat.uniforms.uHas.value = 1;
      layout(tex.image.width / tex.image.height);
    }, undefined, () => console.warn(`[renders] Could not load ${render.src}`));
  }
  g.position.set(x, 1.95, -2.5);
  scene.add(g);
  return { group: g, material: mat };
}

function buildGallery(scene) {
  const x0 = GALLERY_X0, x1 = GALLERY_X0 + GALLERY_LEN, cx = (x0 + x1) / 2;
  island(scene, x0, x1, -3.0, 2.8, 31);
  box(GALLERY_LEN - 1.0, 3.9, 0.35, '#e2dbd0', cx, 1.95, -2.75, scene);
  box(GALLERY_LEN - 0.7, 0.2, 0.55, PAL.ink, cx, 3.98, -2.7, scene);
  box(GALLERY_LEN - 1.0, 0.22, 0.42, '#b9b0a4', cx, 0.11, -2.55, scene);
  for (const sx of [-1, 1]) box(0.4, 4.1, 0.6, PAL.ink, cx + sx * (GALLERY_LEN / 2 - 0.5), 2.05, -2.7, scene);
  // A bench to sit and look
  const bench = new THREE.Group();
  box(2.4, 0.12, 0.6, PAL.wood, 0, 0.46, 0, bench);
  for (const sx of [-1, 1]) box(0.12, 0.42, 0.5, PAL.ink, sx * 1.0, 0.21, 0, bench);
  bench.position.set(cx, 0, 0.2);
  scene.add(bench);
  blob(scene, cx, 0.2, 1.4, 0.35);
  const frames = RENDERS.map((r, i) => makeFrame(scene, r, RENDER_X[i], i));
  const lights = [
    [new THREE.Vector3(cx - GALLERY_LEN / 4, 3.0, -0.4), '#fff1dc', 0.4],
    [new THREE.Vector3(cx + GALLERY_LEN / 4, 3.0, -0.4), '#fff1dc', 0.4],
  ];
  return { frames, lights };
}

// ── Avatar: a tiny low-poly player that walks the level as you scroll ──
function makeAvatar(scene) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hoodie = house(PAL.pink), pants = house(PAL.ink), skin = house('#f2c9a5'), shoe = house(PAL.cream);
  mesh(new THREE.CapsuleGeometry(0.2, 0.28, 4, 10), hoodie, 0, 0.78, 0, body);
  const head = mesh(new THREE.SphereGeometry(0.2, 14, 10), skin, 0, 1.18, 0, body);
  mesh(new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hoodie, 0, 1.2, -0.02, body).rotation.x = -0.35;
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.07, 0.02), house(PAL.ink), s * 0.075, 1.2, 0.19, head.parent);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.55, 0); body.add(hip);
    mesh(new THREE.BoxGeometry(0.12, 0.42, 0.13), pants, 0, -0.21, 0, hip);
    mesh(new THREE.BoxGeometry(0.14, 0.08, 0.22), shoe, 0, -0.44, 0.04, hip);
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * 0.25, 0.95, 0); body.add(sh);
    mesh(new THREE.CapsuleGeometry(0.06, 0.26, 3, 6), hoodie, 0, -0.18, 0, sh);
    arms.push(sh);
  }
  scene.add(g);
  const shadow = blob(scene, 0, 0, 0.45, 0.5);
  return { group: g, body, legs, arms, shadow, phase: 0 };
}

// ── Utility ────────────────────────────────────────────────────────────
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── Level layout & camera stops ────────────────────────────────────────
// focus: what the camera looks at. offset: camera position relative to focus.
// frame: 'top' = the text panel sits at the bottom, so the subject is framed above it
// (default: panel on the left, subject framed to the right).
// avatar: where the little player stands, and which way it faces (radians, 0 = toward camera).
export const STOPS = {
  hero:         { focus: [1.2, 1.3, 0],      offset: [1.6, 1.7, 9.0],  avatar: [0, 0.9, 0.35] },
  games:        { focus: [16.5, 1.6, -1],    offset: [0, 2.6, 14.5],   avatar: [16.5, 1.0, 0], frame: 'top' },
  fatalstrike:  { focus: [11.5, 2.1, -1.9], offset: [0.7, 0.45, 6.6], avatar: [13.1, 0.4, Math.PI] },
  anarchyflips: { focus: [16.5, 2.1, -1.9], offset: [0.7, 0.45, 6.6], avatar: [18.1, 0.4, Math.PI] },
  geringi:      { focus: [21.5, 2.1, -1.9], offset: [0.7, 0.45, 6.6], avatar: [23.1, 0.4, Math.PI] },
  lab:          { focus: [34.5, 1.5, -0.8],  offset: [0, 2.8, 13.0],   avatar: [36.9, 1.3, 0.3], frame: 'top' },
  about:        { focus: [48.4 + S, 1.1, -1.2], offset: [1.0, 1.8, 7.4],  avatar: [46.9 + S, 0.5, 0.5] },
  contact:      { focus: [58.5 + S, 1.6, -1.4], offset: [-0.6, 0.8, 7.8], avatar: [56.9 + S, 0.7, 2.3] },
  renders:      { focus: [GALLERY_X0 + GALLERY_LEN / 2, 1.7, -1.6], offset: [0, 2.2, Math.max(13, GALLERY_LEN * 0.85)], avatar: [GALLERY_X0 + GALLERY_LEN / 2 + 1.9, 1.1, -0.4], frame: 'top' },
};
RENDERS.forEach((r, i) => {
  STOPS[`render-${i}`] = { focus: [RENDER_X[i], 2.0, -2.4], offset: [0.35, 0.15, 6.3], avatar: [RENDER_X[i] + 1.35, 0.35, Math.PI] };
});

// Models & shaders: one pedestal per model in CONFIG.models (up to three)
export const MODEL_IDS = Object.keys(CONFIG.models || {}).slice(0, 3);
const PEDESTAL_SLOTS = [29, 34.5, 40];
const PEDESTAL_COLORS = ['#ff5a5a', '#ffb04a', '#7fe0b0'];
MODEL_IDS.forEach((id, i) => {
  const x = PEDESTAL_SLOTS[i];
  STOPS[`model-${id}`] = { focus: [x, 1.75, -0.8], offset: [0.4, 0.4, 4.9], avatar: [x + 1.25, -0.1, -1.3] };
});

export function buildWorld(scene) {
  // Sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(PAL.voidTop) },
        uHorizon: { value: new THREE.Color(PAL.horizon) },
        uBottom: { value: new THREE.Color(PAL.voidBottom) },
        uTime: { value: 0 },
      },
      vertexShader: skyVertex, fragmentShader: skyFragment,
      side: THREE.BackSide, depthWrite: false,
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // Islands and bridges
  island(scene, -5.5, 6, -3.2, 3.2, 3);
  bridge(scene, 6, 9.5);
  island(scene, 9.5, 24.5, -3.4, 3.0, 7);
  bridge(scene, 24.5, 27);
  island(scene, 27, 42.5, -3.0, 3.0, 11);
  bridge(scene, 42.5, 45);
  const gallery = buildGallery(scene);
  bridge(scene, GALLERY_X0 + GALLERY_LEN, 45 + S);
  island(scene, 45 + S, 52.5 + S, -3.0, 2.8, 19);
  // stepping stones
  [[53.3 + S, 0.5], [54.3 + S, 0.9], [55.2 + S, 0.4]].forEach(([x, z], i) => {
    box(0.8, 0.3, 0.9, PAL.concrete, x, -0.15 - i * 0.03, z, scene);
    rock(scene, x, -0.9, z, 0.45, PAL.rockDark);
  });
  island(scene, 56 + S, 62.5 + S, -3.2, 2.8, 23);

  const points = [];

  // Hero: spawn pad, lamp, trees
  const pad = mesh(new THREE.RingGeometry(0.55, 0.7, 6), house(PAL.pink, PAL.pink), 0, 0.015, 0.35, scene);
  pad.rotation.x = -Math.PI / 2;
  points.push([lamp(scene, 3.4, -1.6), PAL.sodium, 0.75]);
  tree(scene, -3.6, -2.0, 1.15); tree(scene, -2.2, -2.6, 0.85); tree(scene, -4.6, 1.6, 0.7); tree(scene, 4.8, -2.4, 0.9);
  rock(scene, -1.2, 0.1, -2.4, 0.4); rock(scene, 5.2, 0.1, 1.9, 0.3);

  // Games
  const screens = [
    gameScreen(scene, 'fatalstrike', 'psx', 11.5),
    gameScreen(scene, 'anarchyflips', 'toon', 16.5),
    gameScreen(scene, 'geringi', 'horror', 21.5),
  ];
  tree(scene, 23.6, -2.4, 1.1, true); tree(scene, 19.6, -2.8, 0.8, true); tree(scene, 24.0, 1.8, 0.7, true);
  points.push([new THREE.Vector3(16.5, 2.0, 0.2), '#8fa0ff', 0.3]);
  points.push([lamp(scene, 14.0, -1.4, 2.3), PAL.sodium, 0.55]);

  // Lab: low back wall + pedestals
  for (let i = 0; i < 6; i++) box(2.4, 1.2 + (i % 2) * 0.3, 0.3, i % 2 ? PAL.concreteDark : PAL.concrete, 28.2 + i * 2.5, 0.6, -2.6, scene);
  const pedestals = {};
  MODEL_IDS.forEach((id, i) => { pedestals[id] = pedestal(scene, PEDESTAL_SLOTS[i], -0.8, PEDESTAL_COLORS[i]); });
  points.push([new THREE.Vector3(34.5, 3.4, 1.2), '#fff2e0', 0.35]);

  // About: desk, monitor, chair, plant, shelf
  const desk = new THREE.Group();
  box(2.0, 0.08, 0.9, PAL.wood, 0, 0.78, 0, desk);
  for (const sx of [-0.92, 0.92]) for (const sz of [-0.38, 0.38]) box(0.07, 0.78, 0.07, PAL.woodDark, sx, 0.39, sz, desk);
  box(0.9, 0.55, 0.06, PAL.ink, -0.2, 1.18, -0.25, desk);
  box(0.82, 0.47, 0.01, '#000000', -0.2, 1.18, -0.215, desk).material = house('#2b2f66', '#5d63c9');
  box(0.08, 0.2, 0.08, PAL.ink, -0.2, 0.88, -0.25, desk);
  box(0.5, 0.03, 0.18, '#3a3d70', -0.2, 0.83, 0.1, desk);
  mesh(faceted(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8)), house(PAL.pink), 0.6, 0.88, 0.05, desk);
  desk.position.set(48.2 + S, 0, -1.2);
  scene.add(desk);
  const chair = new THREE.Group();
  box(0.5, 0.07, 0.5, PAL.ink, 0, 0.48, 0, chair); box(0.5, 0.6, 0.07, PAL.ink, 0, 0.8, 0.25, chair);
  box(0.06, 0.45, 0.06, PAL.metal, 0, 0.23, 0, chair);
  chair.position.set(48.0 + S, 0, -0.35); chair.rotation.y = 0.3; scene.add(chair);
  const plant = new THREE.Group();
  mesh(faceted(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 7)), house('#c86a4a'), 0, 0.2, 0, plant);
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(faceted(new THREE.ConeGeometry(0.1, 0.7, 4)), house(i % 2 ? '#6fa173' : '#86b57d'), 0, 0.65, 0, plant);
    leaf.rotation.z = Math.sin(i * 1.3) * 0.5; leaf.rotation.x = Math.cos(i * 1.3) * 0.5;
  }
  plant.position.set(46.4 + S, 0, -1.6); scene.add(plant);
  const shelf = new THREE.Group();
  for (let i = 0; i < 3; i++) box(1.6, 0.06, 0.4, PAL.woodDark, 0, 0.5 + i * 0.6, 0, shelf);
  for (const s of [-1, 1]) box(0.06, 1.8, 0.4, PAL.woodDark, s * 0.8, 0.9, 0, shelf);
  ['#ff5a8a', '#ffb04a', '#7fe0b0', '#8fa0ff', '#cfc6ba'].forEach((c, i) => box(0.12, 0.32 + (i % 3) * 0.05, 0.28, c, -0.55 + i * 0.16, 1.28, 0, shelf));
  mesh(new THREE.TorusKnotGeometry(0.13, 0.045, 48, 8), house(PAL.sodium), 0.45, 1.85, 0, shelf);
  mesh(faceted(new THREE.IcosahedronGeometry(0.16, 0)), house(PAL.pink), -0.4, 1.8, 0, shelf);
  shelf.position.set(50.8 + S, 0, -2.3); scene.add(shelf);
  points.push([new THREE.Vector3(48.9 + S, 1.9, -0.9), PAL.sodium, 0.5]);

  // Contact: door with portal
  const door = new THREE.Group();
  box(0.3, 3.0, 0.4, PAL.cream, -1.05, 1.5, 0, door); box(0.3, 3.0, 0.4, PAL.cream, 1.05, 1.5, 0, door);
  box(2.4, 0.35, 0.45, PAL.cream, 0, 3.15, 0, door);
  box(2.8, 0.15, 1.2, PAL.concreteDark, 0, 0.075, 0.3, door);
  box(2.4, 0.15, 0.8, PAL.concreteDark, 0, 0.2, 0.25, door);
  const portalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHover: { value: 0 } },
    vertexShader: screenVertex, fragmentShader: portalFragment,
  });
  mesh(new THREE.PlaneGeometry(1.8, 2.95), portalMat, 0, 1.6, 0.0, door);
  door.position.set(58.5 + S, 0, -1.6); scene.add(door);
  points.push([new THREE.Vector3(58.5 + S, 1.6, -0.6), PAL.pink, 0.5]);
  points.push(...gallery.lights);
  tree(scene, 61.2 + S, -2.2, 0.9); tree(scene, 56.4 + S, -2.4, 0.7);

  // Floating debris around the level
  const debris = [];
  const rnd = mulberry(42);
  for (let i = 0; i < 28; i++) {
    const r = rock(scene, -8 + rnd() * (74 + S), -2 - rnd() * 7, -9 + rnd() * 6 + (rnd() > 0.7 ? 14 : 0), 0.2 + rnd() * 0.7, rnd() > 0.5 ? PAL.rock : PAL.rockDark);
    debris.push({ m: r, y: r.position.y, ph: rnd() * 6, sp: 0.3 + rnd() * 0.5 });
  }

  // Register point lights
  points.slice(0, MAX_POINTS).forEach(([pos, col, k], i) => {
    SHARED.uPointPos.value[i].copy(pos);
    SHARED.uPointColor.value[i].set(col).multiplyScalar(k);
  });

  // Blob shadows under bigger props
  blob(scene, 3.4, -1.6, 0.4); blob(scene, 48.2 + S, -1.2, 1.3, 0.4); blob(scene, 50.8 + S, -2.3, 1.0, 0.4);

  const avatar = makeAvatar(scene);

  return { sky, screens, pedestals, portalMat, debris, avatar, frames: gallery.frames };
}

// ── Per-frame avatar update ────────────────────────────────────────────
export function updateAvatar(av, x, z, face, dt, moving) {
  const g = av.group;
  const dx = x - g.position.x, dz = z - g.position.z;
  const speed = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
  g.position.x = x; g.position.z = z;
  const walking = Math.min(speed / 3.5, 1);
  av.phase += Math.hypot(dx, dz) * 5.5;
  const swing = Math.sin(av.phase) * 0.7 * walking;
  av.legs[0].rotation.x = swing; av.legs[1].rotation.x = -swing;
  av.arms[0].rotation.x = -swing * 0.8; av.arms[1].rotation.x = swing * 0.8;
  av.body.position.y = Math.abs(Math.cos(av.phase)) * 0.06 * walking;
  // Face direction of travel while walking, otherwise the stop's facing
  let targetRot = face;
  if (walking > 0.15) targetRot = Math.atan2(dx, dz);
  let d = targetRot - g.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * Math.min(dt * 8, 1);
  av.shadow.position.set(x, 0.012, z);
}
