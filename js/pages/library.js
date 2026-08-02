import { EXERCISES } from "../data/exercises.js";
import { navigate } from "../router.js";
import { getLastPerformance, getData, setDraft } from "../store.js";
import { escapeHtml, titleCase } from "../utils.js";

const GROUPS = [
  { id: "all", label: "All" },
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
    if (activeGroup !== "all" && ex.group !== activeGroup) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!ex.name.toLowerCase().includes(s) && !ex.primaryMuscles.some((m) => m.includes(s))) return false;
    }
    return true;
  }

  function cardHtml(ex) {
    const last = getLastPerformance(ex.id);
    const img = ex.images[0];
    return `
      <div class="ex-card card-tap" data-id="${ex.id}">
        <img class="ex-card-img" src="${img}" alt="${escapeHtml(ex.name)}" loading="lazy" />
        <div class="ex-card-body">
          <div class="ex-card-name">${escapeHtml(ex.name)}</div>
          <div class="ex-card-meta">${ex.groupLabel}${last ? ` · last ${last.weight ?? last.durationMin + "m"}${last.weight ? " " + getData().settings.unit : ""}` : ""}</div>
        </div>
      </div>
    `;
  }

  function draw() {
    const list = EXERCISES.filter(matches);
    main.innerHTML = `
      ${picking ? `<p class="page-subtitle" style="margin-top:-4px;">Tap an exercise to add it to your session</p>` : ""}
      <div class="field" style="margin-bottom:12px;">
        <input class="input" id="search" placeholder="Search exercises or muscles…" value="${escapeHtml(search)}" />
      </div>
      <div class="chip-row section">
        ${GROUPS.map((g) => `<div class="chip ${g.id === activeGroup ? "active" : ""}" data-group="${g.id}">${g.label}</div>`).join("")}
      </div>
      <div class="ex-grid">
        ${list.map(cardHtml).join("") || `<div class="empty-state" style="grid-column:1/-1;">No exercises match.</div>`}
      </div>
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
  }

  function addToDraft(exerciseId) {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
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
    navigate("/session/build");
  }

  draw();
}
