import { uid, todayStr } from "./utils.js";

const PROFILES_KEY = "fittrack:profiles";
const CURRENT_KEY = "fittrack:currentProfile";
const SEEDED_KEY = "fittrack:seeded";
const dataKey = (id) => `fittrack:data:${id}`;

const DEFAULT_PROFILE_NAMES = ["Mark", "Hannah"];

const PROFILE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899"];

function emptyProfileData() {
  return {
    settings: {
      unit: "kg",
      calorieGoal: 2000,
      weeklyStrengthGoal: 3,
      weeklyCardioGoal: 2,
      goalBodyWeight: null,
      waterGoalDrops: 8,
    },
    sessions: [],
    calendar: {},
    lastPerformance: {},
    bodyWeight: [],
    food: [],
    water: {},
    draft: null,
    favorites: [],
    customTemplates: {},
    lastInsights: null,
    // When this profile's data last changed locally — persisted (unlike a
    // module variable) so sync.js can correctly tell "local is newer than
    // the cloud" even right after a fresh page load, before anything has
    // been pushed yet in this session.
    updatedAtMs: 0,
  };
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Profiles ----

export function listProfiles() {
  return readJson(PROFILES_KEY, []);
}

export function createProfile(name) {
  const profiles = listProfiles();
  const profile = {
    id: uid(),
    name: name.trim(),
    color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
    createdAt: todayStr(),
  };
  profiles.push(profile);
  writeJson(PROFILES_KEY, profiles);
  writeJson(dataKey(profile.id), emptyProfileData());
  return profile;
}

// Seeds Mark & Hannah as starting profiles on a brand new install so the
// homepage has something to pick from. Only ever runs once — if both
// profiles are later deleted on purpose, they won't silently come back.
export function seedDefaultProfilesIfNeeded() {
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, "1");
  if (listProfiles().length > 0) return;
  for (const name of DEFAULT_PROFILE_NAMES) createProfile(name);
}

export function renameProfile(id, name) {
  const profiles = listProfiles();
  const p = profiles.find((p) => p.id === id);
  if (p) {
    p.name = name.trim();
    writeJson(PROFILES_KEY, profiles);
  }
}

export function deleteProfile(id) {
  const profiles = listProfiles().filter((p) => p.id !== id);
  writeJson(PROFILES_KEY, profiles);
  localStorage.removeItem(dataKey(id));
  if (getCurrentProfileId() === id) {
    setCurrentProfileId(null);
  }
}

export function getCurrentProfileId() {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentProfileId(id) {
  if (id) localStorage.setItem(CURRENT_KEY, id);
  else localStorage.removeItem(CURRENT_KEY);
  cache = null;
}

export function getCurrentProfile() {
  const id = getCurrentProfileId();
  return listProfiles().find((p) => p.id === id) || null;
}

// ---- Cloud sync linking (identity only — the actual data sync lives in sync.js) ----

export function linkProfileToCloud(profileId, uid, email) {
  const profiles = listProfiles();
  const p = profiles.find((p) => p.id === profileId);
  if (!p) return;
  p.cloudUid = uid;
  p.cloudEmail = email;
  writeJson(PROFILES_KEY, profiles);
}

export function unlinkProfileFromCloud(profileId) {
  const profiles = listProfiles();
  const p = profiles.find((p) => p.id === profileId);
  if (!p) return;
  delete p.cloudUid;
  delete p.cloudEmail;
  writeJson(PROFILES_KEY, profiles);
}

export function getProfileCloudInfo(profileId) {
  const p = listProfiles().find((p) => p.id === profileId);
  return p && p.cloudUid ? { uid: p.cloudUid, email: p.cloudEmail } : null;
}

// ---- Profile data (cached in memory, written through to localStorage) ----

let cache = null;
let cacheId = null;

function ensureCache() {
  const id = getCurrentProfileId();
  if (!id) throw new Error("No active profile");
  if (cache && cacheId === id) return cache;
  cache = { ...emptyProfileData(), ...readJson(dataKey(id), emptyProfileData()) };
  cacheId = id;
  return cache;
}

let changeListener = null;
// sync.js registers itself here so every local write can be mirrored to
// the cloud (when the active profile is linked) without store.js needing
// to know anything about Firebase.
export function onDataChange(fn) {
  changeListener = fn;
}

function persist() {
  cache.updatedAtMs = Date.now();
  writeJson(dataKey(cacheId), cache);
  if (changeListener) changeListener(cacheId, cache);
}

export function getData() {
  return ensureCache();
}

// Overwrites the active profile's entire data blob — used when pulling a
// cloud backup down (either an explicit "use cloud version" choice, or an
// incoming realtime update from another device).
export function replaceCurrentProfileData(newData) {
  const id = getCurrentProfileId();
  if (!id) return;
  cache = { ...emptyProfileData(), ...newData };
  cacheId = id;
  writeJson(dataKey(id), cache);
}

export function updateSettings(patch) {
  const d = ensureCache();
  d.settings = { ...d.settings, ...patch };
  persist();
  return d.settings;
}

// ---- Favorite exercises ----

export function getFavorites() {
  return ensureCache().favorites || [];
}

export function isFavorite(exerciseId) {
  return getFavorites().includes(exerciseId);
}

export function toggleFavorite(exerciseId) {
  const d = ensureCache();
  d.favorites = d.favorites || [];
  const idx = d.favorites.indexOf(exerciseId);
  if (idx >= 0) d.favorites.splice(idx, 1);
  else d.favorites.push(exerciseId);
  persist();
  return d.favorites.includes(exerciseId);
}

// ---- Custom templates ----
// A template (Push Day, Pull Day, ...) starts from the built-in exercise
// list in data/templates.js. As soon as a session built from a template is
// edited (exercise added/removed, set count changed), that becomes the new
// remembered version for that template — so "Push Day" next time reflects
// what was actually trained last, not the generic starter list.

export function getCustomTemplate(templateId) {
  const d = ensureCache();
  return (d.customTemplates && d.customTemplates[templateId]) || null;
}

export function isTemplateCustomized(templateId) {
  return !!getCustomTemplate(templateId);
}

export function saveCustomTemplate(templateId, exercises) {
  const d = ensureCache();
  d.customTemplates = d.customTemplates || {};
  d.customTemplates[templateId] = { exercises, updatedAt: new Date().toISOString() };
  persist();
}

export function resetCustomTemplate(templateId) {
  const d = ensureCache();
  if (d.customTemplates) delete d.customTemplates[templateId];
  persist();
}

// Called whenever a session built from a template is actually edited
// (exercise added/removed, set count changed) — a no-op for sessions with
// no templateId, so merely opening the default template never "customizes" it.
export function saveCustomTemplateFromDraft(draft) {
  if (!draft || !draft.templateId) return;
  const list = draft.exercises.map((e) =>
    e.type === "strength"
      ? { exerciseId: e.exerciseId, type: "strength", setCount: e.sets.length }
      : { exerciseId: e.exerciseId, type: "cardio", durationMin: e.durationMin }
  );
  saveCustomTemplate(draft.templateId, list);
}

// ---- Sessions ----

export function addSession(session) {
  const d = ensureCache();
  const full = { id: uid(), completedAt: new Date().toISOString(), ...session };
  d.sessions.unshift(full);
  // update last-performance cache for weight reminders
  for (const ex of full.exercises || []) {
    if (ex.type === "strength") {
      const doneSets = (ex.sets || []).filter((s) => s.weight != null && s.weight !== "");
      if (doneSets.length) {
        const best = doneSets[doneSets.length - 1];
        d.lastPerformance[ex.exerciseId] = {
          weight: best.weight,
          reps: best.reps,
          date: full.date,
        };
      }
    } else if (ex.type === "cardio") {
      d.lastPerformance[ex.exerciseId] = {
        durationMin: ex.durationMin,
        distanceKm: ex.distanceKm,
        date: full.date,
      };
    }
  }
  // mark calendar day as workout automatically
  d.calendar[full.date] = "workout";
  persist();
  return full;
}

export function deleteSession(id) {
  const d = ensureCache();
  d.sessions = d.sessions.filter((s) => s.id !== id);
  persist();
}

export function getLastPerformance(exerciseId) {
  return ensureCache().lastPerformance[exerciseId] || null;
}

// ---- Calendar ----

export function setCalendarDay(date, status) {
  const d = ensureCache();
  if (status === null) delete d.calendar[date];
  else d.calendar[date] = status;
  persist();
}

export function getCalendar() {
  return ensureCache().calendar;
}

// ---- Body weight ----

export function addBodyWeight(entry) {
  const d = ensureCache();
  const full = { id: uid(), ...entry };
  d.bodyWeight = d.bodyWeight.filter((e) => e.date !== full.date);
  d.bodyWeight.push(full);
  d.bodyWeight.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  return full;
}

export function deleteBodyWeight(id) {
  const d = ensureCache();
  d.bodyWeight = d.bodyWeight.filter((e) => e.id !== id);
  persist();
}

// ---- Food ----

export function addFoodEntry(entry) {
  const d = ensureCache();
  const full = { id: uid(), ...entry };
  d.food.push(full);
  persist();
  return full;
}

export function deleteFoodEntry(id) {
  const d = ensureCache();
  d.food = d.food.filter((e) => e.id !== id);
  persist();
}

export function updateFoodEntry(id, patch) {
  const d = ensureCache();
  const entry = d.food.find((e) => e.id === id);
  if (entry) Object.assign(entry, patch);
  persist();
}

// ---- Water (count of 500ml bottles per day) ----

export function getWaterCount(date) {
  return ensureCache().water[date] || 0;
}

export function setWaterCount(date, count) {
  const d = ensureCache();
  if (count > 0) d.water[date] = count;
  else delete d.water[date];
  persist();
}

// ---- Weekly AI insights (cached so it's not regenerated on every visit) ----

export function getInsights() {
  return ensureCache().lastInsights;
}

export function saveInsights(insights) {
  const d = ensureCache();
  d.lastInsights = { ...insights, generatedAt: new Date().toISOString() };
  persist();
  return d.lastInsights;
}

// ---- Draft session (in-progress session being built or logged) ----

export function getDraft() {
  return ensureCache().draft;
}

export function setDraft(draft) {
  const d = ensureCache();
  d.draft = draft;
  persist();
  return d.draft;
}

export function clearDraft() {
  setDraft(null);
}

// ---- Export / import (backup) ----

export function exportAllData() {
  const profiles = listProfiles();
  const data = {};
  for (const p of profiles) {
    data[p.id] = readJson(dataKey(p.id), emptyProfileData());
  }
  return { profiles, data, exportedAt: new Date().toISOString() };
}

export function importAllData(payload) {
  if (!payload || !Array.isArray(payload.profiles)) throw new Error("Invalid backup file");
  writeJson(PROFILES_KEY, payload.profiles);
  for (const p of payload.profiles) {
    writeJson(dataKey(p.id), payload.data[p.id] || emptyProfileData());
  }
  cache = null;
  cacheId = null;
}
