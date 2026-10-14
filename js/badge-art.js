// Badge artwork: a rosette medal with ribbon tails, coloured by badge type, with a line icon
// in the middle. Drawn as SVG so it looks the same everywhere and stays sharp at any size.

const PALETTES = {
  habit: { light: '#F08A4B', dark: '#B9481B', rim: '#FBD38A', ribbon: ['#9A3A12', '#C2531F'], glyph: '#FFFFFF' },
  improve: { light: '#2CB8C6', dark: '#00708A', rim: '#BFE9EE', ribbon: ['#005A6E', '#00849C'], glyph: '#FFFFFF' },
  milestone: { light: '#FAD47A', dark: '#D4870F', rim: '#FFF1C7', ribbon: ['#A8650A', '#D4870F'], glyph: '#5A3404' },
};

// 24×24 line icons, one per badge.
const GLYPHS = {
  setup: 'M5 10a7 7 0 0 1 14 0v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M8 14h8 M8 14v3',
  'first-semester': 'M12 21v-9 M12 12c0-4 3-6 7-6 0 4-3 6-7 6Z M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5Z',
  'first-grade': 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
  'semester-sealed': 'M5 12.5l4.5 4.5L19 7.5',
  'detail-detective': 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M15.5 15.5 20 20',
  'goal-setter': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 12h.01',
  bullseye: 'M10 21a7 7 0 1 1 7-7 M10 17a3 3 0 1 1 3-3 M10 14 20 4 M16 4h4v4',
  rising: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  comeback: 'M20 11a8 8 0 0 0-14.5-4.5L3 9 M3 4v5h5 M4 13a8 8 0 0 0 14.5 4.5L21 15 M21 20v-5h-5',
  'personal-best': 'M12 2.5c3 2.4 4.5 5.8 4.5 9.7L14.2 15H9.8l-2.3-2.8C7.5 8.3 9 4.9 12 2.5Z M12 9.2h.01 M9.8 15 8 20.5l4-2 4 2-1.8-5.5',
  'club-35': 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z',
  'straight-a': 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0Z M17 5h3v2a3 3 0 0 1-3 3 M7 5H4v2a3 3 0 0 0 3 3',
  halfway: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.5 8.5l-2 5-5 2 2-5Z',
  'finish-line': 'M2 9l10-5 10 5-10 5Z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5 M22 9v6',
  'team-player': 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14a6.5 6.5 0 0 1 3.5 6',
  regular: 'M12 21c4 0 7-2.8 7-6.7C19 9 14 7 14 3c-3 1.5-5 4.5-5 7.5-1-.5-2-1.5-2.5-3C4.5 9.5 5 12 5 14.3 5 18.2 8 21 12 21Z M12 21c-1.7 0-3-1.2-3-3 0-2 3-4 3-4s3 2 3 4c0 1.8-1.3 3-3 3Z',
};

// Scalloped rosette outline around (cx, cy).
function rosette(cx, cy, outer, inner, points) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const ROSETTE = rosette(32, 28, 26, 23, 16);
let count = 0;

export function badgeSvg(id, category, size = 64) {
  const p = PALETTES[category] || PALETTES.habit;
  const g = `bg${(count += 1)}`;
  const s = 1.1;
  const glyph = GLYPHS[id] || GLYPHS['club-35'];
  return `<svg class="badge-art" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
<defs>
<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="1" stop-color="${p.dark}"/></linearGradient>
</defs>
<path d="M22 40 14 62l7.5-4.5L26 63l4-19Z" fill="${p.ribbon[0]}"/>
<path d="M42 40l8 22-7.5-4.5L38 63l-4-19Z" fill="${p.ribbon[1]}"/>
<polygon points="${ROSETTE}" fill="${p.rim}" stroke="${p.dark}" stroke-width="1" stroke-linejoin="round"/>
<circle cx="32" cy="28" r="19.5" fill="url(#${g})"/>
<circle cx="32" cy="28" r="16.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>
<path d="M18.5 22a15 15 0 0 1 11-9.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
<g transform="translate(${32 - 12 * s} ${28 - 12 * s}) scale(${s})" fill="none" stroke="${p.glyph}" stroke-width="${(2.1 / s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"><path d="${glyph}"/></g>
</svg>`;
}

// A <span> holding the artwork, for use with the el() helper.
export function badgeArt(badge, size = 64) {
  const span = document.createElement('span');
  span.className = 'badge-art-wrap';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = badgeSvg(badge.id, badge.category, size);
  return span;
}
