// Turns a raw Firebase AI Logic error into a short, user-facing message.
// Shared by every feature that calls Gemini (food estimate/lookup, insights).
export function friendlyAiError(err, fallback) {
  if (err.code === "api-not-enabled" || /firebasevertexai\.googleapis\.com/.test(err.message || "")) {
    return "AI features aren't turned on yet for this project";
  }
  if (err.code === "AI/permission-denied" || err.code === "permission-denied") {
    return "Not allowed to use AI features right now";
  }
  if (/network/i.test(err.message || "")) {
    return "Couldn't reach the AI — check your connection";
  }
  if (err.message && err.message.length < 80) return err.message;
  return fallback;
}
