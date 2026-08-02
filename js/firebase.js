// Thin wrapper around the Firebase modular SDK, loaded straight from
// Google's CDN as ES modules — no build step, no npm install.
// (Import specifiers must be literal strings — keep these four in sync by
// hand if the SDK version ever needs bumping.)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import {
  getAI,
  GoogleAIBackend,
  getGenerativeModel,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-ai.js";
import { firebaseConfig, SYNC_COLLECTION } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutGoogle() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

function profileDocRef(uid) {
  return doc(db, SYNC_COLLECTION, uid);
}

export async function fetchRemoteProfile(uid) {
  const snap = await getDoc(profileDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function pushRemoteProfile(uid, data) {
  // data.updatedAtMs is the true "when did this content last change"
  // timestamp from the local store — deliberately NOT overwritten here, so
  // it survives pushes/pulls unchanged and stays comparable across devices
  // and page reloads. pushedAtMs/updatedAt are separate, server-side-ish
  // bookkeeping only (e.g. for a future "last synced" display).
  await setDoc(profileDocRef(uid), {
    ...data,
    updatedAt: serverTimestamp(),
    pushedAtMs: Date.now(),
  });
}

export function listenRemoteProfile(uid, callback) {
  return onSnapshot(profileDocRef(uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ---- Shared Gemini model (Firebase AI Logic) for all JSON-output features ----
// Uses the Gemini Developer API backend specifically because it has a
// free tier and works on Firebase's free Spark plan — the Vertex AI
// backend would require upgrading to the paid Blaze plan.
let jsonModel = null;
function getJsonModel() {
  if (!jsonModel) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    jsonModel = getGenerativeModel(ai, {
      // "-latest" alias so this doesn't go stale as Google rotates models
      // (a pinned version, e.g. gemini-2.0-flash, silently loses its free
      // quota once retired — that's what cost a lot of debugging here).
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });
  }
  return jsonModel;
}

const ESTIMATE_PROMPT = `You estimate calories for a personal food diary from a photo of a meal.
Look at the photo and give your single best-guess estimate — not a range — for a typical portion as shown.
Respond with ONLY JSON, no other text, in exactly this shape:
{"name": "short dish name", "calories": number, "protein": number, "carbs": number, "fat": number}
All macros are in grams, calories in kcal, whole numbers.
If the photo doesn't show identifiable food, respond with exactly: {"error": "no food detected"}`;

// Takes base64 image data (no data: prefix) — never uploaded or stored,
// just sent for this one estimate and discarded by the caller.
export async function estimateMealFromPhoto(base64Data, mimeType) {
  const model = getJsonModel();
  const result = await model.generateContent([ESTIMATE_PROMPT, { inlineData: { mimeType, data: base64Data } }]);
  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Couldn't read the estimate — try a clearer photo");
  }
  if (parsed.error) throw new Error("Couldn't spot food in that photo — try a clearer angle");
  if (typeof parsed.calories !== "number") throw new Error("Got an unexpected response — try again");
  return parsed;
}

const NAME_ESTIMATE_PROMPT = `You estimate calories for a personal food diary from a short food description —
it may be vague or casual (e.g. "a cup of tea with milk", "2 slices of toast with butter", "a bourbon biscuit").
Give your single best-guess estimate for a typical/standard portion — not a range.
Respond with ONLY JSON, no other text, in exactly this shape:
{"calories": number, "protein": number, "carbs": number, "fat": number}
All macros are in grams, calories in kcal, whole numbers.
If the description isn't a recognizable food or drink, respond with exactly: {"error": "not recognized"}
Food: `;

// Looks up an estimate from a plain-text description (e.g. "bourbon biscuit").
export async function estimateMealFromText(query) {
  const model = getJsonModel();
  const result = await model.generateContent(NAME_ESTIMATE_PROMPT + query);
  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Couldn't read the estimate — try rewording it");
  }
  if (parsed.error) throw new Error("Couldn't recognize that — try being more specific");
  if (typeof parsed.calories !== "number") throw new Error("Got an unexpected response — try again");
  return parsed;
}

const INSIGHTS_PROMPT_PREFIX = `You are a supportive fitness & nutrition coach reviewing someone's own logged
data from their personal tracking app, covering the last 7 days plus their recent body weight trend and goal.
Give practical, encouraging, SPECIFIC suggestions grounded in the actual data below — not generic platitudes
that could apply to anyone. In particular, your suggestions MUST include, whenever the data below supports it:
- At least one suggestion that names SPECIFIC foods from the logged list — call out items that are working
  against their calorie/weight goal (e.g. naming a high-calorie item and suggesting a lighter swap or smaller
  portion) and/or foods that were good choices worth repeating. Don't just talk about calorie totals in the
  abstract — use the actual food names.
- At least one suggestion about their strength vs. cardio balance — whether they should shift toward more
  cardio, more strength work, or keep the current split, based on their actual session counts vs. their goals
  and (if trying to lose weight) which mix best supports that.
You are not a doctor: no medical claims, no diagnoses, don't tell them to "consult a doctor" unless something in
the data looks genuinely concerning (e.g. an extremely low calorie intake or a very rapid weight change).

Respond with ONLY JSON, no other text, in exactly this shape:
{"headline": "one short encouraging sentence summarizing where they're at", "suggestions": ["tip 1", "tip 2", "tip 3"]}
Give 3 to 5 suggestions, each a single specific sentence.

DATA:
`;

// summary is a plain-text block built from the person's own logged data
// (see insights.js) — nothing here is saved or sent anywhere beyond this
// one request.
export async function generateWeeklyInsights(summary) {
  const model = getJsonModel();
  const result = await model.generateContent(INSIGHTS_PROMPT_PREFIX + summary);
  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Couldn't generate insights — try again");
  }
  if (!parsed.headline || !Array.isArray(parsed.suggestions) || !parsed.suggestions.length) {
    throw new Error("Got an unexpected response — try again");
  }
  return parsed;
}
