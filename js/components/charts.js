// Small dependency-free SVG chart helpers.

export function lineChart(points, { width = 600, height = 200, pad = 28, unit = "", goal = null } = {}) {
  if (!points.length) {
    return `<div class="chart-empty">Not enough data yet</div>`;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minY = Math.min(...ys, goal ?? Infinity);
  let maxY = Math.max(...ys, goal ?? -Infinity);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const padY = (maxY - minY) * 0.15;
  minY -= padY;
  maxY += padY;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanX = maxX - minX || 1;

  const sx = (x) => pad + ((x - minX) / spanX) * (width - pad * 2);
  const sy = (y) => height - pad - ((y - minY) / (maxY - minY)) * (height - pad * 2);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L ${sx(xs[xs.length - 1]).toFixed(1)} ${height - pad} L ${sx(xs[0]).toFixed(1)} ${height - pad} Z`;

  const dots = points
    .map(
      (p) =>
        `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3.5" class="chart-dot"><title>${p.label ?? ""}: ${p.y}${unit}</title></circle>`
    )
    .join("");

  const goalLine =
    goal != null
      ? `<line x1="${pad}" y1="${sy(goal).toFixed(1)}" x2="${width - pad}" y2="${sy(goal).toFixed(1)}" class="chart-goal" />`
      : "";

  const firstLabel = points[0].label ?? "";
  const lastLabel = points[points.length - 1].label ?? "";

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      <path d="${area}" class="chart-area" />
      <path d="${path}" class="chart-line" />
      ${goalLine}
      ${dots}
    </svg>
    <div class="chart-axis"><span>${firstLabel}</span><span>${lastLabel}</span></div>
  `;
}

export function barChart(bars, { width = 600, height = 180, pad = 24 } = {}) {
  if (!bars.length) return `<div class="chart-empty">No data yet</div>`;
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const bw = (width - pad * 2) / bars.length;
  const rects = bars
    .map((b, i) => {
      const h = (b.value / maxVal) * (height - pad * 2);
      const x = pad + i * bw + bw * 0.15;
      const y = height - pad - h;
      const w = bw * 0.7;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="4" class="chart-bar ${b.className ?? ""}"><title>${b.label}: ${b.value}</title></rect>`;
    })
    .join("");
  const labels = bars
    .map((b, i) => {
      const x = pad + i * bw + bw / 2;
      return `<text x="${x.toFixed(1)}" y="${height - 6}" class="chart-bar-label" text-anchor="middle">${b.label}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">${rects}${labels}</svg>`;
}

export function ring({ value, max, size = 96, stroke = 10, label = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const offset = c * (1 - pct);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring-svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}" fill="none" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-progress" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" />
      <text x="50%" y="50%" class="ring-label" text-anchor="middle" dominant-baseline="middle">${label}</text>
    </svg>
  `;
}
