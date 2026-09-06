'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const menuEl = document.getElementById('menu');
const overEl = document.getElementById('over');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');

const BEST_KEY = 'sprint-best-score';
const MUTE_KEY = 'sprint-muted';

let W = 0;
let H = 0;
let DPR = 1;
let oldGy = 0;

function gy() {
  return H - 90;
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  adjustToGround();
}

function adjustToGround() {
  const newGy = gy();
  for (const layer of hillLayers) {
    if (!oldGy) layer.base = newGy + layer.amp * 0.95;
    else layer.base += newGy - oldGy;
  }
  if (oldGy && state.playing) {
    const d = newGy - oldGy;
    player.y += d;
    for (const o of obstacles) o.y += d;
  }
  oldGy = newGy;
  player.gy = newGy;
}

const STATE = {
  MENU: 'menu',
  PLAY: 'play',
  OVER: 'over',
};

const state = {
  mode: STATE.MENU,
  playing: false,
  speed: 0,
  distance: 0,
  elapsed: 0,
  shake: 0,
  shakeX: 0,
  shakeY: 0,
  overAt: 0,
};

const player = {
  w: 36,
  h: 46,
  x: 0,
  y: 0,
  vy: 0,
  jumps: 0,
  coyote: 0,
  onGround: false,
  runPhase: 0,
  squash: 0,
  stretch: 1,
};

const GRAVITY = 1900;
const JUMP_V = 660;
const JUMP2_V = 580;
const BASE_SPEED = 320;
const MAX_SPEED = 760;
const ACCEL = 6;

const obstacles = [];
const particles = [];

const hillLayers = [
  { speed: 0.1, amp: 60, freq: 0.01, phase: 0, color: '#9dcf8a', base: 0 },
  { speed: 0.24, amp: 36, freq: 0.016, phase: 2, color: '#7fbe6e', base: 0 },
];

const clouds = [];
for (let i = 0; i < 4; i++) {
  clouds.push({
    x: Math.random() * 1200,
    y: Math.random() * 180 + 30,
    s: Math.random() * 0.8 + 0.5,
    speed: Math.random() * 8 + 4,
  });
}

let spawnDist = 300;
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let muted = localStorage.getItem(MUTE_KEY) === '1';
let lastT = 0;

muteBtn.textContent = muted ? '🔇' : '🔊';

function resetRun() {
  state.speed = BASE_SPEED;
  state.distance = 0;
  state.elapsed = 0;
  state.shake = 0;
  state.playing = true;
  score = 0;
  spawnDist = 260;
  obstacles.length = 0;
  particles.length = 0;
  player.x = W * 0.18;
  player.y = gy() - player.h;
  player.vy = 0;
  player.jumps = 0;
  player.onGround = true;
  adjustToGround();
}

function getDifficulty() {
  const t = (state.elapsed - 6) / 90;
  return Math.max(0, Math.min(1, t));
}

function currentGap() {
  const d = getDifficulty();
  return 400 - d * 140;
}

function spawnObstacle() {
  const d = getDifficulty();
  const y = gy();
  const roll = Math.random();
  let o = null;
  if (roll < 0.42) {
    const h = 30 + Math.random() * 26;
    o = { type: 'cactus', x: W + 40, y: y - h, w: 13, h, seed: Math.random() * 10 };
  } else if (roll < 0.66) {
    const h = 26 + Math.random() * 20;
    const gap = 8;
    const w1 = 15;
    o = {
      type: 'double',
      x: W + 40,
      y: y - h - 4,
      w: w1 * 2 + gap,
      h: h,
      gap,
      seed: Math.random() * 10,
    };
  } else if (roll < 0.72) {
    o = { type: 'rock', x: W + 40, y: y - 18, w: 26, h: 18, seed: Math.random() * 10 };
  } else {
    const high = Math.random() < Math.max(0, d * 0.4);
    const top = high ? y - 168 : y - 122;
    o = { type: 'bird', x: W + 60, y: top, w: 40, h: 26, seed: Math.random() * 10, bob: Math.random() * 7 };
  }
  obstacles.push(o);
}

function pressJump() {
  audio.unlock();
  if (state.mode === STATE.MENU) {
    startGame();
    return;
  }
  if (state.mode === STATE.OVER) {
    if (performance.now() - state.overAt > 500) startGame();
    return;
  }
  if (player.onGround || player.coyote > 0) {
    player.vy = -JUMP_V;
    player.jumps = 1;
    player.onGround = false;
    player.coyote = 0;
    player.stretch = 1.08;
    audio.jump();
  } else if (player.jumps === 1) {
    player.vy = -JUMP2_V;
    player.jumps = 2;
    player.stretch = 1.1;
    audio.double();
  }
}

function releaseJump() {
  if (player.vy < 0) player.vy *= 0.5;
}

function startGame() {
  state.mode = STATE.PLAY;
  menuEl.classList.add('hidden');
  overEl.classList.add('hidden');
  resetRun();
}

function gameOver() {
  state.mode = STATE.OVER;
  state.playing = false;
  state.shake = 16;
  state.overAt = performance.now();
  score = Math.floor(state.distance / 10);
  finalScoreEl.textContent = score;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
  bestScoreEl.textContent = 'Best: ' + best;
  audio.death();
  for (let i = 0; i < 26; i++) {
    particles.push(burstParticle(player.x + player.w / 2, player.y + player.h / 2));
  }
  setTimeout(() => {
    if (state.mode === STATE.OVER) overEl.classList.remove('hidden');
  }, 450);
}

function burstParticle(x, y) {
  const a = Math.random() * Math.PI * 2;
  const sp = 80 + Math.random() * 260;
  return {
    x, y,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp - 120,
    life: 0.7 + Math.random() * 0.5,
    t: 0,
    r: 3 + Math.random() * 4,
    color: Math.random() < 0.5 ? '#ff6b6b' : '#ffd93d',
  };
}

function dustParticle(x, y) {
  return {
    x: x + (Math.random() - 0.5) * 18,
    y,
    vx: -40 - Math.random() * 40,
    vy: -(Math.random() * 40),
    life: 0.4 + Math.random() * 0.3,
    t: 0,
    r: 4 + Math.random() * 5,
    color: 'rgba(235, 205, 160, ALPHA)',
  };
}

const COLOR = {
  skyTop: '#57b8e8',
  skyBottom: '#c8ecf9',
  sun: '#ffe08a',
  ground: '#e6c084',
  groundDark: '#d1a967',
  grass: '#5b9e56',
  cactus: '#2f9e5b',
  cactusDark: '#22774a',
  cactusLight: '#7ed99b',
  rock: '#a8927a',
  rockDark: '#8a7660',
  bird: '#3a4047',
  birdLight: '#7c838d',
  body: '#ff6b6b',
  bodyDark: '#e14b4b',
  bodyLight: '#ff9c83',
  cap: '#ffd93d',
  scarf: '#ff9f43',
  white: '#ffffff',
  pupil: '#2b2f36',
  dash: 'rgba(160, 120, 70, 0.5)',
};

function collides(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update(dt) {
  state.shake = Math.max(0, state.shake - dt * 26);

  if (state.mode === STATE.MENU) {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.x -= c.speed * dt * 0.5;
      if (c.x < -140) c.x = W + 120;
    }
    return;
  }

  if (state.playing) {
    state.elapsed += dt;
    state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.elapsed * ACCEL);
    state.distance += state.speed * dt;
    score = Math.floor(state.distance / 10);
  }

  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    c.x -= (c.speed + state.speed * 0.06) * dt;
    if (c.x < -140) c.x = W + 120;
  }

  if (state.playing) {
    spawnDist -= state.speed * dt;
    if (spawnDist <= 0) {
      spawnObstacle();
      spawnDist = currentGap() * (0.85 + Math.random() * 0.3);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= state.speed * dt;
      if (o.type === 'bird') {
        o.t = (o.t || 0) + dt;
        o.yp = o.y + Math.sin(o.t * 2.6 + o.seed) * 8;
      } else {
        o.yp = o.y;
      }
      if (o.x + o.w < -60) {
        obstacles.splice(i, 1);
      }
    }

    const prevY = player.y;
    const wasAirborne = !player.onGround;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    const groundTop = player.gy - player.h;
    if (player.y >= groundTop) {
      player.y = groundTop;
      if (wasAirborne && (prevY < player.y - 20 || player.vy > 300)) {
        player.squash = 1;
        particles.push(dustParticle(player.x + player.w / 2, player.gy));
        audio.land();
      }
      player.vy = 0;
      player.onGround = true;
      player.jumps = 0;
    } else {
      player.onGround = false;
      player.coyote = Math.max(0, player.coyote - dt);
    }
    if (player.onGround) player.coyote = 0.1;

    if (player.squash > 0) player.squash = Math.max(0, player.squash - dt * 4);
    player.stretch += (1 - player.stretch) * Math.min(1, dt * 10);
    if (player.onGround) {
      player.runPhase += dt * (state.speed / BASE_SPEED) * 11;
    }

    player.x = W * 0.18;

    const pbox = {
      x: player.x + 5,
      y: player.y + 6,
      w: player.w - 10,
      h: player.h - 10,
    };
    for (const o of obstacles) {
      const obox = {
        x: o.x + 4,
        y: (o.yp || o.y) + 4,
        w: o.w - 8,
        h: o.h - 8,
      };
      if (o.type === 'bird') obox.y = o.yp;
      if (collides(pbox, obox)) {
        gameOver();
        break;
      }
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += 800 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (state.shake > 0) {
    state.shakeX = (Math.random() - 0.5) * state.shake * 0.5;
    state.shakeY = (Math.random() - 0.5) * state.shake * 0.5;
    ctx.translate(state.shakeX, state.shakeY);
  }

  drawSky();
  drawSun();
  drawClouds();
  drawHills();
  drawGround();
  drawObstacles();
  drawParticles();
  if (state.mode !== STATE.MENU) drawPlayer();
  if (state.playing) drawHud();

  if (state.shake > 0) ctx.translate(-state.shakeX, -state.shakeY);
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLOR.skyTop);
  g.addColorStop(1, COLOR.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);
}

function drawSun() {
  const x = W * 0.82;
  const y = H * 0.14;
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 120);
  glow.addColorStop(0, 'rgba(255, 224, 138, 0.95)');
  glow.addColorStop(1, 'rgba(255, 224, 138, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.sun;
  ctx.beginPath();
  ctx.arc(x, y, 38, 0, Math.PI * 2);
  ctx.fill();
}

function cloudPath(cx, cy, s) {
  ctx.beginPath();
  ctx.arc(cx, cy, 26 * s, 0, Math.PI * 2);
  ctx.arc(cx + 26 * s, cy - 12 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(cx + 52 * s, cy, 24 * s, 0, Math.PI * 2);
  ctx.arc(cx + 26 * s, cy + 8 * s, 26 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const c of clouds) cloudPath(c.x, c.y, c.s);
}

function drawHills() {
  const yGround = gy();
  for (const layer of hillLayers) {
    const off = (state.distance * 0.02) * layer.speed * 60;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(-60, yGround + 2);
    let lastX = -60;
    let lastY = yGround + 2;
    for (let x = -60; x <= W + 60; x += 8) {
      const yy = layer.base + Math.sin((x + off) * layer.freq + layer.phase) * layer.amp * 0.5 - layer.amp * 0.45;
      ctx.lineTo(x, yy);
      lastX = x;
      lastY = yy;
    }
    ctx.lineTo(lastX, yGround + 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGround() {
  const yGround = gy();
  const g = ctx.createLinearGradient(0, yGround, 0, H);
  g.addColorStop(0, COLOR.ground);
  g.addColorStop(1, '#cfa360');
  ctx.fillStyle = g;
  ctx.fillRect(-40, yGround, W + 80, H - yGround + 40);

  ctx.fillStyle = COLOR.grass;
  ctx.fillRect(-40, yGround, W + 80, 6);

  ctx.fillStyle = COLOR.groundDark;
  ctx.fillRect(-40, yGround + 6, W + 80, 3);

  const d1 = (state.distance * 1) % 44;
  for (let x = -44 + d1 * -1; x < W + 44; x += 44) {
    ctx.strokeStyle = COLOR.dash;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, yGround + 22);
    ctx.lineTo(x + 16, yGround + 22);
    ctx.stroke();
  }

  const d2 = (state.distance * 1.6) % 56;
  ctx.globalAlpha = 0.6;
  for (let x = -56 + d2 * -1; x < W + 56; x += 56) {
    ctx.strokeStyle = COLOR.dash;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, yGround + 48);
    ctx.lineTo(x + 22, yGround + 48);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function rr(x, y, w, h, r) {
  const rr = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCactus(o) {
  ctx.fillStyle = COLOR.cactusDark;
  rr(o.x - 2, o.y - 2, o.w + 4, o.h + 4, 7);
  ctx.fill();
  ctx.fillStyle = COLOR.cactus;
  rr(o.x, o.y, o.w, o.h, 6);
  ctx.fill();
  ctx.fillStyle = COLOR.cactusLight;
  ctx.beginPath();
  ctx.arc(o.x + o.w - 4, o.y + o.h * 0.28, 3, 0, Math.PI * 2);
  ctx.arc(o.x + o.w - 4, o.y + o.h * 0.55, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDouble(o) {
  const w1 = (o.w - o.gap) / 2;
  const drawOne = (x, y, w, h) => {
    ctx.fillStyle = COLOR.cactusDark;
    rr(x - 2, y - 2, w + 4, h + 4, 7);
    ctx.fill();
    ctx.fillStyle = COLOR.cactus;
    rr(x, y, w, h, 6);
    ctx.fill();
  };
  drawOne(o.x, o.y + 4, w1, o.h - 4);
  drawOne(o.x + w1 + o.gap, o.y, w1, o.h);
  ctx.fillStyle = COLOR.cactusLight;
  ctx.beginPath();
  ctx.arc(o.x + w1 - 4, o.y + 4 + (o.h - 4) * 0.4, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawRock(o) {
  ctx.fillStyle = COLOR.rockDark;
  rr(o.x - 2, o.y + 1, o.w + 4, o.h, 6);
  ctx.fill();
  ctx.fillStyle = COLOR.rock;
  rr(o.x, o.y, o.w, o.h, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(o.x + 5, o.y + 3, 8, 5, 3);
  ctx.fill();
}

function drawBird(o) {
  const t = o.t || 0;
  const flap = Math.sin(t * (8 + o.seed % 3)) * 0.7;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = COLOR.bird;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.birdLight;
  ctx.beginPath();
  ctx.ellipse(-5, 1, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.bird;
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(18, -3 - flap * 4);
  ctx.lineTo(18, -1 + flap * 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(17, -3 + flap * 4);
  ctx.lineTo(17, -1 - flap * 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOR.sun;
  ctx.beginPath();
  ctx.arc(4, -3, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.pupil;
  ctx.beginPath();
  ctx.arc(5.2, -3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8f3d';
  ctx.beginPath();
  ctx.moveTo(13, 1);
  ctx.lineTo(22, 2);
  ctx.lineTo(13, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObstacles() {
  for (const o of obstacles) {
    if (o.type === 'cactus') drawCactus(o);
    else if (o.type === 'double') drawDouble(o);
    else if (o.type === 'rock') drawRock(o);
    else drawBird(o);
  }
}

function drawPlayer() {
  const cx = player.x + player.w / 2;
  const bottom = player.y + player.h;
  let sx = 1;
  let sy = 1;
  if (player.squash > 0) {
    sy = 1 - player.squash * 0.25;
    sx = 1 + player.squash * 0.3;
  } else if (player.stretch !== 1) {
    sy = player.stretch;
    sx = 2 - player.stretch;
  }
  if (!player.onGround && player.vy < 0) {
    sy = 0.94;
    sx = 1.06;
  }
  if (!player.onGround && player.vy > 0) {
    sy = 1.06;
    sx = 0.94;
  }

  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(sx, sy);

  if (player.onGround) {
    const leg = Math.sin(player.runPhase) * 4;
    ctx.fillStyle = COLOR.bodyDark;
    rr(-player.w / 2 + 3 + leg, -10, 9, 12, 4);
    ctx.fill();
    ctx.fillStyle = COLOR.bodyDark;
    rr(player.w / 2 - 12 - leg, -10, 9, 12, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = COLOR.bodyDark;
    rr(-player.w / 2 + 2, -12, 8, 9, 4);
    ctx.fill();
    rr(player.w / 2 - 10, -14, 8, 9, 4);
    ctx.fill();
  }

  ctx.fillStyle = COLOR.scarf;
  rr(-5, -player.h * 0.62, player.w + 10, 9, 4);
  ctx.fill();
  ctx.fillStyle = '#f0862f';
  rr(player.w / 2 + 4, -player.h * 0.62 - 2, 6, 7, 3);
  ctx.fill();
  rr(player.w / 2 + 6, -player.h * 0.62 + 4, 5, 5, 2);
  ctx.fill();

  ctx.fillStyle = COLOR.body;
  rr(-player.w / 2, -player.h, player.w, player.h * 0.7, 10);
  ctx.fill();
  ctx.fillStyle = COLOR.bodyLight;
  rr(-player.w / 2, -player.h * 0.62, player.w, 8, 4);
  ctx.fill();

  ctx.fillStyle = COLOR.bodyDark;
  rr(-player.w / 2 - 2, -player.h + 4, player.w + 4, 7, 3);
  ctx.fill();

  ctx.fillStyle = COLOR.body;
  rr(-player.w / 2 + 5, -player.h - 2, player.w - 10, 12, 6);
  ctx.fill();
  ctx.fillStyle = COLOR.cap;
  rr(-player.w / 2, -player.h - 7, player.w, 10, 6);
  ctx.fill();
  ctx.fillStyle = '#f0bd2a';
  rr(-player.w / 2 - 2, -player.h - 5, 8, 7, 4);
  ctx.fill();

  ctx.fillStyle = COLOR.white;
  ctx.beginPath();
  ctx.arc(-6, -player.h + 13, 5.5, 0, Math.PI * 2);
  ctx.arc(7, -player.h + 13, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.pupil;
  ctx.beginPath();
  ctx.arc(-4.5, -player.h + 13, 2.6, 0, Math.PI * 2);
  ctx.arc(8.5, -player.h + 13, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-3.5, -player.h + 12, 1.1, 0, Math.PI * 2);
  ctx.arc(9.5, -player.h + 12, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = 1 - p.t / p.life;
    if (p.color.indexOf('ALPHA') >= 0) {
      ctx.fillStyle = p.color.replace('ALPHA', a.toFixed(2));
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 - p.t / p.life * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawHud() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 10;
  ctx.fillText(String(score).padStart(5, '0'), W / 2, 26);
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('BEST ' + best, W / 2, 70);
}

function loop(t) {
  const dt = Math.min((t - lastT) / 1000 || 0, 0.033);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

const audio = {
  ctx: null,
  master: null,
  muted: muted,
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.ctx.destination);
  },
  tone(freq, dur, type, slide, when, vol) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur);
  },
  jump() {
    this.tone(320, 0.16, 'square', 640, 0, 0.4);
  },
  double() {
    this.tone(420, 0.1, 'square', 800, 0, 0.35);
    this.tone(300, 0.1, 'square', 560, 0.06, 0.3);
  },
  land() {
    this.tone(140, 0.08, 'triangle', 90, 0, 0.3);
  },
  death() {
    this.tone(260, 0.5, 'sawtooth', 60, 0, 0.5);
  },
};

function toggleMute() {
  muted = !muted;
  audio.muted = muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  muteBtn.textContent = muted ? '🔇' : '🔊';
}

startBtn.addEventListener('click', () => { audio.unlock(); startGame(); });
restartBtn.addEventListener('click', () => { audio.unlock(); startGame(); });
muteBtn.addEventListener('click', toggleMute);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    pressJump();
  }
  if (e.code === 'KeyM') toggleMute();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    releaseJump();
  }
});

window.addEventListener('pointerdown', (e) => {
  if (e.target === muteBtn) return;
  pressJump();
});

window.addEventListener('resize', resize);

resize();
lastT = performance.now();
adjustToGround();
requestAnimationFrame(loop);