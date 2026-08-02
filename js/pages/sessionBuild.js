import { EXERCISES } from "../data/exercises.js";
import { TEMPLATES } from "../data/templates.js";
import {
  getData,
  setDraft,
  clearDraft,
  getCustomTemplate,
  saveCustomTemplateFromDraft,
  resetCustomTemplate,
  isTemplateCustomized,
} from "../store.js";
import { navigate } from "../router.js";
import { icons } from "../components/icons.js";
import { confirmDialog } from "../components/modal.js";
import { escapeHtml, todayStr } from "../utils.js";

function exerciseOf(id) {
  return EXERCISES.find((e) => e.id === id);
}

function exerciseEntry(id, item) {
  const ex = exerciseOf(id);
  if (ex.category === "cardio") {
    return { exerciseId: id, type: "cardio", durationMin: item?.durationMin ?? ex.default.durationMin, distanceKm: null };
  }
  const setCount = item?.setCount ?? ex.default.sets ?? 3;
  return {
    exerciseId: id,
    type: "strength",
    targetReps: ex.default.reps,
    sets: Array.from({ length: setCount }, () => ({ weight: "", reps: "", done: false })),
  };
}

function buildFromTemplate(templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) return null;
  const custom = getCustomTemplate(templateId);
  const list = custom ? custom.exercises : t.exerciseIds.map((id) => ({ exerciseId: id }));
  return {
    date: todayStr(),
    name: t.name,
    status: "building",
    templateId,
    exercises: list.map((item) => exerciseEntry(item.exerciseId, item)),
  };
}

export function renderSessionBuild(main, query = {}) {
  let draft = getData().draft;
  if (!draft && query.template) {
    draft = buildFromTemplate(query.template);
    setDraft(draft);
  }
  if (!draft) {
    draft = { date: todayStr(), name: "Custom Session", status: "building", exercises: [] };
    setDraft(draft);
  }

  function persist() {
    setDraft(draft);
  }

  // Only real exercise-list edits (remove, add, change set count/duration)
  // call this — renaming the session or just opening the default template
  // never marks it customized.
  function persistAndSyncTemplate() {
    setDraft(draft);
    saveCustomTemplateFromDraft(draft);
  }

  function draw() {
    main.innerHTML = `
      <div class="field">
        <label>Session name</label>
        <input class="input" id="session-name" value="${escapeHtml(draft.name)}" maxlength="40" />
      </div>

      ${
        draft.templateId && isTemplateCustomized(draft.templateId)
          ? `<p class="small muted mb-12"><span style="vertical-align:-3px;">${icons.refresh}</span> Remembered from last time — <button class="link-btn" id="reset-template-btn" style="font-size:inherit;">reset to default</button></p>`
          : ""
      }

      <div class="stack" id="ex-list">
        ${
          draft.exercises.length
            ? draft.exercises
                .map((e, i) => {
                  const ex = exerciseOf(e.exerciseId);
                  return `
                  <div class="session-ex-row" data-idx="${i}">
                    <div class="session-ex-head">
                      <img class="session-ex-thumb" src="${ex.images[0]}" alt="" />
                      <div class="spacer">
                        <div class="session-ex-name">${escapeHtml(ex.name)}</div>
                        <div class="session-ex-sub">${
                          e.type === "strength" ? `${e.sets.length} sets × ${e.targetReps} reps` : `${e.durationMin} min cardio`
                        }</div>
                      </div>
                      <button class="btn-icon remove-ex-btn" data-remove="${i}">${icons.trash}</button>
                    </div>
                    ${
                      e.type === "strength"
                        ? `<div class="row mt-8" style="gap:16px;">
                            <label class="small muted">Sets
                              <div class="row" style="gap:6px; margin-top:4px;">
                                <button class="btn-icon btn-sm" style="width:30px;height:30px;" data-dec="${i}">−</button>
                                <span style="min-width:16px; text-align:center; font-weight:700;">${e.sets.length}</span>
                                <button class="btn-icon btn-sm" style="width:30px;height:30px;" data-inc="${i}">+</button>
                              </div>
                            </label>
                          </div>`
                        : `<div class="field" style="margin-top:8px; margin-bottom:0;">
                            <label>Target duration (min)</label>
                            <input class="input" type="number" min="1" data-duration="${i}" value="${e.durationMin}" />
                          </div>`
                    }
                  </div>
                `;
                })
                .join("")
            : `<div class="empty-state">${icons.dumbbell}<div class="empty-state-title">No exercises yet</div><p class="small">Add exercises from the library below.</p></div>`
        }
      </div>

      <button class="btn btn-secondary btn-block mt-16" id="add-ex-btn">${icons.plus} Add exercise</button>

      <div class="row mt-24" style="gap:10px;">
        <button class="btn btn-ghost" id="cancel-btn">Cancel</button>
        <button class="btn btn-primary btn-block" id="start-btn" ${draft.exercises.length ? "" : "disabled"}>Start Workout</button>
      </div>
    `;

    document.getElementById("session-name").addEventListener("input", (e) => {
      draft.name = e.target.value;
      persist();
    });
    document.getElementById("add-ex-btn").addEventListener("click", () => navigate("/library?pick=1"));
    main.querySelectorAll("[data-remove]").forEach((btn) =>
      btn.addEventListener("click", () => {
        draft.exercises.splice(Number(btn.dataset.remove), 1);
        persistAndSyncTemplate();
        draw();
      })
    );
    main.querySelectorAll("[data-inc]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const e = draft.exercises[Number(btn.dataset.inc)];
        e.sets.push({ weight: "", reps: "", done: false });
        persistAndSyncTemplate();
        draw();
      })
    );
    main.querySelectorAll("[data-dec]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const e = draft.exercises[Number(btn.dataset.dec)];
        if (e.sets.length > 1) e.sets.pop();
        persistAndSyncTemplate();
        draw();
      })
    );
    main.querySelectorAll("[data-duration]").forEach((input) =>
      input.addEventListener("input", () => {
        draft.exercises[Number(input.dataset.duration)].durationMin = Number(input.value) || 0;
        persistAndSyncTemplate();
      })
    );
    document.getElementById("cancel-btn").addEventListener("click", async () => {
      const ok = await confirmDialog("Discard this session?", { okLabel: "Discard" });
      if (ok) {
        clearDraft();
        navigate("/train");
      }
    });
    document.getElementById("start-btn")?.addEventListener("click", () => {
      draft.status = "active";
      persist();
      navigate("/session/active");
    });
    document.getElementById("reset-template-btn")?.addEventListener("click", async () => {
      const ok = await confirmDialog("Reset this template back to its original exercise list?", {
        okLabel: "Reset",
        danger: false,
      });
      if (!ok) return;
      resetCustomTemplate(draft.templateId);
      draft = buildFromTemplate(draft.templateId);
      setDraft(draft);
      draw();
    });
  }

  draw();
}
