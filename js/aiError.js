// Turns a raw Firebase AI Logic error into a short, user-facing message.
// Shared by every feature that calls Gemini (food estimate/lookup, insights).
export function friendlyAiError(err, fallback) {
  const msg = err.message || "";
  // Checked first — RESOURCE_EXHAUSTED errors still mention the
  // firebasevertexai.googleapis.com request URL in their text, which would
  // otherwise false-match the "not enabled" check below and show a
  // misleading message for what's actually just a hit rate/quota limit.
  if (err.code === "resource-exhausted" || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return "Hit today's free AI usage limit — try again later";
  }
  if (err.code === "api-not-enabled" || /firebasevertexai\.googleapis\.com/.test(msg)) {
    return "AI features aren't turned on yet for this project";
  }
  if (err.code === "AI/permission-denied" || err.code === "permission-denied") {
    return "Not allowed to use AI features right now";
  }
  if (/network/i.test(msg)) {
    return "Couldn't reach the AI — check your connection";
  }
  if (msg && msg.length < 80) return msg;
  return fallback;
}
