import { getData, setCalendarDay, getCurrentProfile } from "../store.js";
import { todayStr, addDays, startOfWeek, formatDate } from "../utils.js";
import { navigate } from "../router.js";
import { ring, lineChart } from "../components/charts.js";
import { icons } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { friendlyAiError } from "../aiError.js";
import { escapeHtml } from "../utils.js";

function insightsBody(insights) {
  if (!insights) {
    return `
      <p class="small muted mb-12">A quick read on this week's training and food, with a few personalized suggestions — including progress toward your goal weight if you've set one.</p>
      <button class="btn btn-primary btn-block" id="insights-btn">${icons.sparkle} Get this week's insights</button>
    `;
  }
  const ageMs = Date.now() - new Date(insights.generatedAt).getTime();
  const ageLabel =
    ageMs < 60 * 60 * 1000
      ? "just now"
      : ageMs < 24 * 60 * 60 * 1000
      ? `${Math.max(1, Math.round(ageMs / (60 * 60 * 1000)))}h ago`
      : `${Math.round(ageMs / (24 * 60 * 60 * 1000))}d ago`;
  return `
    <div style="font-weight:800; font-size:15px; margin-bottom:10px;">${escapeHtml(insights.headline)}</div>
    <ul style="padding-left:18px; margin:0; display:flex; flex-direction:column; gap:8px;">
      ${insights.suggestions.map((s) => `<li class="small">${escapeHtml(s)}</li>`).join("")}
    </ul>
    <div class="row-between mt-16">
      <span class="small faint">Generated ${ageLabel}</span>
      <button class="link-btn" id="insights-btn" style="font-size:13px;">${icons.refresh} Refresh</button>
    </div>
  `;
}

function computeStreak(calendar) {
  let streak = 0;
  let d = todayStr();
  // if today isn't logged yet, start checking from yesterday so an unlogged "today" doesn't zero the streak
  if (!calendar[d]) d = addDays(d, -1);
  while (calendar[d]) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

function weekBalance(sessions) {
  const weekStart = startOfWeek(todayStr());
  let strength = 0;
  let cardio = 0;
  for (const s of sessions) {
    if (s.date >= weekStart) {
      if (s.type === "cardio") cardio++;
      else if (s.type === "strength") strength++;
      else {
        strength++;
        cardio++;
      }
    }
  }
  return { strength, cardio };
}

export function renderDashboard(main) {
  const profile = getCurrentProfile();
  const data = getData();
  const today = todayStr();
  const todayStatus = data.calendar[today];
  const streak = computeStreak(data.calendar);
  const { strength, cardio } = weekBalance(data.sessions);
  const goal = data.settings.weeklyStrengthGoal + data.settings.weeklyCardioGoal;
  const done = strength + cardio;

  const weekStart = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dow = ["M", "T", "W", "T", "F", "S", "S"];

  const bwSorted = data.bodyWeight.slice(-10);
  const bwPoints = bwSorted.map((e) => ({ x: new Date(e.date).getTime(), y: e.weight, label: e.date.slice(5) }));

  const todayFood = data.food.filter((f) => f.date === today);
  const caloriesToday = todayFood.reduce((sum, f) => sum + (Number(f.calories) || 0), 0);

  let balanceMsg = "";
  if (done === 0) {
    balanceMsg = "No sessions logged this week yet — pick something below to get started.";
  } else if (cardio === 0 && strength > 0) {
    balanceMsg = "All strength so far this week. Add a cardio session to keep things balanced.";
  } else if (strength === 0 && cardio > 0) {
    balanceMsg = "All cardio so far this week. A strength session would round things out.";
  } else {
    balanceMsg = "Nice balance of strength and cardio this week. Keep it up.";
  }

  main.innerHTML = `
    <div class="section">
      <div class="page-title">Hi, ${escapeHtml(profile.name)}</div>
      <div class="page-subtitle">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
    </div>

    <div class="section card">
      ${
        todayStatus === "workout"
          ? `<div class="row"><span class="badge badge-success">${icons.check} Trained today</span></div><p class="muted small mt-8">Nice work. See it on your <a class="link-btn" href="#/calendar">calendar</a>.</p>`
          : todayStatus === "rest"
          ? `<div class="row"><span class="badge badge-muted">${icons.bed} Rest day</span></div><p class="muted small mt-8">Recovery is part of the plan.</p>`
          : `<div class="row-between">
              <div>
                <div style="font-weight:800; font-size:16px;">What's today's move?</div>
                <div class="muted small mt-8">Log a workout or mark today as a rest day.</div>
              </div>
            </div>
            <div class="row mt-16">
              <button class="btn btn-primary" id="start-workout">${icons.dumbbell} Start a workout</button>
              <button class="btn btn-secondary" id="log-rest">${icons.bed} Rest day</button>
            </div>`
      }
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">This week</div>
        <a href="#/calendar" class="section-link">Calendar</a>
      </div>
      <div class="card">
        <div class="week-day-pill-row">
          ${weekDays
            .map((d, i) => {
              const status = data.calendar[d];
              const isFuture = d > today;
              const cls = isFuture ? "future" : status || "";
              const dayNum = new Date(d + "T00:00:00").getDate();
              return `<div class="week-day-pill ${cls}"><span>${dow[i]}</span><span>${dayNum}</span></div>`;
            })
            .join("")}
        </div>
        <div class="row-between mt-16">
          <div class="row">
            ${ring({ value: done, max: Math.max(goal, done), size: 60, stroke: 7, label: `${done}/${goal}` })}
            <div>
              <div class="row" style="gap:6px;">
                <span class="badge badge-strength">Strength ${strength}</span>
                <span class="badge badge-cardio">Cardio ${cardio}</span>
              </div>
              <div class="small muted mt-8" style="max-width:230px;">${balanceMsg}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2 section">
      <div class="stat-tile">
        <div class="stat-tile-value">${icons.flame} ${streak}</div>
        <div class="stat-tile-label">Day streak</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-value">${caloriesToday || 0}</div>
        <div class="stat-tile-label">Calories today${data.settings.calorieGoal ? ` / ${data.settings.calorieGoal}` : ""}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">Body weight</div>
        <a href="#/weight" class="section-link">Log weight</a>
      </div>
      <div class="card">
        ${lineChart(bwPoints, { height: 120, unit: data.settings.unit, goal: data.settings.goalBodyWeight })}
        ${
          bwSorted.length
            ? `<div class="row-between mt-8"><span class="small muted">Latest</span><span style="font-weight:800;">${bwSorted[bwSorted.length - 1].weight} ${data.settings.unit}</span></div>`
            : `<p class="small faint center">Log your first weigh-in to start the trend.</p>`
        }
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">Weekly insights</div></div>
      <div class="card">${insightsBody(data.lastInsights)}</div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">Quick start</div>
        <a href="#/train" class="section-link">All templates</a>
      </div>
      <div class="row" style="overflow-x:auto;">
        <button class="btn btn-secondary" data-quick="push">Push</button>
        <button class="btn btn-secondary" data-quick="pull">Pull</button>
        <button class="btn btn-secondary" data-quick="legs">Legs</button>
        <button class="btn btn-secondary" data-quick="cardio">Cardio</button>
      </div>
    </div>
  `;

  document.getElementById("start-workout")?.addEventListener("click", () => navigate("/train"));
  document.getElementById("log-rest")?.addEventListener("click", () => {
    setCalendarDay(today, "rest");
    toast("Marked today as a rest day", { type: "success" });
    renderDashboard(main);
  });
  main.querySelectorAll("[data-quick]").forEach((btn) =>
    btn.addEventListener("click", () => navigate(`/session/build?template=${btn.dataset.quick}`))
  );

  document.getElementById("insights-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${icons.sparkle} Thinking…`;
    try {
      const { generateInsights } = await import("../insights.js");
      await generateInsights(data);
      renderDashboard(main);
    } catch (err) {
      console.error(err);
      toast(friendlyAiError(err, "Couldn't generate insights — try again shortly"), { type: "danger" });
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}
