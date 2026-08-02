import { getData, addBodyWeight, deleteBodyWeight, updateSettings } from "../store.js";
import { todayStr, formatDate } from "../utils.js";
import { lineChart } from "../components/charts.js";
import { openModal, closeModal, confirmDialog } from "../components/modal.js";
import { icons } from "../components/icons.js";
import { toast } from "../components/toast.js";

export function renderWeight(main) {
  function draw() {
    const data = getData();
    const unit = data.settings.unit;
    const entries = [...data.bodyWeight].sort((a, b) => a.date.localeCompare(b.date));
    const points = entries.map((e) => ({ x: new Date(e.date).getTime(), y: e.weight, label: e.date.slice(5) }));
    const latest = entries[entries.length - 1];
    const prev = entries[entries.length - 2];
    const delta = latest && prev ? Math.round((latest.weight - prev.weight) * 10) / 10 : null;

    main.innerHTML = `
      <div class="section card">
        <div class="row-between mb-8">
          <div>
            <div style="font-size:26px; font-weight:800;">${latest ? `${latest.weight} ${unit}` : "—"}</div>
            ${delta != null ? `<div class="small ${delta <= 0 ? "" : ""}" style="color:${delta < 0 ? "var(--success)" : delta > 0 ? "var(--warning)" : "var(--text-muted)"}; font-weight:700;">${delta > 0 ? "+" : ""}${delta} ${unit} vs last entry</div>` : `<div class="small muted">Log your first weigh-in</div>`}
          </div>
          <button class="btn-icon" id="goal-btn" title="Set goal weight">${icons.edit}</button>
        </div>
        ${lineChart(points, { height: 160, unit, goal: data.settings.goalBodyWeight })}
        ${data.settings.goalBodyWeight ? `<div class="small muted mt-8">Goal: ${data.settings.goalBodyWeight} ${unit}</div>` : ""}
      </div>

      <button class="btn btn-primary btn-block section" id="add-weight-btn">${icons.plus} Log weight</button>

      <div class="section">
        <div class="section-title mb-8">History</div>
        <div class="stack">
          ${
            entries.length
              ? [...entries]
                  .reverse()
                  .map(
                    (e) => `
              <div class="list-item">
                <div class="list-item-body">
                  <div class="list-item-title">${e.weight} ${unit}</div>
                  <div class="list-item-sub">${formatDate(e.date)}</div>
                </div>
                <button class="btn-icon swipe-delete" data-delete="${e.id}">${icons.trash}</button>
              </div>
            `
                  )
                  .join("")
              : `<div class="empty-state">${icons.scale}<div class="empty-state-title">No entries yet</div></div>`
          }
        </div>
      </div>
    `;

    document.getElementById("add-weight-btn").addEventListener("click", openAddModal);
    document.getElementById("goal-btn").addEventListener("click", openGoalModal);
    main.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const ok = await confirmDialog("Delete this weigh-in?");
        if (ok) {
          deleteBodyWeight(btn.dataset.delete);
          draw();
        }
      })
    );
  }

  function openAddModal() {
    const data = getData();
    const card = openModal(
      `
      <div class="modal-title">Log weight</div>
      <div class="input-row">
        <div class="field"><label>Date</label><input class="input" id="w-date" type="date" value="${todayStr()}" max="${todayStr()}" /></div>
        <div class="field"><label>Weight (${data.settings.unit})</label><input class="input" id="w-weight" type="number" step="0.1" min="0" inputmode="decimal" autofocus /></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" id="save-weight">Save</button>
      </div>
    `,
      { size: "modal-sm" }
    );
    card.querySelector("#save-weight").addEventListener("click", () => {
      const weight = Number(card.querySelector("#w-weight").value);
      const date = card.querySelector("#w-date").value || todayStr();
      if (!weight) {
        card.querySelector("#w-weight").focus();
        return;
      }
      addBodyWeight({ date, weight });
      closeModal();
      toast("Weight logged", { type: "success" });
      draw();
    });
  }

  function openGoalModal() {
    const data = getData();
    const card = openModal(
      `
      <div class="modal-title">Goal weight</div>
      <div class="field">
        <label>Target weight (${data.settings.unit}) — leave blank to remove</label>
        <input class="input" id="goal-weight" type="number" step="0.1" min="0" value="${data.settings.goalBodyWeight ?? ""}" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" id="save-goal">Save</button>
      </div>
    `,
      { size: "modal-sm" }
    );
    card.querySelector("#save-goal").addEventListener("click", () => {
      const val = card.querySelector("#goal-weight").value;
      updateSettings({ goalBodyWeight: val === "" ? null : Number(val) });
      closeModal();
      draw();
    });
  }

  draw();
}
