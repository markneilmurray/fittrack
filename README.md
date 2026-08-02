# FitTrack

A personal fitness app that runs entirely in your browser — plan and log strength & cardio workouts, track body weight, and log food. Works fully offline with no backend and no build step; optionally backs up and syncs to your own Firebase project if you want your data to follow you across devices.

## Features

- **Exercise library** — 75 exercises across chest, back, shoulders, arms, legs, core and cardio, each with a real photo, step-by-step instructions and target muscles (sourced from the public-domain [free-exercise-db](https://github.com/yuhonas/free-exercise-db) project). Star any exercise to favourite it.
- **Session builder** — start from a Push/Pull/Legs/Upper/Lower/Full Body/Core/Cardio template or build a custom session, with sensible default sets & reps you can adjust. Edit a template's exercises once and it's remembered as the new default for next time — a "reset to default" link is always there if you want the original back.
- **Workout logging** — log weight and reps per set, with the weight/duration you did **last time** shown as a reminder so you know what to beat.
- **Strength/cardio balance** — the home screen tracks your weekly strength vs. cardio session count against your goals and nudges you if things are lopsided.
- **Calendar check-off** — tap any day to mark it a workout day or a rest day, see your streak and monthly totals.
- **Body weight tracking** — log weigh-ins, see a trend chart, set a goal weight.
- **Food log** — log meals with calories and macros against a daily goal, with an optional photo attached purely as your own visual reference (no AI estimation — see below).
- **Multiple profiles** — anyone using this device/browser can create their own profile; everyone's workouts, food log and weight history stay separate.
- **Optional cloud sync** — link a profile to a Google account (via your own Firebase project) to back it up and keep it in sync across devices. Entirely opt-in — the app works fully offline without it.
- **Works offline** — installable as a PWA ("Add to Home Screen"), and exercises you've already viewed keep working without a connection.

## Why no food-photo calorie estimation?

Auto-estimating calories from a photo needs a paid AI vision API call, which means either shipping an API key in the app (insecure) or standing up a backend server (defeats the "just upload to GitHub, no server" goal). Since this is meant to be a simple, free, static app anyone can deploy, food photos are just attached as your own reference — you enter the calories/macros yourself. If you'd like, a future version could let you paste in your own Anthropic API key in Settings and call Claude's vision API directly from the browser for estimates.

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

## Data & privacy

By default, everything (profiles, workouts, weights, food log, reference photos) is stored only in your browser via `localStorage` and `IndexedDB` — nothing is sent anywhere. That also means:

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
  db.js                    IndexedDB wrapper for optional food photos
  firebaseConfig.js        Your Firebase project config (safe to be public)
  firebase.js              Thin Firebase Auth/Firestore wrapper (loaded from CDN)
  sync.js                  Links a profile to Google & keeps it mirrored to Firestore
  data/exercises.js        Curated exercise data
  data/templates.js        Workout templates (Push/Pull/Legs/...)
  components/               Reusable UI: nav, modal, toast, charts, icons
  pages/                    One file per screen
```

## Credits

Exercise names, instructions, muscle groups and photos are from [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), released under the Unlicense (public domain).
