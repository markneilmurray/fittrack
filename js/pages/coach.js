import { getData, getCoachGoals, saveCoachGoals, getCoachReports, saveCoachReport } from "../store.js";
import { todayStr, startOfWeek, formatDate, escapeHtml } from "../utils.js";
import { icons } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { friendlyAiError } from "../aiError.js";

const GOAL_OPTIONS = [
  { id: "lose_weight", label: "Lose weight" },
  { id: "build_muscle", label: "Build muscle" },
  { id: "build_strength", label: "Get stronger" },
  { id: "improve_cardio", label: "Improve cardio fitness" },
  { id: "general_health", label: "General health & consistency" },
];

const FOCUS_OPTIONS = [
  { id: "strength", label: "More strength training" },
  { id: "cardio", label: "More cardio" },
  { id: "balanced", label: "Keep it balanced" },
];

const GOAL_LABELS = Object.fromEntries(GOAL_OPTIONS.map((g) => [g.id, g.label]));
const FOCUS_LABELS = Object.fromEntries(FOCUS_OPTIONS.map((f) => [f.id, f.label]));

function goalsToText(goals) {
  let text = `Primary goal: ${GOAL_LABELS[goals.primaryGoal] || goals.primaryGoal}.`;
  if (goals.focus) text += ` Preferred training focus: ${FOCUS_LABELS[goals.focus] || goals.focus}.`;
  if (goals.notes) text += ` Additional notes from them: ${goals.notes}`;
  return text;
}

export function renderCoach(main) {
  const goals = getCoachGoals();
  if (!goals || !goals.primaryGoal) {
    renderOnboarding(main);
  } else {
    renderDashboard(main);
  }

  function renderOnboarding(main, existing) {
    let goal = existing?.primaryGoal || null;
    let focus = existing?.focus || null;
    let notes = existing?.notes || "";

    function draw() {
      main.innerHTML = `
        <div class="section-title mb-8">${existing ? "Edit your goal" : "Let's set your goal"}</div>
        <p class="small muted mb-12">Answer a couple of quick questions so your coach can tailor its advice to what you're actually trying to achieve — you can change this anytime.</p>

        <div class="section">
          <div class="section-title mb-8">What's your main goal right now?</div>
          <div class="card row" style="gap:8px; flex-wrap:wrap;">
            ${GOAL_OPTIONS.map((g) => `<div class="chip ${goal === g.id ? "active" : ""}" data-goal="${g.id}">${g.label}</div>`).join("")}
          </div>
        </div>

        <div class="section">
          <div class="section-title mb-8">Where do you want to focus?</div>
          <div class="card row" style="gap:8px; flex-wrap:wrap;">
            ${FOCUS_OPTIONS.map((f) => `<div class="chip ${focus === f.id ? "active" : ""}" data-focus="${f.id}">${f.label}</div>`).join("")}
          </div>
        </div>

        <div class="section">
          <div class="field" style="margin-bottom:0;">
            <label>Anything else to keep in mind? (optional)</label>
            <textarea class="input" id="coach-notes" rows="3" placeholder="e.g. bad knee, prefer home workouts, training for a 10k...">${escapeHtml(notes)}</textarea>
          </div>
        </div>

        <button class="btn btn-primary btn-block mt-16" id="save-goals-btn" ${goal && focus ? "" : "disabled"}>Save &amp; get started</button>
        ${existing ? `<button class="btn btn-ghost btn-block mt-8" id="cancel-goals-btn">Cancel</button>` : ""}
      `;

      main.querySelectorAll("[data-goal]").forEach((chip) =>
        chip.addEventListener("click", () => {
          goal = chip.dataset.goal;
          draw();
        })
      );
      main.querySelectorAll("[data-focus]").forEach((chip) =>
        chip.addEventListener("click", () => {
          focus = chip.dataset.focus;
          draw();
        })
      );
      document.getElementById("coach-notes").addEventListener("change", (e) => {
        notes = e.target.value;
      });
      document.getElementById("save-goals-btn").addEventListener("click", () => {
        saveCoachGoals({ primaryGoal: goal, focus, notes: notes.trim() });
        renderDashboard(main);
      });
      document.getElementById("cancel-goals-btn")?.addEventListener("click", () => renderDashboard(main));
    }

    draw();
  }

  function weekOverWeekLine(summary, prevReport) {
    if (!prevReport?.summary) return "";
    const p = prevReport.summary;
    const parts = [];
    const diff = (curr, prev, unit = "") => {
      if (curr == null || prev == null) return "";
      const d = Math.round((curr - prev) * 10) / 10;
      if (d === 0) return " (same as last week)";
      return ` (${d > 0 ? "+" : ""}${d}${unit} vs last week)`;
    };
    if (summary.daysLogged || p.daysLogged) {
      parts.push(`Strength: ${summary.strengthCount}${diff(summary.strengthCount, p.strengthCount)}`);
      parts.push(`Cardio: ${summary.cardioCount}${diff(summary.cardioCount, p.cardioCount)}`);
    }
    if (summary.avgCaloriesPerLoggedDay && p.avgCaloriesPerLoggedDay) {
      parts.push(`Avg calories: ${summary.avgCaloriesPerLoggedDay}/day${diff(summary.avgCaloriesPerLoggedDay, p.avgCaloriesPerLoggedDay, " kcal")}`);
    }
    if (summary.currentWeight != null && p.currentWeight != null) {
      parts.push(`Weight: ${summary.currentWeight}${summary.unit}${diff(summary.currentWeight, p.currentWeight, summary.unit)}`);
    }
    if (!parts.length) return "";
    return `<p class="small muted mt-8" style="margin-bottom:0;"><strong>Vs last week:</strong> ${parts.join(" · ")}</p>`;
  }

  function reportBody(report, prevReport) {
    if (!report) {
      return `
        <p class="small muted mb-12">Get a coaching report grounded in this week's actual food and training, tailored to your goal — plus specific food and strength/cardio suggestions.</p>
        <button class="btn btn-primary btn-block" id="coach-report-btn">${icons.sparkle} Get this week's report</button>
      `;
    }
    const ageMs = Date.now() - new Date(report.generatedAt).getTime();
    const ageLabel =
      ageMs < 60 * 60 * 1000
        ? "just now"
        : ageMs < 24 * 60 * 60 * 1000
        ? `${Math.max(1, Math.round(ageMs / (60 * 60 * 1000)))}h ago`
        : `${Math.round(ageMs / (24 * 60 * 60 * 1000))}d ago`;
    return `
      <div style="font-weight:800; font-size:15px; margin-bottom:10px;">${escapeHtml(report.headline)}</div>
      <ul style="padding-left:18px; margin:0; display:flex; flex-direction:column; gap:8px;">
        ${report.suggestions.map((s) => `<li class="small">${escapeHtml(s)}</li>`).join("")}
      </ul>
      ${weekOverWeekLine(report.summary, prevReport)}
      <div class="row-between mt-16">
        <span class="small faint">Generated ${ageLabel}</span>
        <button class="link-btn" id="coach-report-btn" style="font-size:13px;">${icons.refresh} Refresh</button>
      </div>
    `;
  }

  function renderDashboard(main) {
    const goals = getCoachGoals();
    const reports = getCoachReports();
    const thisWeekStart = startOfWeek(todayStr());
    const latest = reports.find((r) => r.weekStart === thisWeekStart) || reports[0] || null;
    const prev = latest ? reports.find((r) => r.weekStart < latest.weekStart) : null;
    const history = reports.filter((r) => r !== latest);

    main.innerHTML = `
      <div class="card section row-between">
        <div>
          <div class="small muted">Your goal</div>
          <div style="font-weight:800;">${GOAL_LABELS[goals.primaryGoal] || goals.primaryGoal} · ${FOCUS_LABELS[goals.focus] || ""}</div>
          ${goals.notes ? `<div class="small muted mt-8">${escapeHtml(goals.notes)}</div>` : ""}
        </div>
        <button class="btn btn-secondary btn-sm" id="edit-goals-btn">Edit</button>
      </div>

      <div class="section">
        <div class="card">${reportBody(latest, prev)}</div>
      </div>

      ${
        history.length
          ? `
      <div class="section">
        <div class="section-title mb-8">Past weeks</div>
        <div class="stack" style="gap:8px;">
          ${history
            .map(
              (r) => `
            <details class="card">
              <summary style="cursor:pointer; font-weight:700; font-size:14px;">${formatDate(r.weekStart)} — ${escapeHtml(r.headline)}</summary>
              <ul style="padding-left:18px; margin:10px 0 0; display:flex; flex-direction:column; gap:6px;">
                ${r.suggestions.map((s) => `<li class="small">${escapeHtml(s)}</li>`).join("")}
              </ul>
            </details>
          `
            )
            .join("")}
        </div>
      </div>
      `
          : ""
      }
    `;

    document.getElementById("edit-goals-btn").addEventListener("click", () => renderOnboarding(main, goals));

    document.getElementById("coach-report-btn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `${icons.sparkle} Thinking…`;
      try {
        const { computeWeeklySummary, summaryToText } = await import("../insights.js");
        const { generateCoachReport } = await import("../firebase.js");
        const summary = computeWeeklySummary(getData());
        const result = await generateCoachReport(goalsToText(goals), summaryToText(summary));
        saveCoachReport({
          weekStart: thisWeekStart,
          generatedAt: new Date().toISOString(),
          headline: result.headline,
          suggestions: result.suggestions,
          summary,
        });
        renderDashboard(main);
      } catch (err) {
        console.error(err);
        toast(friendlyAiError(err, "Couldn't generate a coaching report — try again shortly"), { type: "danger" });
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }
}
