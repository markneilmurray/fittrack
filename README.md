# FitTrack

A personal fitness app that runs entirely in your browser — plan and log strength & cardio workouts, track body weight, and log food, with everything stored locally on your device. No backend, no build step, no account.

## Features

- **Exercise library** — 75 exercises across chest, back, shoulders, arms, legs, core and cardio, each with a real photo, step-by-step instructions and target muscles (sourced from the public-domain [free-exercise-db](https://github.com/yuhonas/free-exercise-db) project).
- **Session builder** — start from a Push/Pull/Legs/Upper/Lower/Full Body/Core/Cardio template or build a custom session, with sensible default sets & reps you can adjust.
- **Workout logging** — log weight and reps per set, with the weight/duration you did **last time** shown as a reminder so you know what to beat.
- **Strength/cardio balance** — the home screen tracks your weekly strength vs. cardio session count against your goals and nudges you if things are lopsided.
- **Calendar check-off** — tap any day to mark it a workout day or a rest day, see your streak and monthly totals.
- **Body weight tracking** — log weigh-ins, see a trend chart, set a goal weight.
- **Food log** — log meals with calories and macros against a daily goal, with an optional photo attached purely as your own visual reference (no AI estimation — see below).
- **Multiple profiles** — anyone using this device/browser can create their own profile; everyone's workouts, food log and weight history stay separate.
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

## Data & privacy

Everything (profiles, workouts, weights, food log, reference photos) is stored only in your browser via `localStorage` and `IndexedDB` — nothing is sent anywhere. That also means:

- Data is per-browser, not per-account — it won't sync between your phone and laptop.
- Clearing your browser's site data for this app deletes everything.
- Use **More → Backup → Export data** regularly to download a JSON backup, and **Import** to restore it (including on a different device).

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
  data/exercises.js        Curated exercise data
  data/templates.js        Workout templates (Push/Pull/Legs/...)
  components/               Reusable UI: nav, modal, toast, charts, icons
  pages/                    One file per screen
```

## Credits

Exercise names, instructions, muscle groups and photos are from [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), released under the Unlicense (public domain).
