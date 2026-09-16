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

function burst(ctx: CanvasRenderingContext2D, w: number, h: number, ps: P[]) {
  const cx = w * (0.28 + Math.random() * 0.44);
  const cy = h * (0.22 + Math.random() * 0.28);
  const n = 18 + Math.floor(Math.random() * 10);
  const hue = 200 + Math.random() * 60;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const sp = 0.8 + Math.random() * 1.4;
    ps.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0,
      max: 48 + Math.random() * 24,
      c: `hsla(${hue + i * 2}, 70%, 62%, 0.9)`,
      s: 1.2 + Math.random(),
    });
  }
}

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
    if (frame % 55 === 0 && frame < 220) burst(ctx, w, h, ps);
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
    if (frame < 260) raf = requestAnimationFrame(tick);
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
