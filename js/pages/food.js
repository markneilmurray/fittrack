import { getData, addFoodEntry, deleteFoodEntry } from "../store.js";
import { compressImage, blobToBase64 } from "../db.js";
import { todayStr, addDays, formatDate, escapeHtml } from "../utils.js";
import { ring } from "../components/charts.js";
import { openModal, closeModal, confirmDialog } from "../components/modal.js";
import { icons } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { friendlyAiError } from "../aiError.js";

export function renderFood(main) {
  let viewDate = todayStr();

  function draw() {
    const data = getData();
    const entries = data.food.filter((f) => f.date === viewDate).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const calGoal = data.settings.calorieGoal || 0;
    const calSum = entries.reduce((s, e) => s + (Number(e.calories) || 0), 0);
    const proteinSum = entries.reduce((s, e) => s + (Number(e.protein) || 0), 0);
    const carbsSum = entries.reduce((s, e) => s + (Number(e.carbs) || 0), 0);
    const fatSum = entries.reduce((s, e) => s + (Number(e.fat) || 0), 0);

    main.innerHTML = `
      <div class="row-between section">
        <button class="btn-icon" id="prev-day">${icons.chevronLeft}</button>
        <div style="font-weight:800;">${viewDate === todayStr() ? "Today" : formatDate(viewDate)}</div>
        <button class="btn-icon" id="next-day" ${viewDate >= todayStr() ? "disabled" : ""}>${icons.chevronRight}</button>
      </div>

      <div class="card section">
        <div class="row" style="gap:18px;">
          ${ring({ value: calSum, max: calGoal || calSum || 1, size: 78, stroke: 9, label: `${calSum}` })}
          <div>
            <div style="font-weight:800; font-size:15px;">${calSum} ${calGoal ? `/ ${calGoal}` : ""} kcal</div>
            <div class="muted small mt-8">P ${proteinSum}g · C ${carbsSum}g · F ${fatSum}g</div>
            ${calGoal && calSum > calGoal ? `<div class="small mt-8" style="color:var(--danger); font-weight:600;">${calSum - calGoal} kcal over goal</div>` : ""}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head"><div class="section-title">Entries</div></div>
        <div class="stack" id="food-list">
          ${
            entries.length
              ? entries
                  .map(
                    (e) => `
              <div class="list-item">
                <div class="list-item-body">
                  <div class="list-item-title">${escapeHtml(e.name)}</div>
                  <div class="list-item-sub">${e.calories || 0} kcal${e.time ? " · " + e.time : ""}</div>
                </div>
                <button class="btn-icon swipe-delete" data-delete="${e.id}">${icons.trash}</button>
              </div>
            `
                  )
                  .join("")
              : `<div class="empty-state">${icons.food}<div class="empty-state-title">Nothing logged</div><p class="small">Add what you ate to keep track of your day.</p></div>`
          }
        </div>
      </div>

      <button class="btn btn-primary btn-block mt-16" id="add-food-btn">${icons.plus} Add food</button>
    `;

    document.getElementById("prev-day").addEventListener("click", () => {
      viewDate = addDays(viewDate, -1);
      draw();
    });
    document.getElementById("next-day").addEventListener("click", () => {
      if (viewDate < todayStr()) {
        viewDate = addDays(viewDate, 1);
        draw();
      }
    });
    document.getElementById("add-food-btn").addEventListener("click", openAddModal);
    main.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const ok = await confirmDialog("Delete this entry?");
        if (ok) {
          deleteFoodEntry(btn.dataset.delete);
          draw();
        }
      })
    );
  }

  function openAddModal() {
    const card = openModal(
      `
      <div class="modal-title">Add food</div>
      <div class="field">
        <label>Food / meal</label>
        <input class="input" id="f-name" placeholder="e.g. Chicken salad, a bourbon biscuit, cup of tea" />
      </div>
      <button type="button" class="btn btn-primary btn-block" id="lookup-btn">${icons.sparkle} Look up calories for this</button>
      <p class="small faint mt-8 mb-12">Uses AI, nothing saved but the numbers. Rough guess — check the fields below.</p>

      <button type="button" class="btn btn-secondary btn-block" id="ai-estimate-btn">${icons.camera} Estimate from a photo instead</button>
      <input type="file" accept="image/*" capture="environment" id="ai-photo-input" style="display:none;" />
      <p class="small faint mt-8 mb-12">Photo is sent once for the estimate and never saved anywhere.</p>

      <div class="input-row">
        <div class="field"><label>Calories</label><input class="input" id="f-cal" type="number" min="0" inputmode="numeric" /></div>
        <div class="field"><label>Time</label><input class="input" id="f-time" type="time" value="${new Date().toTimeString().slice(0, 5)}" /></div>
      </div>
      <div class="input-row">
        <div class="field"><label>Protein (g)</label><input class="input" id="f-protein" type="number" min="0" /></div>
        <div class="field"><label>Carbs (g)</label><input class="input" id="f-carbs" type="number" min="0" /></div>
        <div class="field"><label>Fat (g)</label><input class="input" id="f-fat" type="number" min="0" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" id="save-food">Save</button>
      </div>
    `,
      { onMount: setup }
    );

    function setup(card) {
      const nameInput = card.querySelector("#f-name");

      const lookupBtn = card.querySelector("#lookup-btn");
      const lookupBtnLabel = lookupBtn.innerHTML;
      lookupBtn.addEventListener("click", async () => {
        const query = nameInput.value.trim();
        if (!query) {
          nameInput.focus();
          toast("Type what you ate first");
          return;
        }
        lookupBtn.disabled = true;
        lookupBtn.innerHTML = `${icons.sparkle} Looking up…`;
        try {
          const { estimateMealFromText } = await import("../firebase.js");
          const est = await estimateMealFromText(query);
          card.querySelector("#f-cal").value = est.calories ?? "";
          card.querySelector("#f-protein").value = est.protein ?? "";
          card.querySelector("#f-carbs").value = est.carbs ?? "";
          card.querySelector("#f-fat").value = est.fat ?? "";
          toast("Estimate filled in — check it looks right", { type: "success" });
        } catch (err) {
          console.error(err);
          toast(friendlyAiError(err, "Couldn't look that up — try rewording or enter it manually"), { type: "danger" });
        } finally {
          lookupBtn.disabled = false;
          lookupBtn.innerHTML = lookupBtnLabel;
        }
      });

      const aiBtn = card.querySelector("#ai-estimate-btn");
      const aiInput = card.querySelector("#ai-photo-input");
      const aiBtnLabel = aiBtn.innerHTML;
      aiBtn.addEventListener("click", () => aiInput.click());
      aiInput.addEventListener("change", async () => {
        const file = aiInput.files[0];
        aiInput.value = "";
        if (!file) return;
        aiBtn.disabled = true;
        aiBtn.innerHTML = `${icons.sparkle} Estimating…`;
        try {
          const compressed = await compressImage(file, 800, 0.7);
          const base64 = await blobToBase64(compressed);
          const { estimateMealFromPhoto } = await import("../firebase.js");
          const est = await estimateMealFromPhoto(base64, "image/jpeg");
          nameInput.value = est.name || "";
          card.querySelector("#f-cal").value = est.calories ?? "";
          card.querySelector("#f-protein").value = est.protein ?? "";
          card.querySelector("#f-carbs").value = est.carbs ?? "";
          card.querySelector("#f-fat").value = est.fat ?? "";
          toast("Estimate filled in — check it looks right", { type: "success" });
        } catch (err) {
          console.error(err);
          toast(friendlyAiError(err, "Couldn't estimate that photo — try again or enter it manually"), { type: "danger" });
        } finally {
          aiBtn.disabled = false;
          aiBtn.innerHTML = aiBtnLabel;
        }
      });

      card.querySelector("#save-food").addEventListener("click", async () => {
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.focus();
          return;
        }
        const entry = {
          date: viewDate,
          name,
          calories: card.querySelector("#f-cal").value || 0,
          protein: card.querySelector("#f-protein").value || 0,
          carbs: card.querySelector("#f-carbs").value || 0,
          fat: card.querySelector("#f-fat").value || 0,
          time: card.querySelector("#f-time").value,
        };
        addFoodEntry(entry);
        closeModal();
        draw();
      });
    }
  }

  draw();
}
