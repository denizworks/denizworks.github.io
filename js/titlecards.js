// Generated "attract mode" title cards for the game screens.
// Shown until real screenshots / trailers are added in config.js.
import * as THREE from 'three';

const W = 1024, H = 576;
const FONT = '"Bricolage Grotesque", system-ui, sans-serif';

function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return [c, c.getContext('2d')];
}

function fatalstrike() {
  const [c, g] = canvas();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a0d1a'); bg.addColorStop(0.6, '#5a1424'); bg.addColorStop(1, '#14060c');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // Floor grid in perspective
  g.strokeStyle = 'rgba(255,120,90,0.35)'; g.lineWidth = 2;
  for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 18, 330); g.lineTo(W / 2 + i * 140, H); g.stroke(); }
  for (let j = 0; j < 8; j++) { const y = 330 + Math.pow(j / 8, 2) * 250; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // Health bars
  const bar = (x, flip) => {
    g.fillStyle = '#16060b'; g.fillRect(x, 40, 380, 34);
    g.fillStyle = '#ffd34a'; g.fillRect(flip ? x + 380 - 300 : x, 44, 300, 26);
    g.fillStyle = '#ff3b3b'; g.fillRect(flip ? x + 380 - 300 : x + 300 - 40, 44, 40, 26);
  };
  bar(40, false); bar(W - 420, true);
  g.fillStyle = '#ffd34a'; g.font = `800 40px ${FONT}`; g.textAlign = 'center'; g.fillText('VS', W / 2, 70);
  // Two blocky fighters
  const fighter = (x, col, dir) => {
    g.fillStyle = col;
    g.fillRect(x - 30, 200, 60, 90); g.fillRect(x - 22, 160, 44, 40);
    g.fillRect(x - 28, 290, 22, 70); g.fillRect(x + 6, 290, 22, 70);
    g.fillRect(x + dir * 30, 215, dir * 60, 18);
  };
  fighter(360, '#e8c9a0', 1); fighter(664, '#8fa0ff', -1);
  g.font = `800 112px ${FONT}`; g.fillStyle = '#16060b'; g.fillText('FATALSTRIKE', W / 2 + 6, 486);
  g.fillStyle = '#ffd34a'; g.fillText('FATALSTRIKE', W / 2, 480);
  g.font = `600 28px ${FONT}`; g.fillStyle = '#ffffff'; g.fillText('Round 1', W / 2, 140);
  return c;
}

function anarchyflips() {
  const [c, g] = canvas();
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2); g.rotate(-0.25);
  for (let i = -10; i < 10; i++) { g.fillStyle = i % 2 ? '#ff5a8a' : '#ffd23f'; g.fillRect(i * 90, -600, 45, 1200); }
  g.restore();
  // Sun + skateboard
  g.fillStyle = '#5b4bd1'; g.beginPath(); g.arc(780, 170, 110, 0, Math.PI * 2); g.fill();
  g.save(); g.translate(300, 200); g.rotate(-0.35);
  g.fillStyle = '#1e2247'; g.beginPath(); g.roundRect(-150, -26, 300, 52, 26); g.fill();
  g.fillStyle = '#ffffff'; [-90, 90].forEach(x => { g.beginPath(); g.arc(x, 40, 18, 0, Math.PI * 2); g.fill(); });
  g.restore();
  g.save(); g.translate(W / 2, 420); g.rotate(-0.06);
  g.font = `800 124px ${FONT}`; g.textAlign = 'center';
  g.lineWidth = 16; g.strokeStyle = '#1e2247'; g.strokeText('ANARCHY', 0, -10); g.fillStyle = '#ffffff'; g.fillText('ANARCHY', 0, -10);
  g.strokeText('FLIPS', 0, 110); g.fillStyle = '#ff5a8a'; g.fillText('FLIPS', 0, 110);
  g.restore();
  return c;
}

function geringi() {
  const [c, g] = canvas();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1414'); bg.addColorStop(0.7, '#1b2a26'); bg.addColorStop(1, '#070b0b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(220,235,210,0.85)'; g.beginPath(); g.arc(760, 140, 54, 0, Math.PI * 2); g.fill();
  // Branching dead trees
  const branch = (x, y, len, ang, w, depth) => {
    if (depth === 0) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.strokeStyle = '#050808'; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    branch(x2, y2, len * 0.72, ang - 0.4 - Math.random() * 0.3, w * 0.65, depth - 1);
    branch(x2, y2, len * 0.7, ang + 0.35 + Math.random() * 0.3, w * 0.65, depth - 1);
  };
  [[120, 1.0], [250, 0.7], [880, 0.9], [960, 0.6], [60, 0.6]].forEach(([x, s]) => branch(x, H, 170 * s, -Math.PI / 2, 22 * s, 6));
  const fog = g.createLinearGradient(0, 330, 0, H);
  fog.addColorStop(0, 'rgba(160,190,170,0)'); fog.addColorStop(1, 'rgba(160,190,170,0.35)');
  g.fillStyle = fog; g.fillRect(0, 330, W, H - 330);
  g.textAlign = 'center'; g.fillStyle = '#d8e6d0';
  g.font = `300 120px ${FONT}`;
  g.letterSpacing = '28px';
  g.fillText('GERINGI', W / 2 + 14, 330);
  g.letterSpacing = '0px';
  g.font = `500 24px ${FONT}`; g.fillStyle = 'rgba(216,230,208,0.6)'; g.fillText('Press any key', W / 2, 420);
  return c;
}

const MAKERS = { fatalstrike, anarchyflips, geringi };

export function titleCardTexture(id) {
  const tex = new THREE.CanvasTexture(MAKERS[id]());
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function mediaTexture(media) {
  return new Promise((resolve, reject) => {
    if (media.type === 'video') {
      const v = document.createElement('video');
      Object.assign(v, { src: media.src, muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous' });
      v.addEventListener('loadeddata', () => { v.play().catch(() => {}); const t = new THREE.VideoTexture(v); t.colorSpace = THREE.NoColorSpace; resolve(t); }, { once: true });
      v.addEventListener('error', reject, { once: true });
    } else {
      new THREE.TextureLoader().load(media.src, t => { t.colorSpace = THREE.NoColorSpace; resolve(t); }, undefined, reject);
    }
  });
}
