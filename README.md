# FitTrack

A personal fitness app that runs entirely in your browser — plan and log strength & cardio workouts, track body weight, and log food. Works fully offline with no backend and no build step; optionally backs up and syncs to your own Firebase project if you want your data to follow you across devices.

## Features

- **Exercise library** — 75 exercises across chest, back, shoulders, arms, legs, core and cardio, each with a real photo, step-by-step instructions and target muscles (sourced from the public-domain [free-exercise-db](https://github.com/yuhonas/free-exercise-db) project). Star any exercise to favourite it.
- **Session builder** — start from a Push/Pull/Legs/Upper/Lower/Full Body/Core/Cardio template or build a custom session, with sensible default sets & reps you can adjust. Edit a template's exercises once and it's remembered as the new default for next time — a "reset to default" link is always there if you want the original back.
- **Workout logging** — log weight and reps per set, with the weight/duration you did **last time** shown as a reminder so you know what to beat.
- **Strength/cardio balance** — the home screen tracks your weekly strength vs. cardio session count against your goals and nudges you if things are lopsided.
- **Calendar check-off** — tap any day to mark it a workout day or a rest day, see your streak and monthly totals.
- **Body weight tracking** — log weigh-ins, see a trend chart, set a goal weight.
- **Food log** — log meals with calories and macros against a daily goal. Type what you ate and tap **"Look up calories for this"** for an AI estimate (handles casual descriptions like "a bourbon biscuit" or "cup of tea with milk"), or tap **"Estimate from a photo"** to do the same from a picture instead — the photo is sent once for the estimate and never saved anywhere. You can also attach a photo purely as your own visual reference (kept on-device, no AI involved). See **AI meal estimate** below.
- **Weekly insights** — on the home screen, "Get this week's insights" turns your last 7 days of food and training plus your body weight trend into a short, specific set of AI suggestions — including a rough weeks-to-goal estimate if you've set a goal weight.
- **Multiple profiles** — anyone using this device/browser can create their own profile; everyone's workouts, food log and weight history stay separate.
- **Optional cloud sync** — link a profile to a Google account (via your own Firebase project) to back it up and keep it in sync across devices. Entirely opt-in — the app works fully offline without it.
- **Works offline** — installable as a PWA ("Add to Home Screen"), and exercises you've already viewed keep working without a connection.

## Running it locally

This is a plain HTML/CSS/JavaScript app (ES modules, no framework, no build step). Any static file server works:

```bash
python3 -m http.server 8420
```

Then open `http://localhost:8420`. That's it — no `npm install`.

## Deploying to GitHub Pages

1. Create a new repository on GitHub and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick the **main** branch and **/ (root)** folder, then save.
4. GitHub will give you a URL like `https://<your-username>.github.io/<your-repo>/` within a minute or two. Open it on your phone and use "Add to Home Screen" for an app-like icon.

No GitHub Actions or build pipeline needed — it's just static files.

## Cloud sync (optional)

By default everything lives only in the browser (see below). If you'd like a profile's data to survive a lost phone or follow you to a second device, you can link it to a Google account:

1. Go to **More → Cloud sync → Sign in with Google** from within that profile.
2. First time signing in with that Google account, it pushes this device's data up. Signing in again later (e.g. on a second device) offers a choice: use the cloud version, or keep this device's version.
3. From then on, changes sync automatically in the background (a few seconds after you stop making them), and updates made on another device appear here live.

This app is wired up to a Firebase project already (see `js/firebaseConfig.js`). If you fork this and want your **own** Firebase project instead:

1. In the [Firebase console](https://console.firebase.google.com), create a project (free Spark plan), then **Project settings → Your apps → add a web app** to get a `firebaseConfig` object. Paste it into `js/firebaseConfig.js`.
2. **Authentication → Sign-in method** → enable **Google**.
3. **Firestore Database** → create a database.
4. **Firestore → Rules** → publish:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /fittrack_profiles/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. **Authentication → Settings → Authorized domains** → add the domain you deploy to (e.g. `yourname.github.io`) — `localhost` is allowed by default, so local testing works without this step.

If a profile is never linked, none of this is used — the app doesn't touch the network for anything except loading exercise photos and (if linked) syncing.

## AI meal estimate (optional)

In the "Add food" form, two options send a description to Gemini (via [Firebase AI Logic](https://firebase.google.com/docs/ai-logic)) and fill in a calorie/macro guess:
- **"Look up calories for this"** — uses whatever's typed in the Food/meal field (e.g. "a bourbon biscuit", "cup of tea with milk").
- **"Estimate from a photo"** — same idea from a picture instead. The photo is only ever sent for that one request — it's never uploaded to Firestore or saved anywhere, and it's discarded as soon as the estimate comes back.

Either way it's a rough guess (no model can know your exact portion or recipe), so always glance over the filled-in numbers before saving.

This needs one more one-time step in the Firebase console (separate from Cloud sync above, and only needed once):

1. [Firebase console](https://console.firebase.google.com) → your project → **AI Logic** (may be listed under "AI services" or similar, depending on the console's current layout) → **Get started**.
2. When asked which API to use, choose **Gemini Developer API** — not "Vertex AI Gemini API". This matters: the Developer API has a free tier and works on the free Spark plan; Vertex AI requires upgrading to the paid Blaze plan for the same thing.
3. Follow the prompts to enable it (Firebase handles provisioning the API access itself — no key to copy into this code).

No further code changes needed — `js/firebase.js` already calls it via `GoogleAIBackend`, using the `gemini-flash-latest` model alias (deliberately not a pinned version like `gemini-2.0-flash` — see troubleshooting below for why).

**Cost:** the Gemini Developer API's free tier comfortably covers casual personal use (a handful of photos a day). Past that, it's fractions of a cent per image.

**Troubleshooting "no quota" errors:** if calls fail with a quota error showing `limit: 0` even after enabling AI Logic, in order of likelihood:
1. **Wait longer.** Enabling the API and provisioning its free-tier quota are separate steps on Google's end; the second can lag behind the first.
2. **Check the project was actually imported into [Google AI Studio](https://aistudio.google.com/apikey)** (API Keys → Import projects) — this is where the free-tier grant is actually issued; Firebase's own "Get started" flow doesn't always complete this.
3. **Check the model hasn't been retired.** A `limit: 0` error is also what you get for a deprecated/retired model (e.g. `gemini-2.0-flash` and `gemini-1.5-flash` both eventually return this rather than a clearer "model retired" message) — this was the actual cause the one time this was debugged. Using the `-latest` alias (as this code does) avoids the problem recurring, since it always points at whichever model Google currently recommends.

## Weekly insights (optional)

The **"Get this week's insights"** card on the home screen computes plain stats from your own logged data — no AI involved for this part, so it's always accurate and free:
- Average daily calories/protein on days you actually logged food (not silently penalized for days you forgot to log).
- Strength/cardio session counts this week vs. your goals.
- Body weight trend (kg or lb per week) from your last ~4 weeks of weigh-ins.
- If you've set a goal weight (Body weight → the pencil icon next to your latest entry): distance to it, and — only if your current trend is actually moving toward it — a rough weeks-to-goal estimate.

Those stats are then handed to Gemini (same AI Logic connection as the food estimates) to turn into 3-5 short, specific suggestions plus a one-line headline. Nothing here is saved anywhere except the summary numbers themselves (in your own profile data) — the suggestions text is cached locally so it's not silently regenerated (and re-billed) every time you open the app; tap **Refresh** for a new one anytime.

This is general encouragement based on your own numbers, not medical or professional advice — the prompt explicitly avoids diagnoses and medical claims, but always use judgement, especially around rapid weight changes.

## Data & privacy

By default, everything (profiles, workouts, weights, food log) is stored only in your browser via `localStorage` — nothing is sent anywhere. That also means:

- Data is per-browser, not per-account — it won't sync between your phone and laptop, unless you link a profile to Google (see **Cloud sync** above).
- Clearing your browser's site data for this app deletes everything not synced to the cloud.
- Use **More → Backup → Export data** regularly to download a JSON backup, and **Import** to restore it (including on a different device) — this works whether or not you use cloud sync.

## Project structure

```
index.html              App shell
manifest.webmanifest     PWA manifest
service-worker.js        Offline caching (app shell + viewed exercise images)
css/styles.css            Design system (light/dark)
js/
  app.js                  Entry point & routes
  router.js                Tiny hash-based router
  store.js                 All data persistence (profiles, sessions, weight, food)
  db.js                    Image compression/encoding helpers for the AI estimate photo flows
  firebaseConfig.js        Your Firebase project config (safe to be public)
  firebase.js              Thin Firebase Auth/Firestore/AI Logic wrapper (loaded from CDN)
  sync.js                  Links a profile to Google & keeps it mirrored to Firestore
  insights.js              Computes weekly stats & drives the AI suggestions
  aiError.js               Shared "make this Gemini error readable" helper
  data/exercises.js        Curated exercise data
  data/templates.js        Workout templates (Push/Pull/Legs/...)
  components/               Reusable UI: nav, modal, toast, charts, icons
  pages/                    One file per screen
```

## Credits

Exercise names, instructions, muscle groups and photos are from [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), released under the Unlicense (public domain).
