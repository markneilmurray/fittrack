import { uid, todayStr } from "./utils.js";

const PROFILES_KEY = "fittrack:profiles";
const CURRENT_KEY = "fittrack:currentProfile";
const dataKey = (id) => `fittrack:data:${id}`;

const PROFILE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899"];

function emptyProfileData() {
  return {
    settings: {
      unit: "kg",
      calorieGoal: 2000,
      weeklyStrengthGoal: 3,
      weeklyCardioGoal: 2,
      goalBodyWeight: null,
    },
    sessions: [],
    calendar: {},
    lastPerformance: {},
    bodyWeight: [],
    food: [],
    draft: null,
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

function persist() {
  writeJson(dataKey(cacheId), cache);
}

export function getData() {
  return ensureCache();
}

export function updateSettings(patch) {
  const d = ensureCache();
  d.settings = { ...d.settings, ...patch };
  persist();
  return d.settings;
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
