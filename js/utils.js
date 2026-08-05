export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  d.setDate(d.getDate() + diff);
  return todayStr(d);
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function titleCase(str) {
  if (!str) return "";
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Custom exercises (and HIIT) have no photo — renders the usual <img> when
// one exists, otherwise a placeholder box sized the same way so layouts
// don't jump, with an icon dropped in by the caller (already has its own
// icons.js import, so it's passed in rather than imported here).
export function exerciseThumbHtml({ images, className, alt = "", placeholderIcon = "" }) {
  if (images && images.length) {
    return `<img class="${className}" src="${images[0]}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  }
  return `<div class="${className} ex-img-placeholder">${placeholderIcon}</div>`;
}

export function kgToLb(kg) {
  return Math.round(kg * 2.20462 * 10) / 10;
}
export function lbToKg(lb) {
  return Math.round((lb / 2.20462) * 10) / 10;
}
