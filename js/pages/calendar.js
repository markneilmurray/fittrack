import { getData, setCalendarDay } from "../store.js";
import { todayStr, daysInMonth } from "../utils.js";
import { openModal, closeModal } from "../components/modal.js";
import { icons } from "../components/icons.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../utils.js";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function renderCalendar(main) {
  const today = todayStr();
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  function draw() {
    const data = getData();
    const calendar = data.calendar;
    const first = new Date(viewYear, viewMonth, 1);
    let startOffset = first.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const totalDays = daysInMonth(viewYear, viewMonth);

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);

    let workoutCount = 0,
      restCount = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = fmt(viewYear, viewMonth, d);
      if (calendar[dateStr] === "workout") workoutCount++;
      if (calendar[dateStr] === "rest") restCount++;
    }

    main.innerHTML = `
      <div class="row-between section">
        <button class="btn-icon" id="prev-month">${icons.chevronLeft}</button>
        <div style="font-weight:800; font-size:16px;">${MONTHS[viewMonth]} ${viewYear}</div>
        <button class="btn-icon" id="next-month">${icons.chevronRight}</button>
      </div>

      <div class="card">
        <div class="cal-grid mb-8">
          ${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join("")}
        </div>
        <div class="cal-grid">
          ${cells
            .map((d) => {
              if (!d) return `<div class="cal-day outside"></div>`;
              const dateStr = fmt(viewYear, viewMonth, d);
              const status = calendar[dateStr];
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              const cls = [isToday ? "today" : "", status || (!isFuture && dateStr < today ? "" : "")].join(" ");
              return `<div class="cal-day ${status || ""} ${isToday ? "today" : ""}" data-date="${dateStr}">${d}</div>`;
            })
            .join("")}
        </div>
        <div class="cal-legend">
          <div class="cal-legend-item"><span class="cal-legend-dot" style="background:var(--success);"></span>Workout (${workoutCount})</div>
          <div class="cal-legend-item"><span class="cal-legend-dot" style="background:var(--primary);"></span>Rest (${restCount})</div>
          <div class="cal-legend-item"><span class="cal-legend-dot" style="background:var(--border); border:1px solid var(--text-faint);"></span>Not logged</div>
        </div>
      </div>

      <div class="section mt-16">
        <div class="section-title mb-8">This month</div>
        <div class="grid-2">
          <div class="stat-tile"><div class="stat-tile-value">${workoutCount}</div><div class="stat-tile-label">Workouts</div></div>
          <div class="stat-tile"><div class="stat-tile-value">${restCount}</div><div class="stat-tile-label">Rest days</div></div>
        </div>
      </div>
    `;

    document.getElementById("prev-month").addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      draw();
    });
    document.getElementById("next-month").addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      draw();
    });
    main.querySelectorAll("[data-date]").forEach((el) =>
      el.addEventListener("click", () => openDayModal(el.dataset.date))
    );
  }

  function openDayModal(dateStr) {
    const data = getData();
    const sessions = data.sessions.filter((s) => s.date === dateStr);
    const status = data.calendar[dateStr];
    const card = openModal(
      `
      <div class="modal-title">${new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      ${
        sessions.length
          ? `<div class="stack mb-12">
              ${sessions
                .map(
                  (s) => `<div class="list-item"><div class="list-item-body"><div class="list-item-title">${escapeHtml(s.name)}</div><div class="list-item-sub">${s.exercises.length} exercises</div></div></div>`
                )
                .join("")}
            </div>`
          : ""
      }
      <div class="row" style="gap:8px;">
        <button class="btn ${status === "workout" ? "btn-success" : "btn-secondary"}" data-set="workout">${icons.check} Workout</button>
        <button class="btn ${status === "rest" ? "btn-primary" : "btn-secondary"}" data-set="rest">${icons.bed} Rest</button>
        <button class="btn btn-ghost" data-set="clear">Clear</button>
      </div>
    `,
      { size: "modal-sm" }
    );
    card.querySelectorAll("[data-set]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const v = btn.dataset.set;
        setCalendarDay(dateStr, v === "clear" ? null : v);
        closeModal();
        draw();
      })
    );
  }

  draw();
}

function fmt(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
