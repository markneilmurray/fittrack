import { getCurrentProfile, getData, updateSettings, renameProfile, deleteProfile, exportAllData, importAllData, setCurrentProfileId } from "../store.js";
import { navigate } from "../router.js";
import { icons } from "../components/icons.js";
import { openModal, closeModal, confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { escapeHtml } from "../utils.js";

export function renderMore(main) {
  function draw() {
    const profile = getCurrentProfile();
    const data = getData();
    const theme = localStorage.getItem("fittrack:theme") || "system";

    main.innerHTML = `
      <div class="card section row">
        <div class="profile-avatar" style="--avatar-color:${profile.color}; width:48px; height:48px; font-size:18px;">${profile.name.slice(0, 1).toUpperCase()}</div>
        <div class="spacer">
          <div style="font-weight:800;">${escapeHtml(profile.name)}</div>
          <div class="small muted">Training profile</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="rename-btn">Rename</button>
      </div>
      <div class="row section" style="gap:10px;">
        <button class="btn btn-secondary btn-block" id="switch-btn">Switch profile</button>
        <button class="btn btn-icon" id="delete-profile-btn" title="Delete profile" style="background:var(--danger-tint); color:var(--danger);">${icons.trash}</button>
      </div>

      <div class="section">
        <a href="#/weight" class="list-item card-tap" style="margin-bottom:8px;">
          <div class="list-item-thumb" style="display:flex; align-items:center; justify-content:center; background:var(--primary-tint); color:var(--primary);">${icons.scale}</div>
          <div class="list-item-body"><div class="list-item-title">Body weight</div><div class="list-item-sub">Track your weight over time</div></div>
          ${icons.chevronRight}
        </a>
      </div>

      <div class="section">
        <div class="section-title mb-8">Goals</div>
        <div class="card">
          <div class="field">
            <label>Weekly strength sessions goal</label>
            <input class="input" id="goal-strength" type="number" min="0" value="${data.settings.weeklyStrengthGoal}" />
          </div>
          <div class="field">
            <label>Weekly cardio sessions goal</label>
            <input class="input" id="goal-cardio" type="number" min="0" value="${data.settings.weeklyCardioGoal}" />
          </div>
          <div class="field" style="margin-bottom:0;">
            <label>Daily calorie goal</label>
            <input class="input" id="goal-cal" type="number" min="0" value="${data.settings.calorieGoal}" />
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title mb-8">Units</div>
        <div class="card row" style="gap:8px;">
          <div class="chip ${data.settings.unit === "kg" ? "active" : ""}" data-unit="kg">kg</div>
          <div class="chip ${data.settings.unit === "lb" ? "active" : ""}" data-unit="lb">lb</div>
          <div class="spacer"></div>
          <span class="small faint">Weights already logged won't be converted</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title mb-8">Appearance</div>
        <div class="card row" style="gap:8px;">
          <div class="chip ${theme === "light" ? "active" : ""}" data-theme="light">Light</div>
          <div class="chip ${theme === "dark" ? "active" : ""}" data-theme="dark">Dark</div>
          <div class="chip ${theme === "system" ? "active" : ""}" data-theme="system">System</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title mb-8">Backup</div>
        <div class="card row" style="gap:8px;">
          <button class="btn btn-secondary btn-block" id="export-btn">${icons.download} Export data</button>
          <button class="btn btn-secondary btn-block" id="import-btn">${icons.upload} Import</button>
          <input type="file" accept="application/json" id="import-input" style="display:none;" />
        </div>
        <p class="small faint mt-8">Everything is stored only in this browser. Export regularly if you care about not losing it — clearing browser data will erase it.</p>
      </div>

      <div class="section center">
        <p class="small faint">FitTrack · exercise images &amp; instructions from the free-exercise-db project (public domain).</p>
      </div>
    `;

    document.getElementById("rename-btn").addEventListener("click", () => openRenameModal(profile));
    document.getElementById("switch-btn").addEventListener("click", () => navigate("/profiles"));
    document.getElementById("delete-profile-btn").addEventListener("click", async () => {
      const ok = await confirmDialog(`Delete <strong>${escapeHtml(profile.name)}</strong>? This permanently removes all their data.`);
      if (ok) {
        deleteProfile(profile.id);
        navigate("/profiles");
      }
    });
    document.getElementById("goal-strength").addEventListener("change", (e) => updateSettings({ weeklyStrengthGoal: Number(e.target.value) || 0 }));
    document.getElementById("goal-cardio").addEventListener("change", (e) => updateSettings({ weeklyCardioGoal: Number(e.target.value) || 0 }));
    document.getElementById("goal-cal").addEventListener("change", (e) => updateSettings({ calorieGoal: Number(e.target.value) || 0 }));
    main.querySelectorAll("[data-unit]").forEach((chip) =>
      chip.addEventListener("click", () => {
        updateSettings({ unit: chip.dataset.unit });
        draw();
      })
    );
    main.querySelectorAll("[data-theme]").forEach((chip) =>
      chip.addEventListener("click", () => {
        const t = chip.dataset.theme;
        if (t === "system") {
          localStorage.removeItem("fittrack:theme");
          document.documentElement.removeAttribute("data-theme");
        } else {
          localStorage.setItem("fittrack:theme", t);
          document.documentElement.setAttribute("data-theme", t);
        }
        draw();
      })
    );
    document.getElementById("export-btn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fittrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    });
    const importInput = document.getElementById("import-input");
    document.getElementById("import-btn").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const ok = await confirmDialog("Import this backup? It will replace all current profiles and data in this browser.", { okLabel: "Import" });
        if (ok) {
          importAllData(payload);
          toast("Data imported", { type: "success" });
          navigate("/profiles");
        }
      } catch {
        toast("That file doesn't look like a valid FitTrack backup", { type: "danger" });
      }
    });
  }

  function openRenameModal(profile) {
    const card = openModal(
      `
      <div class="modal-title">Rename profile</div>
      <div class="field"><label>Name</label><input class="input" id="rename-input" value="${escapeHtml(profile.name)}" maxlength="20" /></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" id="rename-save">Save</button>
      </div>
    `,
      { size: "modal-sm" }
    );
    card.querySelector("#rename-save").addEventListener("click", () => {
      const val = card.querySelector("#rename-input").value.trim();
      if (val) {
        renameProfile(profile.id, val);
        closeModal();
        draw();
      }
    });
  }

  draw();
}
