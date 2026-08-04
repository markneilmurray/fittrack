// Device-level app lock: gates the whole app behind Google sign-in the
// first time it's enabled, then Face ID / fingerprint (WebAuthn) on later
// cold starts so re-entry doesn't need a Google popup every time.
//
// Important limit: this is a privacy shield against someone picking up the
// device, not real server-side security — there's no backend here, so
// everything still lives in this browser's local storage regardless of
// whether the lock is on. See README for the recovery path (clearing site
// data resets the lock, same as it resets everything else).

const ENABLED_KEY = "fittrack:appLockEnabled";
const CREDENTIAL_KEY = "fittrack:appLockCredentialId";
const SESSION_KEY = "fittrack:appLockUnlocked";

export function isLockEnabled() {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function setLockEnabled(enabled) {
  if (enabled) localStorage.setItem(ENABLED_KEY, "1");
  else localStorage.removeItem(ENABLED_KEY);
}

// sessionStorage survives ordinary backgrounding/reloads but clears when
// the browser/PWA process is actually terminated — matches "re-lock on
// force-close or restart only" rather than a fixed timeout.
export function isUnlockedThisSession() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function markUnlockedThisSession() {
  sessionStorage.setItem(SESSION_KEY, "1");
}

export function clearUnlockedThisSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasBiometricCredential() {
  return !!localStorage.getItem(CREDENTIAL_KEY);
}

export function clearBiometricCredential() {
  localStorage.removeItem(CREDENTIAL_KEY);
}

function randomBytes(len) {
  return crypto.getRandomValues(new Uint8Array(len));
}

function bufToBase64url(buf) {
  let str = "";
  new Uint8Array(buf).forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const str = atob(b64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

// Registers a platform-authenticator (Face ID / Touch ID / fingerprint)
// credential for this device. There's no server here to verify the
// signature against, so this is used as an "did the OS confirm it's you"
// gate — the browser itself refuses to produce a result unless the actual
// biometric/passcode check passes — rather than a signed remote challenge.
export async function registerBiometricCredential(label) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "FitTrack", id: location.hostname },
      user: { id: randomBytes(16), name: label || "FitTrack", displayName: label || "FitTrack" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  });
  if (!credential) throw new Error("Couldn't register Face ID / fingerprint");
  localStorage.setItem(CREDENTIAL_KEY, bufToBase64url(credential.rawId));
  return true;
}

// Resolves true if the OS confirmed the person's biometric, false if they
// cancelled or it failed.
export async function unlockWithBiometric() {
  const id = localStorage.getItem(CREDENTIAL_KEY);
  if (!id) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ id: base64urlToBuf(id), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
