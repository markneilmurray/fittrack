import { icons } from "./icons.js";
import { getCurrentProfile } from "../store.js";

const TABS = [
  { path: "dashboard", label: "Home", icon: icons.home },
  { path: "train", label: "Train", icon: icons.dumbbell },
  { path: "calendar", label: "Calendar", icon: icons.calendar },
  { path: "food", label: "Food", icon: icons.food },
  { path: "coach", label: "Coach", icon: icons.target },
  { path: "more", label: "More", icon: icons.more },
];

export function renderNav() {
  const nav = document.getElementById("app-nav");
  nav.innerHTML = TABS.map(
    (t) => `
    <a href="#/${t.path}" class="nav-tab" data-path="${t.path}">
      <span class="nav-icon">${t.icon}</span>
      <span class="nav-label">${t.label}</span>
    </a>
  `
  ).join("");
  updateNavActive();
}

const PARENT_TAB = {
  library: "train",
  session: "train",
  weight: "more",
  settings: "more",
};

export function updateNavActive() {
  let path = (location.hash.slice(1) || "/").split("/")[1] || "dashboard";
  path = PARENT_TAB[path] || path;
  document.querySelectorAll(".nav-tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.path === path);
  });
}

export function renderHeader(title = "FitTrack") {
  const header = document.getElementById("app-header");
  const profile = getCurrentProfile();
  header.innerHTML = `
    <a href="#/profiles" class="header-title" title="Switch profile">${title}</a>
    ${
      profile
        ? `<a href="#/more" class="header-profile" style="--avatar-color:${profile.color}" title="${profile.name}">
            ${profile.name.slice(0, 1).toUpperCase()}
          </a>`
        : ""
    }
  `;
}
