import { getCurrentProfile, getData, updateSettings, renameProfile, deleteProfile, exportAllData, importAllData, setCurrentProfileId } from "../store.js";
import { navigate } from "../router.js";
import { icons } from "../components/icons.js";
import { openModal, closeModal, confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { escapeHtml } from "../utils.js";

const STATUS_LABEL = {
  off: "Not linked",
  "linked-elsewhere": "Signed into a different Google account",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Sync error — will retry",
};

export function renderMore(main) {
  let syncMod = null;
  let unsubscribeStatus = null;
  // Set once the user has navigated away from this page — guards both the
  // async sync.js import below and the onSyncStatusChange subscription it
  // registers, neither of which the router can cancel on its own. Without
  // this, a sync status change firing after leaving More would still run
  // this closure's draw() and overwrite whatever page is now showing with
  // More's markup (nav/title would stay correct since those are only set by
  // the router, making it look like the wrong page under the right tab).
  let cancelled = false;

  import("../sync.js")
    .then((m) => {
      if (cancelled) return;
      syncMod = m;
      unsubscribeStatus = m.onSyncStatusChange(() => {
        if (!cancelled) draw();
      });
      draw();
    })
    .catch(() => {
      if (!cancelled) draw();
    });

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
        <div class="section-title mb-8">Cloud sync</div>
        <div class="card">
          ${cloudSyncBody(profile, syncMod)}
        </div>
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
        <div class="section-title mb-8">Water</div>
        <div class="card">
          <div class="field" style="margin-bottom:0;">
            <label>Daily water goal</label>
            <div class="input-row">
              <input class="input" id="goal-water-litres" type="number" min="0.25" step="0.25" value="${Math.round((data.settings.waterGoalDrops || 8) * 0.25 * 100) / 100}" />
              <span class="input" style="flex:0 0 auto; width:44px; text-align:center; background:var(--surface); pointer-events:none;">L</span>
            </div>
            <p class="small faint mt-8" style="margin-bottom:0;">= <span id="goal-water-drops">${data.settings.waterGoalDrops || 8}</span> drops of 250ml each. 2-2.5L is a commonly recommended range.</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title mb-8">Fruit &amp; veg</div>
        <div class="card">
          <div class="field" style="margin-bottom:0;">
            <label>Daily fruit &amp; veg goal</label>
            <input class="input" id="goal-fruitveg" type="number" min="5" step="1" value="${data.settings.fruitVegGoal || 5}" />
            <p class="small faint mt-8" style="margin-bottom:0;">At least 5 portions a day is a commonly recommended minimum.</p>
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
    wireCloudSyncButtons(profile);
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
    const goalWaterLitresInput = document.getElementById("goal-water-litres");
    const goalWaterDropsLabel = document.getElementById("goal-water-drops");
    function litresToDrops(litres) {
      return Math.max(1, Math.round((Number(litres) || 0) / 0.25));
    }
    goalWaterLitresInput.addEventListener("input", (e) => {
      goalWaterDropsLabel.textContent = litresToDrops(e.target.value);
    });
    goalWaterLitresInput.addEventListener("change", (e) => {
      updateSettings({ waterGoalDrops: litresToDrops(e.target.value) });
    });
    document.getElementById("goal-fruitveg").addEventListener("change", (e) => {
      const val = Math.max(5, Number(e.target.value) || 5);
      e.target.value = val;
      updateSettings({ fruitVegGoal: val });
    });
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

  function cloudSyncBody(profile, mod) {
    if (!mod) {
      return `<p class="small muted">Loading…</p>`;
    }
    if (!profile.cloudUid) {
      return `
        <p class="small muted mb-12">Back up ${escapeHtml(profile.name)}'s data and sync it across devices with a Google account.</p>
        <button class="btn btn-secondary btn-block" id="link-google-btn">${icons.upload} Sign in with Google</button>
      `;
    }
    const status = mod.getSyncStatus();
    const statusColor =
      status === "synced" ? "var(--success)" : status === "error" ? "var(--danger)" : status === "syncing" ? "var(--primary)" : "var(--text-muted)";
    return `
      <div class="row-between mb-8">
        <div>
          <div style="font-weight:700; color:${statusColor};">${STATUS_LABEL[status] || status}</div>
          <div class="small muted">${escapeHtml(profile.cloudEmail || "")}</div>
        </div>
      </div>
      ${
        status === "linked-elsewhere"
          ? `<button class="btn btn-secondary btn-block mb-8" id="link-google-btn">${icons.upload} Sign in with Google</button>`
          : ""
      }
      <div class="row" style="gap:8px;">
        <button class="btn btn-secondary btn-block" id="signout-google-btn">Sign out of Google</button>
        <button class="btn btn-ghost" id="unlink-btn">Unlink</button>
      </div>
    `;
  }

  function wireCloudSyncButtons(profile) {
    document.getElementById("link-google-btn")?.addEventListener("click", async (e) => {
      if (!syncMod) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Opening Google sign-in…";
      try {
        const result = await syncMod.startLinkCurrentProfile();
        if (result.status === "conflict") {
          openConflictModal(result);
        } else {
          toast(`Synced as ${result.email}`, { type: "success" });
          draw();
        }
      } catch (err) {
        console.error(err);
        if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
          toast("Couldn't sign in with Google", { type: "danger" });
        }
        draw();
      }
    });
    document.getElementById("signout-google-btn")?.addEventListener("click", async () => {
      if (!syncMod) return;
      await syncMod.signOutOfGoogle();
      toast("Signed out of Google");
      draw();
    });
    document.getElementById("unlink-btn")?.addEventListener("click", async () => {
      const ok = await confirmDialog(
        "Stop syncing this profile? Your data stays on this device, but won't back up or sync until you link it again.",
        { okLabel: "Unlink", danger: false }
      );
      if (ok && syncMod) {
        await syncMod.unlinkCurrentProfile();
        draw();
      }
    });
  }

  function openConflictModal({ uid, email, remote }) {
    const card = openModal(
      `
      <div class="modal-title">Existing cloud data found</div>
      <p class="modal-message">Signed in as <strong>${escapeHtml(email)}</strong>, which already has data synced from another device. Which version do you want to keep?</p>
      <div class="stack">
        <button class="btn btn-primary btn-block" id="use-cloud-btn">Use the cloud version</button>
        <button class="btn btn-secondary btn-block" id="use-local-btn">Keep this device's version</button>
        <button class="btn btn-ghost btn-block" data-close-modal>Cancel</button>
      </div>
    `
    );
    card.querySelector("#use-cloud-btn").addEventListener("click", async () => {
      closeModal();
      await syncMod.resolveLinkConflict("cloud", { uid, email, remote });
      toast("Cloud data restored to this device", { type: "success" });
      draw();
    });
    card.querySelector("#use-local-btn").addEventListener("click", async () => {
      closeModal();
      await syncMod.resolveLinkConflict("local", { uid, email, remote });
      toast("This device is now the synced version", { type: "success" });
      draw();
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

  return () => {
    cancelled = true;
    if (unsubscribeStatus) unsubscribeStatus();
  };
}
