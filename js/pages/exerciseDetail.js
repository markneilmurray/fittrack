import { getAllExercises, getData, getLastPerformance, setDraft, isFavorite, toggleFavorite } from "../store.js";
import { navigate } from "../router.js";
import { lineChart } from "../components/charts.js";
import { icons } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { escapeHtml, titleCase, exerciseThumbHtml } from "../utils.js";

export function renderExerciseDetail(main, id) {
  const ex = getAllExercises().find((e) => e.id === id);
  if (!ex) {
    main.innerHTML = `<div class="empty-state">Exercise not found.</div>`;
    return;
  }
  let imgIndex = 0;
  const data = getData();
  const last = getLastPerformance(ex.id);
  const unit = data.settings.unit;

  const history = data.sessions
    .filter((s) => s.exercises.some((e) => e.exerciseId === ex.id))
    .map((s) => {
      const entry = s.exercises.find((e) => e.exerciseId === ex.id);
      if (entry.type === "strength") {
        const weights = (entry.sets || []).map((st) => Number(st.weight)).filter((n) => !isNaN(n) && n > 0);
        if (!weights.length) return null;
        return { x: new Date(s.date).getTime(), y: Math.max(...weights), label: s.date.slice(5) };
      } else {
        if (!entry.durationMin) return null;
        return { x: new Date(s.date).getTime(), y: entry.durationMin, label: s.date.slice(5) };
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);

  function draw() {
    main.innerHTML = `
      <div class="row-between" style="margin-bottom:10px;">
        <button class="btn-icon" id="back-btn">${icons.chevronLeft}</button>
        <div class="row" style="gap:8px;">
          <span class="badge ${ex.category === "cardio" ? "badge-cardio" : "badge-strength"}">${titleCase(ex.category)}</span>
          <button class="btn-icon fav-btn-inline ${isFavorite(ex.id) ? "active" : ""}" id="fav-btn" title="Favourite">${isFavorite(ex.id) ? icons.starFilled : icons.star}</button>
        </div>
      </div>
      <div class="detail-img-wrap">
        ${exerciseThumbHtml({
          images: ex.images.length ? [ex.images[imgIndex] || ex.images[0]] : [],
          className: "detail-img",
          alt: ex.name,
          placeholderIcon: ex.category === "cardio" ? icons.heart : icons.dumbbell,
        })}
        ${
          ex.images.length > 1
            ? `<div class="detail-img-dots">${ex.images.map((_, i) => `<span class="${i === imgIndex ? "active" : ""}" data-dot="${i}"></span>`).join("")}</div>`
            : ""
        }
      </div>
      <h1 class="page-title mt-16">${escapeHtml(ex.name)}</h1>
      <p class="page-subtitle">${ex.groupLabel} · ${titleCase(ex.equipment || "bodyweight")}${ex.level ? " · " + titleCase(ex.level) : ""}</p>

      ${
        last
          ? `<div class="last-time-pill">${icons.flame} Last time: ${
              last.weight != null ? `${last.weight} ${unit} × ${last.reps} reps` : `${last.durationMin} min`
            }</div>`
          : ""
      }

      <div class="section mt-16">
        <div class="section-title mb-8">Muscles worked</div>
        <div>
          ${ex.primaryMuscles.map((m) => `<span class="muscle-tag" style="font-weight:800;">${titleCase(m)}</span>`).join("")}
          ${ex.secondaryMuscles.map((m) => `<span class="muscle-tag">${titleCase(m)}</span>`).join("")}
        </div>
      </div>

      ${
        history.length
          ? `<div class="section">
              <div class="section-title mb-8">${ex.category === "cardio" ? "Duration" : "Weight"} history</div>
              <div class="card">${lineChart(history, { height: 130, unit: ex.category === "cardio" ? "m" : ` ${unit}` })}</div>
            </div>`
          : ""
      }

      <div class="section">
        <div class="section-title mb-8">How to do it</div>
        <ol class="instructions-list">
          ${ex.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </div>

      <button class="btn btn-primary btn-block mt-16" id="add-btn">${icons.plus} Add to today's session</button>
    `;

    document.getElementById("back-btn").addEventListener("click", () => history_back());
    main.querySelectorAll("[data-dot]").forEach((dot) =>
      dot.addEventListener("click", () => {
        imgIndex = Number(dot.dataset.dot);
        draw();
      })
    );
    document.getElementById("add-btn").addEventListener("click", addToDraft);
    document.getElementById("fav-btn").addEventListener("click", () => {
      toggleFavorite(ex.id);
      draw();
    });
  }

  function history_back() {
    if (window.history.length > 1) window.history.back();
    else navigate("/library");
  }

  function addToDraft() {
    let draft = getData().draft;
    if (!draft) {
      draft = { date: new Date().toISOString().slice(0, 10), name: "Custom Session", exercises: [] };
    }
    if (draft.exercises.some((e) => e.exerciseId === ex.id)) {
      toast("Already in today's session");
      return;
    }
    if (ex.category === "cardio") {
      draft.exercises.push({ exerciseId: ex.id, type: "cardio", durationMin: ex.default.durationMin, distanceKm: null });
    } else {
      const setCount = ex.default.sets || 3;
      draft.exercises.push({
        exerciseId: ex.id,
        type: "strength",
        targetReps: ex.default.reps,
        sets: Array.from({ length: setCount }, () => ({ weight: "", reps: "", done: false })),
      });
    }
    setDraft(draft);
    toast("Added to session", { type: "success" });
  }

  draw();
}
