import { route, notFound, startRouter, navigate, getNavToken, isCurrentNav } from "./router.js";
import { renderNav, renderHeader, updateNavActive } from "./components/nav.js";
import { getCurrentProfileId, getCurrentProfile, seedDefaultProfilesIfNeeded } from "./store.js";

const main = document.getElementById("app-main");

// ---- theme ----
const savedTheme = localStorage.getItem("fittrack:theme");
if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);

seedDefaultProfilesIfNeeded();

// Cloud sync is entirely optional and needs the network (Firebase SDK is
// fetched from a CDN) — loaded dynamically so the app still works offline
// or if that fetch fails.
import("./sync.js")
  .then(({ initSync }) => initSync())
  .catch((e) => console.warn("Cloud sync unavailable:", e));

function requireProfile(handler) {
  return async (params) => {
    if (!getCurrentProfileId()) {
      navigate("/profiles");
      return;
    }
    return handler(params);
  };
}

function shell({ nav = true, header = true, title } = {}) {
  document.body.classList.toggle("no-nav", !nav);
  if (header) renderHeader(title);
  document.getElementById("app-header").style.display = header ? "" : "none";
  if (nav) updateNavActive();
}

// The homepage always lives at "/" — opening the app fresh (or tapping the
// FitTrack logo) lands here so whoever picks up the device can choose their
// own profile, rather than silently continuing as whoever used it last.
route("/", () => navigate("/profiles"));

route(
  "/profiles",
  async () => {
    document.body.classList.add("no-nav");
    document.getElementById("app-header").style.display = "none";
    const token = getNavToken();
    const { renderProfiles } = await import("./pages/profiles.js");
    if (!isCurrentNav(token)) return;
    renderProfiles(main);
  }
);

route(
  "/dashboard",
  requireProfile(async () => {
    shell({ title: "FitTrack" });
    const token = getNavToken();
    const { renderDashboard } = await import("./pages/dashboard.js");
    if (!isCurrentNav(token)) return;
    renderDashboard(main);
  })
);

route(
  "/train",
  requireProfile(async () => {
    shell({ title: "Train" });
    const token = getNavToken();
    const { renderTrain } = await import("./pages/train.js");
    if (!isCurrentNav(token)) return;
    renderTrain(main);
  })
);

route(
  "/library",
  requireProfile(async ({ query }) => {
    shell({ title: "Exercise Library" });
    const token = getNavToken();
    const { renderLibrary } = await import("./pages/library.js");
    if (!isCurrentNav(token)) return;
    renderLibrary(main, query);
  })
);

route(
  "/library/:id",
  requireProfile(async ({ id, query }) => {
    shell({ title: "" });
    const token = getNavToken();
    const { renderExerciseDetail } = await import("./pages/exerciseDetail.js");
    if (!isCurrentNav(token)) return;
    renderExerciseDetail(main, id, query);
  })
);

route(
  "/session/build",
  requireProfile(async ({ query }) => {
    shell({ title: "Build Session" });
    const token = getNavToken();
    const { renderSessionBuild } = await import("./pages/sessionBuild.js");
    if (!isCurrentNav(token)) return;
    renderSessionBuild(main, query);
  })
);

route(
  "/session/active",
  requireProfile(async () => {
    shell({ title: "Workout" });
    const token = getNavToken();
    const { renderActiveSession } = await import("./pages/activeSession.js");
    if (!isCurrentNav(token)) return;
    renderActiveSession(main);
  })
);

route(
  "/calendar",
  requireProfile(async () => {
    shell({ title: "Calendar" });
    const token = getNavToken();
    const { renderCalendar } = await import("./pages/calendar.js");
    if (!isCurrentNav(token)) return;
    renderCalendar(main);
  })
);

route(
  "/food",
  requireProfile(async () => {
    shell({ title: "Food Log" });
    const token = getNavToken();
    const { renderFood } = await import("./pages/food.js");
    if (!isCurrentNav(token)) return;
    renderFood(main);
  })
);

route(
  "/weight",
  requireProfile(async () => {
    shell({ title: "Body Weight" });
    const token = getNavToken();
    const { renderWeight } = await import("./pages/weight.js");
    if (!isCurrentNav(token)) return;
    renderWeight(main);
  })
);

route(
  "/more",
  requireProfile(async () => {
    shell({ title: "More" });
    const token = getNavToken();
    const { renderMore } = await import("./pages/more.js");
    if (!isCurrentNav(token)) return;
    renderMore(main);
  })
);

notFound(() => {
  main.innerHTML = `<div class="empty-state"><div class="empty-state-title">Page not found</div><a href="#/dashboard" class="link-btn">Go home</a></div>`;
});

renderNav();
startRouter();

// Register service worker for offline app-shell caching (best effort; ignore failures on file:// etc.)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
