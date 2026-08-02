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
let pendingPushProfileId = null;
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
    // Firestore fires this immediately with whatever's currently stored the
    // moment we subscribe — including on every fresh page load — so this
    // can't just trust "it came from the cloud, apply it". Compare against
    // the local data's own persisted updatedAtMs (survives reloads, unlike
    // a plain variable) and only accept the remote copy if it's genuinely
    // newer. Equal timestamps means this is just our own last push echoing
    // back — ignore it rather than re-applying (and don't show a toast for
    // your own change). If local is strictly ahead, the cloud is stale —
    // push to reconcile it instead of silently doing nothing.
    const localUpdatedAt = getData().updatedAtMs || 0;
    const remoteUpdatedAt = remoteData.updatedAtMs || 0;
    if (remoteUpdatedAt <= localUpdatedAt) {
      if (localUpdatedAt > remoteUpdatedAt) schedulePush(getCurrentProfileId());
      return;
    }
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
  pendingPushProfileId = profileId;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => flushPush(profileId), PUSH_DEBOUNCE_MS);
}

async function flushPush(profileId) {
  clearTimeout(pushTimer);
  if (pendingPushProfileId === profileId) pendingPushProfileId = null;
  const info = getProfileCloudInfo(profileId);
  if (!info || !auth.currentUser || auth.currentUser.uid !== info.uid) return;
  try {
    await pushRemoteProfile(info.uid, getData());
    setStatus("synced");
  } catch (e) {
    console.error(e);
    setStatus("error");
    toast("Couldn't sync — check your connection", { type: "danger" });
  }
}

// If the tab/app is being backgrounded or closed while a debounced push is
// still pending, flush it immediately rather than risk losing up to
// PUSH_DEBOUNCE_MS of changes — this is what let a stale cloud copy
// overwrite same-day local entries on next open before this fix.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pendingPushProfileId) {
      flushPush(pendingPushProfileId);
    }
  });
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
