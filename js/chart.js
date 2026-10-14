// Line chart of semester GPA (accent) with running CGPA (muted) on one 0–max axis.
import { el } from './ui.js';
import { fmt } from './calc.js';

const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// rows: [{ name, gpa, cgpa, credits }]
export function gpaChart(rows, max) {
  const wrap = el('div', { class: 'chart' });
  const legend = el('div', { class: 'chart-legend' },
    el('span', { class: 'legend-item' }, el('span', { class: 'legend-key key-gpa' }), 'Semester GPA'),
    el('span', { class: 'legend-item' }, el('span', { class: 'legend-key key-cgpa' }), 'CGPA'),
  );
  const plot = el('div', { class: 'chart-plot' });
  const tip = el('div', { class: 'chart-tip', role: 'status', hidden: true });
  plot.append(tip);
  wrap.append(legend, plot);

  const draw = () => {
    const width = plot.clientWidth;
    if (!width) return;
    const height = Math.max(200, Math.min(280, width * 0.5));
    const m = { top: 16, right: 44, bottom: 30, left: 34 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const n = rows.length;
    const x = (i) => m.left + (n === 1 ? w / 2 : (i * w) / (n - 1));
    // Start the axis a little below the lowest value so semester-to-semester changes are visible.
    const lowest = Math.min(...rows.map((r) => Math.min(r.gpa, r.cgpa)));
    const lo = Math.max(0, Math.floor(lowest) - 1);
    const y = (v) => m.top + h - ((v - lo) / (max - lo)) * h;

    for (const old of plot.querySelectorAll('svg')) old.remove();
    const s = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Line chart of GPA by semester. ${rows.map((r) => `${r.name}: GPA ${fmt(r.gpa)}, CGPA ${fmt(r.cgpa)}`).join('; ')}` });

    // Gridlines and y ticks at whole grade points.
    const span = max - lo;
    const step = span > 5 ? Math.ceil(span / 5) : span > 2 ? 1 : 0.5;
    for (let v = lo; v <= max + 1e-9; v += step) {
      s.append(svg('line', { x1: m.left, x2: m.left + w, y1: y(v), y2: y(v), class: 'grid' }));
      const t = svg('text', { x: m.left - 8, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
      t.textContent = step < 1 ? v.toFixed(1) : v.toFixed(0);
      s.append(t);
    }
    // X labels: thin them out when they'd collide.
    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 64))));
    rows.forEach((r, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      const t = svg('text', { x: x(i), y: height - 8, class: 'tick', 'text-anchor': n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
      t.textContent = shortName(r.name, i);
      s.append(t);
    });

    const line = (key) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r[key])}`).join(' ');
    if (n > 1) {
      s.append(svg('path', { d: line('cgpa'), class: 'line-cgpa' }));
      s.append(svg('path', { d: line('gpa'), class: 'line-gpa' }));
    }
    const cross = svg('line', { y1: m.top, y2: m.top + h, class: 'crosshair', visibility: 'hidden' });
    s.append(cross);
    rows.forEach((r, i) => {
      s.append(svg('circle', { cx: x(i), cy: y(r.cgpa), r: 4, class: 'dot-cgpa' }));
      s.append(svg('circle', { cx: x(i), cy: y(r.gpa), r: 4.5, class: 'dot-gpa' }));
    });

    // Direct labels at the end of each line, pushed apart if they'd overlap.
    const last = rows[n - 1];
    let yg = y(last.gpa) + 4;
    let yc = y(last.cgpa) + 4;
    if (Math.abs(yg - yc) < 14) {
      const mid = (yg + yc) / 2;
      const up = last.gpa >= last.cgpa;
      yg = mid + (up ? -7 : 7);
      yc = mid + (up ? 7 : -7);
    }
    const lg = svg('text', { x: x(n - 1) + 9, y: yg, class: 'end-label strong' });
    lg.textContent = fmt(last.gpa);
    const lc = svg('text', { x: x(n - 1) + 9, y: yc, class: 'end-label' });
    lc.textContent = fmt(last.cgpa);
    s.append(lg, lc);

    // Hover / touch: one hit band per semester, wider than the dots.
    const band = n === 1 ? w : w / (n - 1);
    rows.forEach((r, i) => {
      const hit = svg('rect', { x: x(i) - band / 2, y: m.top, width: band, height: h, class: 'hit', tabindex: '0', 'aria-label': `${r.name}: GPA ${fmt(r.gpa)}, CGPA ${fmt(r.cgpa)}` });
      const show = () => {
        cross.setAttribute('x1', x(i));
        cross.setAttribute('x2', x(i));
        cross.setAttribute('visibility', 'visible');
        tip.replaceChildren(
          el('strong', {}, r.name),
          el('div', { class: 'tip-row' }, el('span', { class: 'legend-key key-gpa' }), 'Semester GPA', el('b', {}, fmt(r.gpa))),
          el('div', { class: 'tip-row' }, el('span', { class: 'legend-key key-cgpa' }), 'CGPA after', el('b', {}, fmt(r.cgpa))),
          el('div', { class: 'tip-row muted' }, `${r.credits} credit hours`),
        );
        tip.hidden = false;
        const tw = tip.offsetWidth;
        const left = Math.min(Math.max(x(i) - tw / 2, 0), width - tw);
        tip.style.left = `${left}px`;
        tip.style.top = `${Math.max(0, Math.min(y(r.gpa), y(r.cgpa)) - tip.offsetHeight - 12)}px`;
      };
      const hide = () => {
        cross.setAttribute('visibility', 'hidden');
        tip.hidden = true;
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', show);
      hit.addEventListener('blur', hide);
      s.append(hit);
    });
    plot.prepend(s);
  };

  const ro = new ResizeObserver(() => draw());
  ro.observe(plot);
  // A tap outside the chart closes a tooltip opened by touch.
  const outside = (e) => {
    if (!plot.contains(e.target)) {
      tip.hidden = true;
      const cross = plot.querySelector('.crosshair');
      if (cross) cross.setAttribute('visibility', 'hidden');
    }
  };
  document.addEventListener('pointerdown', outside);
  wrap.dispose = () => {
    ro.disconnect();
    document.removeEventListener('pointerdown', outside);
  };
  return wrap;
}

function shortName(name, i) {
  const m = /semester\s*(\d+)/i.exec(name);
  if (m) return `Sem ${m[1]}`;
  return name.length > 10 ? `${name.slice(0, 9)}…` : name || `#${i + 1}`;
}
