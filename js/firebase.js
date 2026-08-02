// Thin wrapper around the Firebase modular SDK, loaded straight from
// Google's CDN as ES modules — no build step, no npm install.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
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
