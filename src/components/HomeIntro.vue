<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const host = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const title = ref(false);
const KEY = "fp-home-intro-v1";
let raf = 0;
let disposed = false;

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  s: number;
};

function spawnBurst(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ps: P[],
  fx: number,
  fy: number,
) {
  void ctx;
  const n = 14 + Math.floor(Math.random() * 8);
  const hue = 195 + Math.random() * 70;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const sp = 0.75 + Math.random() * 1.35;
    ps.push({
      x: w * fx,
      y: h * fy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0,
      max: 50 + Math.random() * 22,
      c: `hsla(${hue + i * 2}, 72%, 63%, 0.92)`,
      s: 1.1 + Math.random(),
    });
  }
}

/** Avoid the center drop-zone band; keep bursts in upper + side margins. */
const BURST_SPOTS: Array<[number, number]> = [
  [0.12, 0.16],
  [0.28, 0.1],
  [0.72, 0.1],
  [0.88, 0.18],
  [0.18, 0.28],
  [0.82, 0.26],
  [0.5, 0.08],
  [0.08, 0.38],
  [0.92, 0.36],
];

function runIntro() {
  const c = canvas.value;
  const root = host.value;
  if (!c || !root) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => {
    c.width = Math.floor(root.clientWidth * dpr);
    c.height = Math.floor(root.clientHeight * dpr);
    c.style.width = root.clientWidth + "px";
    c.style.height = root.clientHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
  title.value = true;
  const ps: P[] = [];
  let frame = 0;
  const tick = () => {
    if (disposed) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    ctx.clearRect(0, 0, w, h);
    // Multi-spot bursts around the drop zone (not under the center box).
    if (frame < 240) {
      if (frame % 28 === 0) {
        const spot = BURST_SPOTS[frame / 28 % BURST_SPOTS.length];
        spawnBurst(ctx, w, h, ps, spot[0], spot[1]);
      }
      if (frame % 70 === 0) {
        const spot = BURST_SPOTS[(frame / 70 + 3) % BURST_SPOTS.length];
        spawnBurst(ctx, w, h, ps, spot[0], spot[1]);
      }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.012;
      p.vx *= 0.99;
      p.life++;
      const a = 1 - p.life / p.max;
      if (a <= 0) {
        ps.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    frame++;
    if (frame < 320) raf = requestAnimationFrame(tick);
    else {
      title.value = false;
      window.removeEventListener("resize", resize);
    }
  };
  raf = requestAnimationFrame(tick);
}

onMounted(() => {
  if (!host.value) return;
  try {
    if (localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, "1");
  } catch {
    /* still play once this session */
  }
  runIntro();
});
onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(raf);
});
</script>
<template>
  <div ref="host" class="home-intro" aria-hidden="true">
    <canvas ref="canvas" class="home-intro-canvas"></canvas>
    <p v-if="title" class="home-intro-title">小乖专属软件</p>
  </div>
</template>
