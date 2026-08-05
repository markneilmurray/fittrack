import {
  getAllExercises,
  getLastPerformance,
  getData,
  setDraft,
  isFavorite,
  toggleFavorite,
  saveCustomTemplateFromDraft,
  addCustomExercise,
  deleteCustomExercise,
} from "../store.js";
import { navigate } from "../router.js";
import { escapeHtml, titleCase, exerciseThumbHtml } from "../utils.js";
import { icons } from "../components/icons.js";
import { openModal, closeModal, confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";

const GROUPS = [
  { id: "all", label: "All" },
  { id: "favorites", label: `★ Favourites` },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "legs", label: "Legs" },
  { id: "core", label: "Core" },
  { id: "cardio", label: "Cardio" },
];

export function renderLibrary(main, query = {}) {
  const picking = query.pick === "1";
  const initialGroup = query.group || "all";
  let activeGroup = initialGroup;
  let search = "";

  function matches(ex) {
    if (activeGroup === "favorites") {
      if (!isFavorite(ex.id)) return false;
    } else if (activeGroup !== "all" && ex.group !== activeGroup) {
      return false;
    }
    if (search) {
      const s = search.toLowerCase();
      if (!ex.name.toLowerCase().includes(s) && !ex.primaryMuscles.some((m) => m.includes(s))) return false;
    }
    return true;
  }

  function cardHtml(ex) {
    const last = getLastPerformance(ex.id);
    const fav = isFavorite(ex.id);
    return `
      <div class="ex-card card-tap" data-id="${ex.id}">
        <div class="ex-card-media">
          ${exerciseThumbHtml({ images: ex.images, className: "ex-card-img", alt: ex.name, placeholderIcon: ex.category === "cardio" ? icons.heart : icons.dumbbell })}
          <button class="fav-btn ${fav ? "active" : ""}" data-fav="${ex.id}" title="Favourite">${fav ? icons.starFilled : icons.star}</button>
          ${ex.isCustom ? `<button class="fav-btn" style="left:8px; right:auto;" data-delete-ex="${ex.id}" title="Delete">${icons.trash}</button>` : ""}
        </div>
        <div class="ex-card-body">
          <div class="ex-card-name">${escapeHtml(ex.name)}${ex.isCustom ? ` <span class="small faint">· Custom</span>` : ""}</div>
          <div class="ex-card-meta">${ex.groupLabel}${last ? ` · last ${last.weight ?? last.durationMin + "m"}${last.weight ? " " + getData().settings.unit : ""}` : ""}</div>
        </div>
      </div>
    `;
  }

  function draw() {
    const list = getAllExercises().filter(matches);
    const emptyFavorites = activeGroup === "favorites" && list.length === 0;
    main.innerHTML = `
      ${picking ? `<p class="page-subtitle" style="margin-top:-4px;">Tap an exercise to add it to your session</p>` : ""}
      <div class="field" style="margin-bottom:12px;">
        <input class="input" id="search" placeholder="Search exercises or muscles…" value="${escapeHtml(search)}" />
      </div>
      <div class="chip-row section">
        ${GROUPS.map((g) => `<div class="chip ${g.id === activeGroup ? "active" : ""}" data-group="${g.id}">${g.label}</div>`).join("")}
      </div>
      <div class="ex-grid">
        ${
          emptyFavorites
            ? `<div class="empty-state" style="grid-column:1/-1;">${icons.star}<div class="empty-state-title">No favourites yet</div><p class="small">Tap the star on any exercise to save it here.</p></div>`
            : list.map(cardHtml).join("") || `<div class="empty-state" style="grid-column:1/-1;">No exercises match.</div>`
        }
      </div>
      <button class="btn btn-secondary btn-block mt-16" id="add-custom-ex-btn">${icons.plus} Can't find it? Add a custom exercise</button>
    `;

    document.getElementById("search").addEventListener("input", (e) => {
      search = e.target.value;
      draw();
      document.getElementById("search").focus();
      const el = document.getElementById("search");
      el.setSelectionRange(el.value.length, el.value.length);
    });
    main.querySelectorAll("[data-group]").forEach((chip) =>
      chip.addEventListener("click", () => {
        activeGroup = chip.dataset.group;
        draw();
      })
    );
    main.querySelectorAll("[data-id]").forEach((card) =>
      card.addEventListener("click", () => {
        if (picking) {
          addToDraft(card.dataset.id);
        } else {
          navigate(`/library/${card.dataset.id}`);
        }
      })
    );
    main.querySelectorAll("[data-fav]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.fav);
        draw();
      })
    );
    main.querySelectorAll("[data-delete-ex]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog("Delete this custom exercise? It'll stay in any sessions that already used it, but you won't be able to add it to new ones.", { okLabel: "Delete" });
        if (ok) {
          deleteCustomExercise(btn.dataset.deleteEx);
          draw();
        }
      })
    );
    document.getElementById("add-custom-ex-btn").addEventListener("click", openAddExerciseModal);
  }

  function openAddExerciseModal() {
    const card = openModal(
      `
      <div class="modal-title">Add a custom exercise</div>
      <div class="field">
        <label>Name</label>
        <input class="input" id="ce-name" placeholder="e.g. Sled Push, Kettlebell Swing" maxlength="60" />
      </div>
      <div class="field">
        <label>Type</label>
        <div class="row" style="gap:8px;">
          <div class="chip active" data-ce-type="strength">Strength</div>
          <div class="chip" data-ce-type="cardio">Cardio</div>
        </div>
      </div>
      <div class="field" id="ce-muscle-field">
        <label>Muscle group</label>
        <div class="row" style="gap:8px; flex-wrap:wrap;">
          ${GROUPS.filter((g) => g.id !== "all" && g.id !== "favorites" && g.id !== "cardio")
            .map((g) => `<div class="chip ${g.id === "chest" ? "active" : ""}" data-ce-muscle="${g.id}">${g.label}</div>`)
            .join("")}
        </div>
      </div>
      <div class="field" style="margin-bottom:0;">
        <label>Notes / how to do it (optional)</label>
        <textarea class="input" id="ce-instructions" rows="3" placeholder="Any cues or setup notes for yourself"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" id="ce-save">Add exercise</button>
      </div>
    `,
      { onMount: setupAddExerciseModal }
    );

    function setupAddExerciseModal(card) {
      let isCardio = false;
      let muscle = "chest";
      card.querySelectorAll("[data-ce-type]").forEach((chip) =>
        chip.addEventListener("click", () => {
          isCardio = chip.dataset.ceType === "cardio";
          card.querySelectorAll("[data-ce-type]").forEach((c) => c.classList.toggle("active", c === chip));
          card.querySelector("#ce-muscle-field").style.display = isCardio ? "none" : "";
        })
      );
      card.querySelectorAll("[data-ce-muscle]").forEach((chip) =>
        chip.addEventListener("click", () => {
          muscle = chip.dataset.ceMuscle;
          card.querySelectorAll("[data-ce-muscle]").forEach((c) => c.classList.toggle("active", c === chip));
        })
      );
      card.querySelector("#ce-save").addEventListener("click", () => {
        const name = card.querySelector("#ce-name").value.trim();
        if (!name) {
          card.querySelector("#ce-name").focus();
          return;
        }
        const notes = card.querySelector("#ce-instructions").value.trim();
        const group = isCardio ? "cardio" : muscle;
        const groupLabel = GROUPS.find((g) => g.id === group)?.label || titleCase(group);
        const entry = addCustomExercise({
          name,
          group,
          groupLabel,
          category: isCardio ? "cardio" : "strength",
          instructions: notes ? [notes] : undefined,
        });
        closeModal();
        toast("Custom exercise added", { type: "success" });
        activeGroup = group;
        draw();
        if (picking) addToDraft(entry.id);
      });
    }
  }

  function addToDraft(exerciseId) {
    const ex = getAllExercises().find((e) => e.id === exerciseId);
    let draft = getData().draft;
    if (!draft) {
      draft = { date: new Date().toISOString().slice(0, 10), name: "Custom Session", exercises: [] };
    }
    if (draft.exercises.some((e) => e.exerciseId === exerciseId)) {
      navigate("/session/build");
      return;
    }
    if (ex.category === "cardio") {
      draft.exercises.push({ exerciseId, type: "cardio", durationMin: ex.default.durationMin, distanceKm: null });
    } else {
      const setCount = ex.default.sets || 3;
      draft.exercises.push({
        exerciseId,
        type: "strength",
        targetReps: ex.default.reps,
        sets: Array.from({ length: setCount }, () => ({ weight: "", reps: "", done: false })),
      });
    }
    setDraft(draft);
    saveCustomTemplateFromDraft(draft);
    navigate("/session/build");
  }

  draw();
}
