// Firebase web config — safe to be public (it identifies the project, it
// does not grant access on its own). Access control is enforced by
// Firestore security rules + requiring a signed-in Google user.
export const firebaseConfig = {
  apiKey: "AIzaSyCdY2PnB_J2xgKWK-cYHLdNLt-a1SmCz0I",
  authDomain: "maths-minutes.firebaseapp.com",
  databaseURL: "https://maths-minutes-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "maths-minutes",
  storageBucket: "maths-minutes.firebasestorage.app",
  messagingSenderId: "706834197716",
  appId: "1:706834197716:web:4b89b04660ba9f6a0d9f41",
};

// FitTrack's Firestore data lives entirely under this collection name so it
// can share a Firebase project with other apps (like maths-minutes) without
// any risk of colliding with their data.
export const SYNC_COLLECTION = "fittrack_profiles";
