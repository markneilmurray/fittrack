import { route, notFound, startRouter, navigate } from "./router.js";
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
    const { renderProfiles } = await import("./pages/profiles.js");
    renderProfiles(main);
  }
);

route(
  "/dashboard",
  requireProfile(async () => {
    shell({ title: "FitTrack" });
    const { renderDashboard } = await import("./pages/dashboard.js");
    renderDashboard(main);
  })
);

route(
  "/train",
  requireProfile(async () => {
    shell({ title: "Train" });
    const { renderTrain } = await import("./pages/train.js");
    renderTrain(main);
  })
);

route(
  "/library",
  requireProfile(async ({ query }) => {
    shell({ title: "Exercise Library" });
    const { renderLibrary } = await import("./pages/library.js");
    renderLibrary(main, query);
  })
);

route(
  "/library/:id",
  requireProfile(async ({ id, query }) => {
    shell({ title: "" });
    const { renderExerciseDetail } = await import("./pages/exerciseDetail.js");
    renderExerciseDetail(main, id, query);
  })
);

route(
  "/session/build",
  requireProfile(async ({ query }) => {
    shell({ title: "Build Session" });
    const { renderSessionBuild } = await import("./pages/sessionBuild.js");
    renderSessionBuild(main, query);
  })
);

route(
  "/session/active",
  requireProfile(async () => {
    shell({ title: "Workout" });
    const { renderActiveSession } = await import("./pages/activeSession.js");
    renderActiveSession(main);
  })
);

route(
  "/calendar",
  requireProfile(async () => {
    shell({ title: "Calendar" });
    const { renderCalendar } = await import("./pages/calendar.js");
    renderCalendar(main);
  })
);

route(
  "/food",
  requireProfile(async () => {
    shell({ title: "Food Log" });
    const { renderFood } = await import("./pages/food.js");
    renderFood(main);
  })
);

route(
  "/weight",
  requireProfile(async () => {
    shell({ title: "Body Weight" });
    const { renderWeight } = await import("./pages/weight.js");
    renderWeight(main);
  })
);

route(
  "/more",
  requireProfile(async () => {
    shell({ title: "More" });
    const { renderMore } = await import("./pages/more.js");
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
