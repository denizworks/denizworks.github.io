// The three shaders in the Models & shaders section, one model each.
//
// `params` drive the on-page controls. Each param's key is the uniform name.
//   range:  { min, max, step, value }
//   toggle: { value: true/false }   -> uniform float 0/1
//   color:  { value: '#rrggbb' }

import { SKIN_PARS, SKIN_MAIN, NOISE, BAYER } from './chunks.js';

// Uniforms every lab material receives (set by lab.js, not shown as controls)
export const COMMON_UNIFORMS = `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uBaseColor;
uniform vec3 uLightDir;
uniform vec2 uResolution;
uniform float uTime;
`;

// ─────────────────────────────────────────────────────────────
//  1. PSX renderer
// ─────────────────────────────────────────────────────────────
const psxVertex = /* glsl */ `
${SKIN_PARS}
${COMMON_UNIFORMS}
uniform float uSnap;
uniform float uSnapRes;
uniform float uVertexLight;
uniform float uFogDensity;

varying vec2 vUv;
varying vec3 vUvAffine;   // uv * w, w  -> divided per pixel = affine mapping
varying vec3 vLight;
varying vec3 vNormal;
varying float vFog;
varying vec3 vColor;

vec3 psxLight(vec3 n){
  float ndl = max(dot(n, uLightDir), 0.0);
  return vec3(0.32, 0.30, 0.42) + vec3(1.0, 0.92, 0.80) * ndl;
}

void main(){
  ${SKIN_MAIN}
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec4 view  = viewMatrix * world;
  vec4 clip  = projectionMatrix * view;

  // Snap vertices to a low-resolution screen grid (the PS1 had no sub-pixel precision)
  if (uSnap > 0.5) {
    vec2 grid = vec2(uSnapRes * uResolution.x / uResolution.y, uSnapRes) * 0.5;
    vec3 ndc = clip.xyz / clip.w;
    ndc.xy = floor(ndc.xy * grid + 0.5) / grid;
    clip.xyz = ndc * clip.w;
  }
  gl_Position = clip;

  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  vNormal = n;
  vLight = psxLight(n);              // Gouraud: lighting per vertex
  vUv = uv;
  vUvAffine = vec3(uv * clip.w, clip.w);

  float d = -view.z;
  vFog = 1.0 - exp(-pow(d * uFogDensity, 2.0));

  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color.rgb;
  #endif
}
`;

const psxFragment = /* glsl */ `
${COMMON_UNIFORMS}
${BAYER}
uniform float uAffine;
uniform float uVertexLight;
uniform float uColorBits;
uniform float uDither;
uniform float uDitherScale;
uniform vec3 uTint;

varying vec2 vUv;
varying vec3 vUvAffine;
varying vec3 vLight;
varying vec3 vNormal;
varying float vFog;
varying vec3 vColor;

void main(){
  // Mix perspective-correct UVs with affine (screen-linear) UVs -> texture swim
  vec2 uvAffine = vUvAffine.xy / vUvAffine.z;
  vec2 uv = mix(vUv, uvAffine, uAffine);

  vec3 tex = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : vec3(1.0);
  vec3 base = tex * uBaseColor * vColor * uTint;

  vec3 n = normalize(vNormal);
  vec3 pixelLight = vec3(0.32, 0.30, 0.42) + vec3(1.0, 0.92, 0.80) * max(dot(n, uLightDir), 0.0);
  vec3 light = mix(pixelLight, vLight, uVertexLight);

  vec3 col = base * light;
  col = mix(col, vec3(0.118, 0.133, 0.278), vFog);

  // Reduce color depth, with an ordered 4x4 dither like the PS1's 15-bit output
  float levels = pow(2.0, uColorBits) - 1.0;
  float d = uDither > 0.5 ? bayer4(floor(gl_FragCoord.xy / uDitherScale)) - 0.5 : 0.0;
  col = floor(col * levels + 0.5 + d) / levels;

  gl_FragColor = vec4(col, 1.0);
}
`;

export const PSX = {
  id: 'psx',
  name: 'PSX',
  description: 'Recreates the PlayStation\'s hardware limits: vertices snap to a coarse grid, textures warp without perspective correction, and color drops to 15-bit with ordered dithering.',
  vertexShader: psxVertex,
  fragmentShader: psxFragment,
  textureFilter: 'nearest',
  params: {
    uSnap:        { type: 'toggle', label: 'Vertex snapping', value: true },
    uSnapRes:     { type: 'range',  label: 'Snap grid', min: 40, max: 480, step: 1, value: 140 },
    uAffine:      { type: 'range',  label: 'Affine texture warp', min: 0, max: 1, step: 0.01, value: 1 },
    uVertexLight: { type: 'toggle', label: 'Per-vertex lighting', value: true },
    uColorBits:   { type: 'range',  label: 'Color depth (bits)', min: 2, max: 8, step: 1, value: 5 },
    uDither:      { type: 'toggle', label: 'Dithering', value: true },
    uDitherScale: { type: 'range',  label: 'Dither pixel size', min: 1, max: 4, step: 1, value: 2 },
    uFogDensity:  { type: 'range',  label: 'Fog', min: 0, max: 0.4, step: 0.005, value: 0.08 },
    uTint:        { type: 'color',  label: 'Tint', value: '#ffffff' },
  },
};

// ─────────────────────────────────────────────────────────────
//  2. Stylized toon
// ─────────────────────────────────────────────────────────────
const toonVertex = /* glsl */ `
${SKIN_PARS}
${COMMON_UNIFORMS}
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;

void main(){
  ${SKIN_MAIN}
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * objectNormal);
  vUv = uv;
  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color.rgb;
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const toonFragment = /* glsl */ `
${COMMON_UNIFORMS}
uniform float uBands;
uniform float uSoftness;
uniform vec3 uShadowTint;
uniform float uRim;
uniform float uRimWidth;
uniform float uSpec;
uniform float uSpecSize;
uniform float uHalftone;
uniform float uHalftoneScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;

void main(){
  vec3 tex = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : vec3(1.0);
  vec3 base = tex * uBaseColor * vColor;

  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uLightDir;

  // Half-lambert, cut into hard bands
  float ndl = dot(N, L) * 0.5 + 0.5;
  float x = ndl * uBands;
  float band = (floor(x) + smoothstep(0.5 - uSoftness, 0.5 + uSoftness, fract(x))) / uBands;
  band = clamp(band, 0.0, 1.0);

  vec3 shadowCol = base * uShadowTint;
  vec3 litCol = base * vec3(1.05, 1.0, 0.94);
  vec3 col = mix(shadowCol, litCol, band);

  // Screen-space halftone dots in the shadowed half
  if (uHalftone > 0.5) {
    vec2 p = gl_FragCoord.xy / uHalftoneScale;
    p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
    float r = length(fract(p) - 0.5);
    float coverage = clamp((1.0 - ndl) * 1.25 - 0.15, 0.0, 1.0);
    float dotMask = 1.0 - smoothstep(coverage * 0.62 - 0.04, coverage * 0.62 + 0.04, r);
    col = mix(col, shadowCol * 0.62, dotMask);
  }

  // Specular blob
  vec3 H = normalize(L + V);
  float s = dot(N, H);
  float spec = smoothstep(1.0 - uSpecSize, 1.0 - uSpecSize + 0.004, s) * uSpec;
  col = mix(col, vec3(1.0), spec);

  // Rim light, only on the lit side
  float fres = 1.0 - max(dot(N, V), 0.0);
  float rim = smoothstep(1.0 - uRimWidth, 1.0 - uRimWidth + 0.02, fres) * smoothstep(0.35, 0.6, ndl);
  col = mix(col, vec3(1.0, 0.97, 0.9), rim * uRim);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Inverted-hull outline: drawn back faces pushed out along the normal, in pixels
export const outlineVertex = /* glsl */ `
${SKIN_PARS}
uniform float uOutlineWidth;
uniform vec2 uResolution;
void main(){
  ${SKIN_MAIN}
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * world;
  vec3 vn = normalize(mat3(viewMatrix) * normalize(mat3(modelMatrix) * objectNormal));
  vec2 dir = normalize(vn.xy + 1e-5);
  clip.xy += dir * uOutlineWidth * 2.0 / uResolution * clip.w;
  gl_Position = clip;
}
`;
export const outlineFragment = /* glsl */ `
uniform vec3 uOutlineColor;
void main(){ gl_FragColor = vec4(uOutlineColor, 1.0); }
`;

export const TOON = {
  id: 'toon',
  name: 'Toon',
  description: 'Hard bands of light with a tinted shadow color, halftone dots in the shadows, a specular highlight, rim light and an inverted-hull outline.',
  vertexShader: toonVertex,
  fragmentShader: toonFragment,
  textureFilter: 'linear',
  outline: true,
  params: {
    uBands:         { type: 'range',  label: 'Light bands', min: 1, max: 5, step: 1, value: 2 },
    uSoftness:      { type: 'range',  label: 'Band edge softness', min: 0, max: 0.5, step: 0.01, value: 0.03 },
    uShadowTint:    { type: 'color',  label: 'Shadow color', value: '#7a63e0' },
    uHalftone:      { type: 'toggle', label: 'Halftone shadows', value: true },
    uHalftoneScale: { type: 'range',  label: 'Dot size', min: 3, max: 16, step: 0.5, value: 6 },
    uRim:           { type: 'range',  label: 'Rim light', min: 0, max: 1, step: 0.01, value: 0.7 },
    uRimWidth:      { type: 'range',  label: 'Rim width', min: 0.05, max: 0.9, step: 0.01, value: 0.32 },
    uSpec:          { type: 'range',  label: 'Specular', min: 0, max: 1, step: 0.01, value: 0.9 },
    uSpecSize:      { type: 'range',  label: 'Highlight size', min: 0.002, max: 0.12, step: 0.001, value: 0.025 },
    uOutline:       { type: 'toggle', label: 'Outline', value: true },
    uOutlineWidth:  { type: 'range',  label: 'Outline width (px)', min: 0, max: 8, step: 0.1, value: 2.5 },
    uOutlineColor:  { type: 'color',  label: 'Outline color', value: '#1e2247' },
  },
};

// ─────────────────────────────────────────────────────────────
//  3. Stylized horror
// ─────────────────────────────────────────────────────────────
const horrorVertex = /* glsl */ `
${SKIN_PARS}
${COMMON_UNIFORMS}
uniform float uWobble;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
varying vec3 vColor;
varying float vViewDepth;

void main(){
  ${SKIN_MAIN}
  vObj = position;
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  // Slow "breathing" swell along the normal
  world.xyz += n * sin(uTime * 1.7 + world.y * 5.0) * uWobble * 0.025;
  vWorld = world.xyz;
  vNormal = n;
  vUv = uv;
  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color.rgb;
  #endif
  vec4 view = viewMatrix * world;
  vViewDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const horrorFragment = /* glsl */ `
${COMMON_UNIFORMS}
${NOISE}
uniform vec3 uFlashPos;
uniform vec3 uFlashDir;
uniform float uFlashOn;
uniform float uFlashCone;
uniform float uDarkness;
uniform float uHatch;
uniform float uHatchScale;
uniform float uFogDensity;
uniform float uGrain;
uniform float uDissolve;
uniform vec3 uEdgeColor;
uniform float uObjScale;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
varying vec3 vColor;
varying float vViewDepth;

float hatchLines(vec2 fc, float angle, float spacing){
  float c = cos(angle), s = sin(angle);
  float t = (c * fc.x + s * fc.y) / spacing;
  return smoothstep(0.18, 0.42, abs(fract(t) - 0.5) * 2.0);
}

void main(){
  // Rot / dissolve, driven by noise in object space so it sticks to the model
  float n = fbm(vObj * uObjScale * 3.0);
  float cut = uDissolve * 1.08 - 0.04;
  if (n < cut) discard;
  float edge = (uDissolve > 0.001) ? 1.0 - smoothstep(cut, cut + 0.05, n) : 0.0;

  vec3 tex = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : vec3(1.0);
  vec3 base = tex * uBaseColor * vColor;

  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;

  // Light intensity: a flashlight cone plus a little moonlight
  vec3 toFrag = vWorld - uFlashPos;
  float dist = length(toFrag);
  vec3 fd = toFrag / dist;
  float cone = smoothstep(cos(uFlashCone), cos(uFlashCone * 0.75), dot(fd, uFlashDir));
  float lam = max(dot(N, -fd), 0.0);
  float flash = cone * lam * 9.0 / (1.0 + dist * dist * 0.3) * uFlashOn;
  float moon = smoothstep(0.0, 0.35, dot(N, uLightDir)) * (1.0 - uDarkness) * 0.6;
  float I = flash + moon + 0.03;

  // Three graphic tones: ink black, cold mid, warm lit
  float mid = smoothstep(0.16, 0.2, I);
  float lit = smoothstep(0.62, 0.68, I);
  vec3 tone = mix(vec3(0.03, 0.035, 0.05), mix(vec3(0.32, 0.38, 0.46), vec3(1.25, 1.08, 0.86), lit), mid);
  vec3 col = base * tone;

  // Ink cross-hatching across the mid tone (the edge of the beam)
  if (uHatch > 0.5) {
    vec2 fc = gl_FragCoord.xy;
    float band = mid * (1.0 - lit);
    float h1 = hatchLines(fc, 0.785, uHatchScale);
    float h2 = hatchLines(fc, -0.785, uHatchScale);
    col *= mix(1.0, mix(0.12, 1.0, h1), band);
    col *= mix(1.0, mix(0.12, 1.0, h2), band * (1.0 - smoothstep(0.3, 0.42, I)));
  } else {
    col = base * mix(vec3(0.03, 0.035, 0.05), vec3(1.25, 1.08, 0.86), clamp(I, 0.0, 1.0));
  }

  // Fog
  float fog = 1.0 - exp(-pow(vViewDepth * uFogDensity, 2.0));
  col = mix(col, vec3(0.04, 0.06, 0.07), fog);

  // Glowing rot edge
  col = mix(col, uEdgeColor * 1.6, edge);

  // Film grain
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 400.0) - 0.5) * uGrain;

  gl_FragColor = vec4(col, 1.0);
}
`;

export const HORROR = {
  id: 'horror',
  name: 'Stylized Horror',
  description: 'Near-total darkness, lit only by a flashlight. Shadows fill with ink cross-hatching, fog and film grain. The Rot slider dissolves the model with noise.',
  vertexShader: horrorVertex,
  fragmentShader: horrorFragment,
  textureFilter: 'linear',
  flashlight: true,
  params: {
    uFlashOn:    { type: 'toggle', label: 'Flashlight', value: true },
    uFlashCone:  { type: 'range',  label: 'Beam width', min: 0.05, max: 0.5, step: 0.01, value: 0.17 },
    uDarkness:   { type: 'range',  label: 'Darkness', min: 0, max: 1, step: 0.01, value: 0.65 },
    uHatch:      { type: 'toggle', label: 'Ink hatching', value: true },
    uHatchScale: { type: 'range',  label: 'Hatch spacing', min: 3, max: 14, step: 0.5, value: 6 },
    uFogDensity: { type: 'range',  label: 'Fog', min: 0, max: 0.5, step: 0.005, value: 0.1 },
    uGrain:      { type: 'range',  label: 'Film grain', min: 0, max: 0.3, step: 0.005, value: 0.07 },
    uWobble:     { type: 'range',  label: 'Breathing', min: 0, max: 1, step: 0.01, value: 0.35 },
    uDissolve:   { type: 'range',  label: 'Rot', min: 0, max: 1, step: 0.01, value: 0 },
    uEdgeColor:  { type: 'color',  label: 'Rot edge color', value: '#ff6a2b' },
  },
};

export const LAB_SHADERS = { psx: PSX, toon: TOON, horror: HORROR };
