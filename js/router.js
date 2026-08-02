const routes = [];
let notFoundHandler = () => {};
let currentCleanup = null;

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
