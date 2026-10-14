// Draws the shareable result card (1080×1350, a good size for WhatsApp and Instagram).
import { fmt, fmtCredits } from './calc.js';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const C = {
  bg: '#faf6f0',
  ink: '#2a211b',
  ink2: '#5c4f45',
  muted: '#7a6c60',
  accent: '#c2531f',
  accentSoft: '#fcebdd',
  honey: '#f2b24c',
  honeySoft: '#fdf1d8',
  line: '#ece3d7',
};
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FONT}`;

export async function loadCardFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([document.fonts.load(font(800, 100)), document.fonts.load(font(600, 40)), document.fonts.load(font(500, 30))]);
  } catch (e) {
    // Falls back to the system font.
  }
}

// opts: { name, program, university, cgpa, max, credits, rows: [{ name, gpa }], showName, showChart, link }
export function drawResultCard(canvas, opts) {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  const W = CARD_WIDTH;
  const pad = 88;

  // Background: warm paper with soft honey and terracotta glows.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, CARD_HEIGHT);
  glow(ctx, W - 80, 60, 560, 'rgba(242, 178, 76, 0.35)');
  glow(ctx, -60, CARD_HEIGHT - 40, 620, 'rgba(194, 83, 31, 0.14)');

  // Logo + wordmark.
  drawLogo(ctx, pad, pad, 76);
  ctx.fillStyle = C.ink;
  ctx.font = font(700, 38);
  ctx.textBaseline = 'middle';
  ctx.fillText('GradePoint', pad + 96, pad + 39);

  // Who.
  let y = pad + 190;
  ctx.textBaseline = 'alphabetic';
  if (opts.showName && opts.name) {
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 64);
    ctx.fillText(fit(ctx, opts.name, W - pad * 2), pad, y);
    y += 56;
  }
  const sub = [opts.program, opts.university].filter(Boolean).join(' · ');
  if (sub) {
    ctx.fillStyle = C.ink2;
    ctx.font = font(500, 34);
    ctx.fillText(fit(ctx, sub, W - pad * 2), pad, y);
    y += 30;
  }

  // The headline number, with a ring showing CGPA out of the maximum.
  y += 90;
  ctx.fillStyle = C.muted;
  ctx.font = font(600, 32);
  ctx.fillText('Cumulative GPA', pad, y);
  ctx.fillStyle = C.ink;
  ctx.font = font(800, 210);
  const big = fmt(opts.cgpa);
  ctx.fillText(big, pad - 8, y + 200);
  const bigW = ctx.measureText(big).width;
  ctx.fillStyle = C.muted;
  ctx.font = font(500, 52);
  ctx.fillText(`/ ${fmt(opts.max)}`, pad + bigW + 6, y + 200);
  drawRing(ctx, W - pad - 100, y + 120, 100, opts.cgpa === null ? 0 : opts.cgpa / opts.max);
  y += 290;

  // Stats.
  const best = opts.rows.reduce((b, r) => (!b || r.gpa > b.gpa ? r : b), null);
  const stats = [
    ['Credit hours', fmtCredits(opts.credits)],
    ['Semesters', String(opts.rows.length)],
    ['Best GPA', best ? fmt(best.gpa) : '–'],
  ];
  const gap = 24;
  const boxW = (W - pad * 2 - gap * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = pad + i * (boxW + gap);
    roundRect(ctx, x, y, boxW, 150, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.font = font(600, 28);
    ctx.fillText(label, x + 30, y + 54);
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 56);
    ctx.fillText(value, x + 30, y + 118);
  });
  y += 150;

  // Semester GPAs as columns (up to the last 10).
  if (opts.showChart && opts.rows.length) {
    const rows = opts.rows.slice(-10);
    const top = y + 64;
    const height = 220;
    const base = top + height;
    ctx.fillStyle = C.muted;
    ctx.font = font(600, 28);
    ctx.fillText('GPA by semester', pad, top - 18);
    const lo = Math.max(0, Math.floor(Math.min(...rows.map((r) => r.gpa))) - 1);
    const slot = (W - pad * 2) / rows.length;
    const barW = Math.min(64, slot * 0.55);
    rows.forEach((r, i) => {
      const h = Math.max(10, ((r.gpa - lo) / (opts.max - lo)) * (height - 70));
      const x = pad + i * slot + (slot - barW) / 2;
      roundTop(ctx, x, base - h, barW, h, 12);
      ctx.fillStyle = i === rows.length - 1 ? C.accent : '#e9a27f';
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.font = font(700, 26);
      ctx.textAlign = 'center';
      ctx.fillText(fmt(r.gpa), x + barW / 2, base - h - 14);
      ctx.fillStyle = C.muted;
      ctx.font = font(500, 24);
      ctx.fillText(shortName(r.name, i), x + barW / 2, base + 36);
      ctx.textAlign = 'left';
    });
  }

  // Footer.
  ctx.fillStyle = C.muted;
  ctx.font = font(500, 28);
  ctx.fillText('Made with GradePoint', pad, CARD_HEIGHT - pad + 10);
  if (opts.link) {
    ctx.textAlign = 'right';
    ctx.fillStyle = C.accent;
    ctx.font = font(600, 28);
    ctx.fillText(opts.link, W - pad, CARD_HEIGHT - pad + 10);
    ctx.textAlign = 'left';
  }
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(250, 246, 240, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawLogo(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  const g = ctx.createLinearGradient(0, 0, 40, 40);
  g.addColorStop(0, '#DE6A32');
  g.addColorStop(1, '#B9481B');
  roundRect(ctx, 0, 0, 40, 40, 12);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#FFF6EC';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M26.4 12.3A10 10 0 1 0 30 20h-8.5'));
  ctx.beginPath();
  ctx.arc(30.2, 10.6, 2.7, 0, Math.PI * 2);
  ctx.fillStyle = '#F6B94D';
  ctx.fill();
  ctx.restore();
}

function drawRing(ctx, cx, cy, r, pct) {
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.accentSoft;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, pct)));
  ctx.stroke();
  // Honey "point" at the centre, echoing the logo.
  ctx.fillStyle = C.honey;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundTop(ctx, x, y, w, h, r) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// Shortens text with an ellipsis until it fits.
function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
}

function shortName(name, i) {
  const m = /semester\s*(\d+)/i.exec(name);
  if (m) return `S${m[1]}`;
  return name ? name.slice(0, 6) : `#${i + 1}`;
}
