let backdrop = null;

export function openModal(innerHtml, { onMount, size = "" } = {}) {
  closeModal();
  backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal-card ${size}">${innerHtml}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.body.appendChild(backdrop);
  document.body.classList.add("modal-open");
  const card = backdrop.querySelector(".modal-card");
  card.querySelectorAll("[data-close-modal]").forEach((el) => el.addEventListener("click", closeModal));
  if (onMount) onMount(card);
  return card;
}

export function closeModal() {
  if (backdrop) {
    backdrop.remove();
    backdrop = null;
    document.body.classList.remove("modal-open");
  }
}

export function confirmDialog(message, { okLabel = "Delete", danger = true } = {}) {
  return new Promise((resolve) => {
    const card = openModal(
      `
      <p class="modal-message">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancel</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirm-ok">${okLabel}</button>
      </div>
    `,
      { size: "modal-sm" }
    );
    card.querySelector("#confirm-ok").addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
    backdrop.addEventListener(
      "click",
      (e) => {
        if (e.target === backdrop) resolve(false);
      },
      { once: true }
    );
  });
}
