import { listProfiles, createProfile, deleteProfile, setCurrentProfileId } from "../store.js";
import { navigate } from "../router.js";
import { openModal, closeModal, confirmDialog } from "../components/modal.js";
import { icons } from "../components/icons.js";
import { escapeHtml } from "../utils.js";

function syncCurrentProfile() {
  import("../sync.js")
    .then(({ evaluateSyncForCurrentProfile }) => evaluateSyncForCurrentProfile())
    .catch(() => {});
}

export function renderProfiles(main) {
  let editMode = false;

  function draw() {
    const profiles = listProfiles();
    main.innerHTML = `
      <div class="center" style="padding-top: 10vh;">
        <div style="font-size:44px;">🏋️</div>
        <h1 class="page-title" style="margin-top:10px; font-size:30px;">FitTrack</h1>
        <p class="muted" style="margin-top:2px;">Strength &amp; cardio, all in one place</p>
        <p class="page-subtitle mt-16">Who's training today?</p>
      </div>
      <div class="profile-grid" id="profile-grid">
        ${profiles
          .map(
            (p) => `
          <div class="profile-card" data-id="${p.id}">
            <div style="position:relative;">
              <div class="profile-avatar card-tap" style="--avatar-color:${p.color}" data-select="${p.id}">${escapeHtml(
                p.name.slice(0, 1).toUpperCase()
              )}</div>
              ${editMode ? `<button class="btn-icon" data-delete="${p.id}" style="position:absolute;top:-6px;right:-6px;width:26px;height:26px;background:var(--danger);color:#fff;">${icons.x}</button>` : ""}
            </div>
            <div class="profile-name">${escapeHtml(p.name)}</div>
          </div>
        `
          )
          .join("")}
        <div class="profile-card">
          <div class="profile-add card-tap" id="add-profile">${icons.plus}</div>
          <div class="profile-name">Add</div>
        </div>
      </div>
      ${
        profiles.length
          ? `<div class="center mt-24"><button class="link-btn" id="toggle-edit">${editMode ? "Done" : "Manage profiles"}</button></div>`
          : `<p class="center faint small mt-16">Everyone shares this device but keeps their own workouts, food log and weight history.</p>`
      }
    `;

    main.querySelectorAll("[data-select]").forEach((el) =>
      el.addEventListener("click", () => {
        setCurrentProfileId(el.dataset.select);
        syncCurrentProfile();
        navigate("/dashboard");
      })
    );
    main.querySelectorAll("[data-delete]").forEach((el) =>
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = el.dataset.delete;
        const p = profiles.find((x) => x.id === id);
        const ok = await confirmDialog(
          `Delete <strong>${escapeHtml(p.name)}</strong>? This permanently removes their workouts, food log, and weight history.`
        );
        if (ok) {
          deleteProfile(id);
          draw();
        }
      })
    );
    const toggleBtn = document.getElementById("toggle-edit");
    if (toggleBtn) toggleBtn.addEventListener("click", () => { editMode = !editMode; draw(); });
    document.getElementById("add-profile").addEventListener("click", openAddModal);
  }

  function openAddModal() {
    const card = openModal(
      `
      <div class="modal-title">New profile</div>
      <div class="field">
        <label>Name</label>
        <input class="input" id="new-name" placeholder="e.g. Alex" maxlength="20" autofocus />
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn btn-primary" id="create-btn">Create</button>
      </div>
    `,
      { size: "modal-sm" }
    );
    const input = card.querySelector("#new-name");
    const submit = () => {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      const profile = createProfile(name);
      closeModal();
      setCurrentProfileId(profile.id);
      syncCurrentProfile();
      navigate("/dashboard");
    };
    card.querySelector("#create-btn").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    setTimeout(() => input.focus(), 50);
  }

  draw();
}
