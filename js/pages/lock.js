import { signInWithGoogle, watchAuthState } from "../firebase.js";
import { markUnlockedThisSession, isBiometricAvailable, hasBiometricCredential, registerBiometricCredential, unlockWithBiometric } from "../lock.js";
import { icons } from "../components/icons.js";
import { toast } from "../components/toast.js";
import { escapeHtml } from "../utils.js";

// Full-screen gate rendered before any route/profile is reachable. Calls
// onUnlocked() once the person has actually confirmed it's them.
export function renderLock(main, onUnlocked) {
  main.innerHTML = `<div class="section center" style="padding-top:80px;"><p class="small muted">Loading…</p></div>`;

  const unsubscribe = watchAuthState(async (user) => {
    unsubscribe();
    if (!user) {
      drawSignIn();
    } else if (hasBiometricCredential()) {
      drawBiometric(user);
    } else {
      drawSignedInFallback(user);
    }
  });

  function drawSignIn(errorMsg) {
    main.innerHTML = `
      <div class="section center" style="padding-top:60px; max-width:340px; margin:0 auto;">
        <div style="font-size:40px; margin-bottom:12px;">🏋️</div>
        <h1 style="font-size:22px; font-weight:800; margin-bottom:6px;">FitTrack is locked</h1>
        <p class="small muted mb-16">Sign in with Google to unlock your profiles.</p>
        ${errorMsg ? `<p class="small" style="color:var(--danger); margin-bottom:12px;">${escapeHtml(errorMsg)}</p>` : ""}
        <button class="btn btn-primary btn-block" id="lock-signin-btn">${icons.upload} Sign in with Google</button>
        <p class="small faint mt-16">Everything still stays on this device — signing in just confirms it's you before showing your data.</p>
      </div>
    `;
    document.getElementById("lock-signin-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Opening Google sign-in…";
      try {
        const result = await signInWithGoogle();
        const bioAvailable = await isBiometricAvailable();
        if (bioAvailable && !hasBiometricCredential()) {
          drawOfferBiometric(result.user);
        } else {
          finish();
        }
      } catch (err) {
        console.error(err);
        if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
          drawSignIn();
        } else {
          drawSignIn("Couldn't sign in — try again.");
        }
      }
    });
  }

  function drawOfferBiometric(user) {
    main.innerHTML = `
      <div class="section center" style="padding-top:60px; max-width:340px; margin:0 auto;">
        <h1 style="font-size:20px; font-weight:800; margin-bottom:6px;">Signed in as ${escapeHtml(user.email || user.displayName || "")}</h1>
        <p class="small muted mb-16">Enable Face ID / fingerprint so you don't need to sign in with Google every time you reopen FitTrack?</p>
        <button class="btn btn-primary btn-block" id="enable-bio-btn">Enable Face ID / fingerprint</button>
        <button class="btn btn-ghost btn-block mt-8" id="skip-bio-btn">Not now</button>
      </div>
    `;
    document.getElementById("enable-bio-btn").addEventListener("click", async () => {
      try {
        await registerBiometricCredential(user.email || user.displayName);
        toast("Face ID / fingerprint enabled", { type: "success" });
      } catch (err) {
        console.error(err);
        toast("Couldn't set that up — you can try again later in More", { type: "danger" });
      }
      finish();
    });
    document.getElementById("skip-bio-btn").addEventListener("click", finish);
  }

  function drawBiometric(user) {
    main.innerHTML = `
      <div class="section center" style="padding-top:60px; max-width:340px; margin:0 auto;">
        <h1 style="font-size:20px; font-weight:800; margin-bottom:6px;">Welcome back</h1>
        <p class="small muted mb-16">${escapeHtml(user.email || "")}</p>
        <button class="btn btn-primary btn-block" id="bio-unlock-btn">Unlock with Face ID / fingerprint</button>
        <button class="link-btn mt-16" id="bio-fallback-btn" style="font-size:13px;">Use Google sign-in instead</button>
      </div>
    `;
    document.getElementById("bio-unlock-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const ok = await unlockWithBiometric();
      if (ok) {
        finish();
      } else {
        btn.disabled = false;
        toast("Couldn't verify — try again or use Google sign-in", { type: "danger" });
      }
    });
    document.getElementById("bio-fallback-btn").addEventListener("click", () => drawSignIn());
  }

  function drawSignedInFallback(user) {
    // Already have a Firebase session but no biometric registered on this
    // device (unsupported, or skipped earlier) — still require an explicit
    // interactive re-confirmation. A persisted session alone isn't a real
    // gate: it's exactly what anyone holding the device already has.
    main.innerHTML = `
      <div class="section center" style="padding-top:60px; max-width:340px; margin:0 auto;">
        <h1 style="font-size:20px; font-weight:800; margin-bottom:6px;">Welcome back</h1>
        <p class="small muted mb-16">${escapeHtml(user.email || "")}</p>
        <button class="btn btn-primary btn-block" id="lock-signin-btn">${icons.upload} Confirm with Google</button>
      </div>
    `;
    document.getElementById("lock-signin-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await signInWithGoogle();
        finish();
      } catch (err) {
        console.error(err);
        btn.disabled = false;
      }
    });
  }

  function finish() {
    markUnlockedThisSession();
    onUnlocked();
  }
}
