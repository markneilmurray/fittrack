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
      const result = r.handler({ ...params, query });
      if (typeof result === "function") currentCleanup = result;
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
