import { getData, getAllExercises, setDraft, clearDraft, addSession, getLastPerformance } from "../store.js";
import { navigate } from "../router.js";
import { icons } from "../components/icons.js";
import { confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { escapeHtml, exerciseThumbHtml } from "../utils.js";

function exerciseOf(id) {
  return getAllExercises().find((e) => e.id === id);
}

export function renderActiveSession(main) {
  const draft = getData().draft;
  if (!draft) {
    navigate("/train");
    return;
  }
  const unit = getData().settings.unit;

  function persist() {
    setDraft(draft);
  }

  function countSets() {
    const totalSets = draft.exercises.reduce((n, e) => n + (e.type === "strength" ? e.sets.length : 1), 0);
    const doneSets = draft.exercises.reduce(
      (n, e) => n + (e.type === "strength" ? e.sets.filter((s) => s.done).length : e.done ? 1 : 0),
      0
    );
    return { totalSets, doneSets };
  }

  function updateProgress() {
    const { totalSets, doneSets } = countSets();
    const el = document.getElementById("sets-progress");
    if (el) el.textContent = `${doneSets}/${totalSets} sets logged`;
  }

  function draw() {
    const { totalSets, doneSets } = countSets();

    main.innerHTML = `
      <div class="row-between mb-12">
        <div>
          <div class="page-title" style="font-size:20px;">${escapeHtml(draft.name)}</div>
          <div class="muted small" id="sets-progress">${doneSets}/${totalSets} sets logged</div>
        </div>
        <button class="btn-icon" id="edit-btn" title="Edit exercises">${icons.edit}</button>
      </div>

      <div class="stack">
        ${draft.exercises.map((e, i) => exerciseCard(e, i)).join("")}
      </div>

      <button class="btn btn-primary btn-block mt-24" id="finish-btn">${icons.check} Finish Session</button>
      <button class="btn btn-ghost btn-block mt-8" id="cancel-btn">Discard workout</button>
    `;

    attachHandlers();
  }

  function exerciseCard(e, i) {
    const ex = exerciseOf(e.exerciseId);
    const last = getLastPerformance(e.exerciseId);
    if (e.type === "strength") {
      return `
        <div class="session-ex-row">
          <div class="session-ex-head">
            ${exerciseThumbHtml({ images: ex.images, className: "session-ex-thumb", alt: ex.name, placeholderIcon: ex.category === "cardio" ? icons.heart : icons.dumbbell })}
            <div class="spacer">
              <div class="session-ex-name">${escapeHtml(ex.name)}</div>
              <div class="session-ex-sub">Target ${e.targetReps} reps</div>
              ${last ? `<div class="last-time-pill">${icons.flame} Last: ${last.weight} ${unit} × ${last.reps}</div>` : ""}
            </div>
          </div>
          <table class="set-table">
            <thead><tr><th></th><th>${unit}</th><th>Reps</th><th></th></tr></thead>
            <tbody>
              ${e.sets
                .map(
                  (s, si) => `
                <tr>
                  <td class="set-num">${si + 1}</td>
                  <td><input class="input" type="number" inputmode="decimal" placeholder="${last ? last.weight : "0"}" value="${s.weight}" data-ex="${i}" data-set="${si}" data-field="weight" /></td>
                  <td><input class="input" type="number" inputmode="numeric" placeholder="${last ? last.reps : ex.default.reps}" value="${s.reps}" data-ex="${i}" data-set="${si}" data-field="reps" /></td>
                  <td><button class="set-done-btn ${s.done ? "done" : ""}" data-toggle-set="${i}:${si}">${icons.check}</button></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    }
    return `
      <div class="session-ex-row">
        <div class="session-ex-head">
          ${exerciseThumbHtml({ images: ex.images, className: "session-ex-thumb", alt: ex.name, placeholderIcon: icons.heart })}
          <div class="spacer">
            <div class="session-ex-name">${escapeHtml(ex.name)}</div>
            <div class="session-ex-sub">Cardio</div>
            ${last ? `<div class="last-time-pill">${icons.flame} Last: ${last.durationMin} min</div>` : ""}
          </div>
          <button class="set-done-btn ${e.done ? "done" : ""}" data-toggle-cardio="${i}">${icons.check}</button>
        </div>
        <div class="input-row mt-8">
          <div class="field" style="margin-bottom:0;">
            <label>Duration (min)</label>
            <input class="input" type="number" min="0" value="${e.durationMin ?? ""}" data-cardio-field="${i}:durationMin" />
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Distance (km, optional)</label>
            <input class="input" type="number" step="0.1" min="0" value="${e.distanceKm ?? ""}" data-cardio-field="${i}:distanceKm" />
          </div>
        </div>
        <div class="field mt-8" style="margin-bottom:0;">
          <label>Calories burned (optional)</label>
          <input class="input" type="number" min="0" inputmode="numeric" placeholder="e.g. 250" value="${e.caloriesBurned ?? ""}" data-cardio-field="${i}:caloriesBurned" />
          <p class="small faint mt-8" style="margin-bottom:0;">Added back to today's food allowance once you finish this session.</p>
        </div>
      </div>
    `;
  }

  function attachHandlers() {
    main.querySelectorAll("[data-field]").forEach((input) =>
      input.addEventListener("input", () => {
        const ei = Number(input.dataset.ex);
        const si = Number(input.dataset.set);
        draft.exercises[ei].sets[si][input.dataset.field] = input.value;
        persist();
      })
    );
    main.querySelectorAll("[data-toggle-set]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const [ei, si] = btn.dataset.toggleSet.split(":").map(Number);
        const set = draft.exercises[ei].sets[si];
        set.done = !set.done;
        persist();
        btn.classList.toggle("done", set.done);
        updateProgress();
      })
    );
    main.querySelectorAll("[data-toggle-cardio]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const ei = Number(btn.dataset.toggleCardio);
        draft.exercises[ei].done = !draft.exercises[ei].done;
        persist();
        btn.classList.toggle("done", draft.exercises[ei].done);
        updateProgress();
      })
    );
    main.querySelectorAll("[data-cardio-field]").forEach((input) =>
      input.addEventListener("input", () => {
        const [ei, field] = input.dataset.cardioField.split(":");
        draft.exercises[Number(ei)][field] = input.value === "" ? null : Number(input.value);
        persist();
      })
    );
    document.getElementById("edit-btn").addEventListener("click", () => navigate("/session/build"));
    document.getElementById("finish-btn").addEventListener("click", finish);
    document.getElementById("cancel-btn").addEventListener("click", async () => {
      const ok = await confirmDialog("Discard this workout? Nothing will be saved.", { okLabel: "Discard" });
      if (ok) {
        clearDraft();
        navigate("/dashboard");
      }
    });
  }

  function determineType() {
    const hasStrength = draft.exercises.some((e) => e.type === "strength");
    const hasCardio = draft.exercises.some((e) => e.type === "cardio");
    if (hasStrength && hasCardio) return "mixed";
    return hasCardio ? "cardio" : "strength";
  }

  function finish() {
    const session = {
      date: draft.date,
      name: draft.name,
      type: determineType(),
      exercises: draft.exercises,
    };
    addSession(session);
    clearDraft();
    toast("Workout saved 💪", { type: "success" });
    navigate("/dashboard");
  }

  draw();
}
