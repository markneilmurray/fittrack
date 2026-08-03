import { TEMPLATES } from "../data/templates.js";
import { EXERCISES } from "../data/exercises.js";
import { getData, setDraft, clearDraft, isTemplateCustomized } from "../store.js";
import { navigate } from "../router.js";
import { icons } from "../components/icons.js";
import { confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { formatDate, escapeHtml } from "../utils.js";

export function renderTrain(main) {
  const data = getData();
  const draft = data.draft;
  const recent = data.sessions.slice(0, 5);

  main.innerHTML = `
    ${
      draft
        ? `<div class="card section" style="border-color:var(--primary);">
            <div class="row-between">
              <div>
                <div style="font-weight:800;">${draft.status === "active" ? "Workout in progress" : "Session being built"}</div>
                <div class="muted small mt-8">${draft.exercises.length} exercise${draft.exercises.length === 1 ? "" : "s"} · ${escapeHtml(draft.name || "Custom Session")}</div>
              </div>
              <div class="row" style="gap:8px;">
                <button class="btn btn-primary btn-sm" id="resume-btn">Resume</button>
                <button class="btn-icon" id="dismiss-draft-btn" title="Discard this session">${icons.x}</button>
              </div>
            </div>
          </div>`
        : ""
    }

    <div class="section">
      <div class="section-head"><div class="section-title">Start a session</div></div>
      <div class="grid-2">
        ${TEMPLATES.map(
          (t) => `
          <div class="template-card card-tap" data-template="${t.id}">
            <div class="row-between" style="margin-bottom:8px;">
              <span class="badge ${t.type === "cardio" ? "badge-cardio" : "badge-strength"}">${t.type}</span>
              ${isTemplateCustomized(t.id) ? `<span class="badge badge-muted">Edited</span>` : ""}
            </div>
            <div class="template-name">${t.name}</div>
            <div class="template-blurb">${t.blurb}</div>
          </div>
        `
        ).join("")}
      </div>
      <button class="btn btn-secondary btn-block mt-12" id="custom-btn">${icons.plus} Custom session</button>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">Exercise library</div>
        <a href="#/library" class="section-link">Browse all</a>
      </div>
    </div>

    ${
      recent.length
        ? `<div class="section">
            <div class="section-title mb-8">Recent sessions</div>
            <div class="stack">
              ${recent
                .map(
                  (s) => `
                <div class="list-item">
                  <div class="list-item-body">
                    <div class="list-item-title">${escapeHtml(s.name || "Session")}</div>
                    <div class="list-item-sub">${formatDate(s.date)} · ${s.exercises.length} exercises</div>
                  </div>
                  <button class="btn btn-secondary btn-sm" data-repeat="${s.id}">Repeat</button>
                </div>
              `
                )
                .join("")}
            </div>
          </div>`
        : ""
    }
  `;

  document.getElementById("resume-btn")?.addEventListener("click", () => {
    navigate(draft.status === "active" ? "/session/active" : "/session/build");
  });
  document.getElementById("dismiss-draft-btn")?.addEventListener("click", async () => {
    const ok = await confirmDialog(
      draft.status === "active" ? "Discard this workout? Nothing logged will be saved." : "Discard this session?",
      { okLabel: "Discard" }
    );
    if (ok) {
      clearDraft();
      toast("Session discarded");
      renderTrain(main);
    }
  });
  document.getElementById("custom-btn").addEventListener("click", () => navigate("/session/build"));
  main.querySelectorAll("[data-template]").forEach((el) =>
    el.addEventListener("click", () => navigate(`/session/build?template=${el.dataset.template}`))
  );
  main.querySelectorAll("[data-repeat]").forEach((el) =>
    el.addEventListener("click", () => repeatSession(el.dataset.repeat))
  );

  function repeatSession(sessionId) {
    const s = data.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    const newDraft = {
      date: new Date().toISOString().slice(0, 10),
      name: s.name,
      exercises: s.exercises.map((e) =>
        e.type === "strength"
          ? { ...e, sets: e.sets.map(() => ({ weight: "", reps: "", done: false })) }
          : { ...e, distanceKm: null }
      ),
    };
    setDraft(newDraft);
    navigate("/session/build");
  }
}
