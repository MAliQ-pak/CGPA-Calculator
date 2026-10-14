// A short burst of confetti in the app's warm colours. Skipped when reduced motion is preferred.
const COLORS = ['#c2531f', '#f2b24c', '#e9a27f', '#00849c', '#2c734a', '#fcebdd'];

export function confetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const pieces = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 13 - 4,
    size: 5 + Math.random() * 6,
    spin: Math.random() * Math.PI,
    vspin: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
