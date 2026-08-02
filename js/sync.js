// Orchestrates linking a local profile to a Google account and keeping its
// data mirrored to Firestore. store.js and the UI know nothing about
// Firebase directly — they call into this module.
import {
  getCurrentProfileId,
  getCurrentProfile,
  getData,
  replaceCurrentProfileData,
  linkProfileToCloud,
  unlinkProfileFromCloud,
  getProfileCloudInfo,
  onDataChange,
} from "./store.js";
import { refreshCurrentRoute } from "./router.js";
import { toast } from "./components/toast.js";
import {
  auth,
  signInWithGoogle,
  signOutGoogle,
  watchAuthState,
  fetchRemoteProfile,
  pushRemoteProfile,
  listenRemoteProfile,
} from "./firebase.js";

const PUSH_DEBOUNCE_MS = 2500;

let unsubscribeSnapshot = null;
let listeningUid = null;
let pushTimer = null;
let lastPushedAtMs = 0;
let statusListeners = [];

// "off" | "linked-elsewhere" | "syncing" | "synced" | "error"
let status = "off";

function setStatus(next) {
  status = next;
  statusListeners.forEach((fn) => fn(status));
}

export function getSyncStatus() {
  return status;
}

export function onSyncStatusChange(fn) {
  statusListeners.push(fn);
  return () => {
    statusListeners = statusListeners.filter((f) => f !== fn);
  };
}

function stopListening() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  listeningUid = null;
}

function startListening(uid) {
  if (listeningUid === uid) return;
  stopListening();
  listeningUid = uid;
  unsubscribeSnapshot = listenRemoteProfile(uid, (remoteData) => {
    // Skip echoes of our own recent push rather than re-applying them.
    if (remoteData.updatedAtMs && remoteData.updatedAtMs <= lastPushedAtMs) return;
    replaceCurrentProfileData(remoteData);
    refreshCurrentRoute();
    toast("Synced changes from another device", { type: "success" });
    setStatus("synced");
  });
}

function schedulePush(profileId) {
  const info = getProfileCloudInfo(profileId);
  if (!info || !auth.currentUser || auth.currentUser.uid !== info.uid) return;
  setStatus("syncing");
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await pushRemoteProfile(info.uid, getData());
      lastPushedAtMs = Date.now();
      setStatus("synced");
    } catch (e) {
      console.error(e);
      setStatus("error");
      toast("Couldn't sync — check your connection", { type: "danger" });
    }
  }, PUSH_DEBOUNCE_MS);
}

// Re-checks whether the currently active local profile should be syncing,
// given whatever Google account (if any) is currently signed in. Call this
// after switching profiles and whenever the Firebase auth state changes.
export function evaluateSyncForCurrentProfile() {
  const profileId = getCurrentProfileId();
  if (!profileId) {
    stopListening();
    setStatus("off");
    return;
  }
  const info = getProfileCloudInfo(profileId);
  if (!info) {
    stopListening();
    setStatus("off");
    return;
  }
  if (!auth.currentUser || auth.currentUser.uid !== info.uid) {
    // Linked, but that Google account isn't the one currently signed in on
    // this device/browser (e.g. this is Hannah's profile but Mark's Google
    // session is active) — don't sync until they sign back in themselves.
    stopListening();
    setStatus("linked-elsewhere");
    return;
  }
  startListening(info.uid);
  setStatus("synced");
}

// Kicks off Google sign-in for the current profile. Returns either
// { status: "linked" } once done, or { status: "conflict", ... } if this
// Google account already has cloud data — the caller (UI) then asks the
// user which version to keep and calls resolveConflict().
export async function startLinkCurrentProfile() {
  const result = await signInWithGoogle();
  const user = result.user;
  const remote = await fetchRemoteProfile(user.uid);
  if (remote) {
    return { status: "conflict", uid: user.uid, email: user.email, remote };
  }
  linkProfileToCloud(getCurrentProfileId(), user.uid, user.email);
  await pushRemoteProfile(user.uid, getData());
  lastPushedAtMs = Date.now();
  startListening(user.uid);
  setStatus("synced");
  return { status: "linked", email: user.email };
}

export async function resolveLinkConflict(choice, { uid, email, remote }) {
  linkProfileToCloud(getCurrentProfileId(), uid, email);
  if (choice === "cloud") {
    replaceCurrentProfileData(remote);
    refreshCurrentRoute();
  } else {
    await pushRemoteProfile(uid, getData());
    lastPushedAtMs = Date.now();
  }
  startListening(uid);
  setStatus("synced");
}

export async function unlinkCurrentProfile() {
  const profileId = getCurrentProfileId();
  unlinkProfileFromCloud(profileId);
  stopListening();
  setStatus("off");
}

export function signOutOfGoogle() {
  return signOutGoogle();
}

export function initSync() {
  onDataChange((profileId) => schedulePush(profileId));
  watchAuthState(() => evaluateSyncForCurrentProfile());
}
