const routes = [];
let notFoundHandler = () => {};
let currentCleanup = null;

// Route handlers do `await import(...)` before rendering into the shared
// #app-main element. If the hash changes again before that import settles
// (e.g. tapping a nav item twice in quick succession, or once while a
// not-yet-cached page chunk is still loading), the stale handler resolves
// later and renders its page into `main` on top of whatever navigated in
// after it — clobbering the page the user is actually looking at. Handlers
// call isCurrentNav(token) after their await to bail out if that happened.
let navToken = 0;
export function getNavToken() {
  return navToken;
}
export function isCurrentNav(token) {
  return token === navToken;
}

export function route(pattern, handler) {
  // pattern like "/library/:id" -> regex + param names
  const paramNames = [];
  const regexStr =
    "^" +
    pattern
      .replace(/\/:[a-zA-Z]+/g, (m) => {
        paramNames.push(m.slice(2));
        return "/([^/]+)";
      })
      .replace(/\//g, "\\/") +
    "$";
  routes.push({ regex: new RegExp(regexStr), paramNames, handler });
}

export function notFound(handler) {
  notFoundHandler = handler;
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    dispatch();
  } else {
    location.hash = path;
  }
}

function dispatch() {
  navToken++;
  const path = location.hash.slice(1) || "/";
  const [pathname] = path.split("?");
  if (typeof currentCleanup === "function") {
    try {
      currentCleanup();
    } catch (e) {
      console.error(e);
    }
    currentCleanup = null;
  }
  for (const r of routes) {
    const match = pathname.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      const query = Object.fromEntries(new URLSearchParams(path.split("?")[1] || ""));
      const myToken = navToken;
      // Route handlers are async, so calling one always synchronously returns
      // a Promise — awaiting it here (rather than checking the return value
      // directly) is what actually lets a handler register a cleanup function
      // for things like long-lived subscriptions. Still guarded by navToken:
      // if the user has navigated on again by the time this settles, the
      // resolved cleanup belongs to an already-abandoned render and must not
      // overwrite whatever cleanup the newer route already registered.
      //
      // Raced against a timeout because a route handler's `await import(...)`
      // can hang forever rather than reject: on an installed iOS PWA, the OS
      // can suspend an in-flight fetch when the app is backgrounded, and if
      // that fetch never settles, the browser's module registry is left with
      // a permanently-pending entry for that URL — every future `import()`
      // of the same page reuses that same stuck promise, so simply
      // navigating away and back again can't recover it (matches: works,
      // then randomly gets stuck on an old page under an otherwise-correct
      // header, until the app is force-closed and reopened). A full reload
      // is the only thing that actually clears a stuck module registry, so
      // do that automatically once it's clearly hung rather than leaving the
      // screen silently stuck.
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        location.reload();
      }, 15000);
      Promise.resolve(r.handler({ ...params, query })).then((result) => {
        clearTimeout(timeout);
        if (timedOut || navToken !== myToken) return;
        if (typeof result === "function") currentCleanup = result;
      });
      window.scrollTo(0, 0);
      return;
    }
  }
  notFoundHandler();
}

export function startRouter() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}

// Re-renders whatever route is currently showing — used after a background
// sync pulls in remote changes, so the open page reflects them immediately.
export function refreshCurrentRoute() {
  dispatch();
}
