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
  await setDoc(profileDocRef(uid), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

export function listenRemoteProfile(uid, callback) {
  return onSnapshot(profileDocRef(uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ---- AI meal-photo calorie estimate (Firebase AI Logic → Gemini) ----
// Uses the Gemini Developer API backend specifically because it has a
// free tier and works on Firebase's free Spark plan — the Vertex AI
// backend would require upgrading to the paid Blaze plan.
let calorieModel = null;
function getCalorieModel() {
  if (!calorieModel) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    calorieModel = getGenerativeModel(ai, {
      // "-latest" alias so this doesn't go stale as Google rotates models
      // (a pinned version, e.g. gemini-2.0-flash, silently loses its free
      // quota once retired — that's what cost a lot of debugging here).
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });
  }
  return calorieModel;
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
  const model = getCalorieModel();
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
