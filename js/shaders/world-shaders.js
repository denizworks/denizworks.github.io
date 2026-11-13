// Shaders for the diorama itself: house toon shading, sky, game screens,
// light cones, portal, blob shadows, debug views and the final post pass.

import { NOISE, BAYER, SKIN_PARS, SKIN_MAIN } from './chunks.js';

// ── House shader: stylized 3-tone lighting + point lights + fog ─────────
export const MAX_POINTS = 8;

export const houseVertex = /* glsl */ `
${SKIN_PARS}
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
void main(){
  ${SKIN_MAIN}
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * objectNormal);
  vColor = vec3(1.0);
  #ifdef USE_COLOR
    vColor = color.rgb;
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const houseFragment = /* glsl */ `
#define MAX_POINTS ${MAX_POINTS}
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uPointPos[MAX_POINTS];
uniform vec3 uPointColor[MAX_POINTS];
uniform float uLightingOnly;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;

void main(){
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 albedo = mix(uColor * vColor, vec3(0.8), uLightingOnly);

  float ndl = dot(N, uLightDir);
  float key = smoothstep(-0.05, 0.05, ndl) * 0.55 + smoothstep(0.42, 0.5, ndl) * 0.45;
  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 light = hemi + uLightColor * key;

  for (int i = 0; i < MAX_POINTS; i++) {
    vec3 L = uPointPos[i] - vWorld;
    float d = length(L);
    float att = 1.0 / (1.0 + d * d * 0.55);
    float lam = max(dot(N, L / d), 0.0) * att;
    light += uPointColor[i] * (smoothstep(0.04, 0.09, lam) * 0.5 + smoothstep(0.18, 0.26, lam) * 0.5);
  }

  vec3 col = albedo * light + uEmissive * (1.0 - uLightingOnly);

  float dist = length(vWorld - cameraPosition);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  fog = max(fog, smoothstep(-1.5, -9.0, vWorld.y) * 0.85);   // fade the floating rocks into the void
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Sky dome: gradient + procedural stars ───────────────────────────────
export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
export const skyFragment = /* glsl */ `
${NOISE}
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform float uTime;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 col = d.y > 0.0 ? mix(uHorizon, uTop, pow(d.y, 0.6)) : mix(uHorizon, uBottom, pow(-d.y, 0.5));
  vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 48.0;
  vec2 cell = floor(sp);
  float h = hash12(cell);
  float star = step(0.975, h) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
  star *= 0.55 + 0.45 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
  col += vec3(0.95, 0.9, 1.0) * star * smoothstep(-0.05, 0.25, d.y) * 0.8;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Game screens: one shader, three looks ───────────────────────────────
export const screenVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const screenFragment = /* glsl */ `
${NOISE}
${BAYER}
uniform sampler2D tMap;
uniform float uTime;
uniform float uActive;     // 0 = idle/standby, 1 = this game is in focus
uniform float uStyle;      // 0 psx, 1 toon, 2 horror
varying vec2 vUv;

vec3 sampleStyled(vec2 uv){
  if (uStyle < 0.5) {
    // PSX: low-res, 15-bit color, dithered, row jitter
    vec2 res = vec2(256.0, 144.0);
    float jitter = (hash12(vec2(floor(uv.y * res.y), floor(uTime * 12.0))) - 0.5) * 0.004 * (1.0 - uActive * 0.6);
    vec2 q = (floor((uv + vec2(jitter, 0.0)) * res) + 0.5) / res;
    vec3 c = texture2D(tMap, q).rgb;
    float d = bayer4(floor(uv * res)) - 0.5;
    c = floor(c * 31.0 + 0.5 + d) / 31.0;
    return c;
  } else if (uStyle < 1.5) {
    // Toon: printed halftone with misregistered color plates, "boiling" on 8 fps
    float t = floor(uTime * 8.0);
    vec2 wob = (vec2(hash12(vec2(t, 1.0)), hash12(vec2(t, 2.0))) - 0.5) * 0.003;
    vec3 c;
    c.r = texture2D(tMap, uv + wob + vec2(0.002, 0.0)).r;
    c.g = texture2D(tMap, uv + wob).g;
    c.b = texture2D(tMap, uv + wob - vec2(0.002, 0.001)).b;
    vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (uv * vec2(160.0, 90.0));
    float r = length(fract(p) - 0.5);
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float dots = smoothstep(0.32, 0.28, r) * (1.0 - lum);
    return mix(c, c * 0.55, dots * 0.6);
  } else {
    // Horror: flicker, tearing, grain, green cast
    float tear = step(0.985, hash12(vec2(floor(uv.y * 40.0), floor(uTime * 6.0))));
    vec2 q = uv + vec2(tear * 0.03, 0.0);
    vec3 c = texture2D(tMap, q).rgb;
    float flicker = 0.88 + 0.12 * vnoise(vec3(uTime * 9.0, 0.0, 0.0));
    c *= flicker * vec3(0.85, 1.0, 0.9);
    c += (hash12(uv * 900.0 + uTime) - 0.5) * 0.14;
    return c;
  }
}

void main(){
  vec2 uv = vUv;
  // Slight CRT barrel
  vec2 cc = uv - 0.5;
  uv = 0.5 + cc * (1.0 + dot(cc, cc) * 0.08);
  vec3 col = sampleStyled(uv);

  // Scanlines + edge falloff
  col *= 0.9 + 0.1 * sin(uv.y * 900.0);
  float vig = smoothstep(0.75, 0.25, length(cc * vec2(1.0, 1.25)));
  col *= mix(0.55, 1.0, vig);

  // Standby: dim + static. Active: power-on sweep from the middle line
  vec3 standby = col * 0.28 + (hash12(uv * 500.0 + floor(uTime * 20.0)) - 0.5) * 0.12;
  float open = clamp(uActive, 0.0, 1.0);
  float dy = abs(uv.y - 0.5);
  float reveal = step(dy, open * 0.5);
  col = mix(standby, col, reveal);
  float sweep = (1.0 - smoothstep(0.0, 0.012, abs(dy - open * 0.5))) * step(0.001, open) * step(open, 0.995);
  col += vec3(0.9, 0.95, 1.0) * sweep;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.02);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Additive light cone above pedestals ─────────────────────────────────
export const coneVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main(){
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
export const coneFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main(){
  float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
  float a = facing * pow(vUv.y, 1.6) * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

// ── Exit portal ─────────────────────────────────────────────────────────
export const portalFragment = /* glsl */ `
${NOISE}
uniform float uTime;
uniform float uHover;
varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * vec2(1.0, 2.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float swirl = fbm(vec3(cos(a) * 1.5 + r * 3.0 - uTime * 0.6, sin(a) * 1.5 + r * 2.0, uTime * 0.2));
  vec3 pink = vec3(1.0, 0.353, 0.541);
  vec3 sodium = vec3(1.0, 0.69, 0.29);
  vec3 deep = vec3(0.16, 0.13, 0.36);
  vec3 col = mix(deep, pink, smoothstep(0.35, 0.7, swirl));
  col = mix(col, sodium, smoothstep(0.62, 0.85, swirl) * (0.6 + uHover * 0.4));
  col += smoothstep(0.6, 0.0, r) * 0.25 * (1.0 + uHover);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Soft blob shadow decal ──────────────────────────────────────────────
export const blobFragment = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.2, r) * uOpacity;
  gl_FragColor = vec4(vec3(0.07, 0.06, 0.18), a);
}
`;

// ── Debug view: UVs as color ────────────────────────────────────────────
export const uvVertex = /* glsl */ `
${SKIN_PARS}
varying vec2 vUv;
void main(){
  ${SKIN_MAIN}
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(transformed, 1.0);
}
`;
export const uvFragment = /* glsl */ `
varying vec2 vUv;
void main(){
  vec2 f = fract(vUv);
  float checker = mod(floor(vUv.x * 8.0) + floor(vUv.y * 8.0), 2.0);
  gl_FragColor = vec4(f, 0.0, 1.0) * (0.8 + 0.2 * checker);
}
`;

// ── Final full-screen pass ──────────────────────────────────────────────
export const postVertex = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const postFragment = /* glsl */ `
${NOISE}
${BAYER}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform float uVelocity;
uniform float uMode;        // 0 lit, 1 wire, 2 normals, 3 uv, 4 depth, 5 lighting
uniform float uOutline;
uniform vec3 uOutlineColor;
uniform float uPixel;       // device pixel ratio, keeps outlines a constant width
varying vec2 vUv;

float linDepth(vec2 uv){
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

void main(){
  vec2 uv = vUv;
  vec2 px = 1.0 / uResolution;

  if (uMode > 3.5 && uMode < 4.5) {
    float d = linDepth(uv);
    float v = 1.0 - clamp(d / 45.0, 0.0, 1.0);
    gl_FragColor = vec4(vec3(pow(v, 1.6)), 1.0);
    return;
  }

  // Chromatic split that grows with scroll speed
  vec2 dir = (uv - 0.5);
  float ca = uVelocity * 0.006;
  vec3 col;
  col.r = texture2D(tColor, uv + dir * ca).r;
  col.g = texture2D(tColor, uv).g;
  col.b = texture2D(tColor, uv - dir * ca).b;

  if (uMode < 0.5 || uMode > 4.5) {
    // Depth-based ink outline
    float o = uPixel * 1.25;
    float dc = linDepth(uv);
    float dl = linDepth(uv - vec2(px.x * o, 0.0));
    float dr = linDepth(uv + vec2(px.x * o, 0.0));
    float du = linDepth(uv + vec2(0.0, px.y * o));
    float dd = linDepth(uv - vec2(0.0, px.y * o));
    // Laplacian of linear depth: ~0 on flat surfaces, large at silhouettes
    float e = (abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc)) / max(dc, 0.001);
    float edge = smoothstep(0.025, 0.07, e) * smoothstep(60.0, 20.0, dc);
    col = mix(col, uOutlineColor, edge * uOutline);

    // Vignette + grain + debanding dither
    float vig = smoothstep(1.15, 0.35, length(dir * vec2(1.0, 0.8)));
    col *= mix(0.72, 1.0, vig);
    col += (hash12(gl_FragCoord.xy + fract(uTime) * 300.0) - 0.5) * 0.035;
    col += (bayer4(gl_FragCoord.xy) - 0.5) / 255.0;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
