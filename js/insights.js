// Turns a profile's own logged data into (a) a set of plain computed stats
// — deterministic, no AI involved, always available — and (b) a short
// AI-written set of suggestions grounded in those stats. Nothing here is
// sent anywhere except the one summarize-and-suggest request to Gemini.
import { todayStr, addDays } from "./utils.js";

const TREND_WINDOW_DAYS = 28;

export function computeWeeklySummary(data) {
  const today = todayStr();
  const weekStart = addDays(today, -6);

  const weekFood = data.food.filter((f) => f.date >= weekStart && f.date <= today);
  const daysLogged = new Set(weekFood.map((f) => f.date)).size;
  const totalCalories = weekFood.reduce((s, f) => s + (Number(f.calories) || 0), 0);
  const totalProtein = weekFood.reduce((s, f) => s + (Number(f.protein) || 0), 0);
  const totalCarbs = weekFood.reduce((s, f) => s + (Number(f.carbs) || 0), 0);
  const totalFat = weekFood.reduce((s, f) => s + (Number(f.fat) || 0), 0);
  const avgCaloriesPerLoggedDay = daysLogged ? Math.round(totalCalories / daysLogged) : 0;
  const avgProteinPerLoggedDay = daysLogged ? Math.round(totalProtein / daysLogged) : 0;

  const weekSessions = data.sessions.filter((s) => s.date >= weekStart && s.date <= today);
  const strengthCount = weekSessions.filter((s) => s.type === "strength" || s.type === "mixed").length;
  const cardioCount = weekSessions.filter((s) => s.type === "cardio" || s.type === "mixed").length;
  const restDaysLogged = Object.entries(data.calendar).filter(([date, status]) => date >= weekStart && date <= today && status === "rest").length;

  const trendStart = addDays(today, -TREND_WINDOW_DAYS);
  const trendEntries = [...data.bodyWeight].filter((e) => e.date >= trendStart).sort((a, b) => a.date.localeCompare(b.date));
  const latest = data.bodyWeight.length ? [...data.bodyWeight].sort((a, b) => a.date.localeCompare(b.date)).at(-1) : null;
  let weightRatePerWeek = null;
  if (trendEntries.length >= 2) {
    const first = trendEntries[0];
    const last = trendEntries.at(-1);
    const daySpan = (new Date(last.date) - new Date(first.date)) / 86400000;
    if (daySpan >= 3) {
      weightRatePerWeek = ((last.weight - first.weight) / daySpan) * 7;
    }
  }

  const goalWeight = data.settings.goalBodyWeight;
  let weightToGoal = null;
  let weeksToGoalAtCurrentRate = null;
  if (goalWeight != null && latest) {
    weightToGoal = latest.weight - goalWeight; // positive = needs to lose, negative = needs to gain
    if (weightRatePerWeek && Math.abs(weightRatePerWeek) > 0.01) {
      const movingTowardGoal = (weightToGoal > 0 && weightRatePerWeek < 0) || (weightToGoal < 0 && weightRatePerWeek > 0);
      if (movingTowardGoal) weeksToGoalAtCurrentRate = Math.round(Math.abs(weightToGoal / weightRatePerWeek));
    }
  }

  return {
    unit: data.settings.unit,
    daysLogged,
    avgCaloriesPerLoggedDay,
    avgProteinPerLoggedDay,
    calorieGoal: data.settings.calorieGoal || null,
    strengthCount,
    cardioCount,
    strengthGoal: data.settings.weeklyStrengthGoal,
    cardioGoal: data.settings.weeklyCardioGoal,
    restDaysLogged,
    currentWeight: latest ? latest.weight : null,
    goalWeight,
    weightToGoal,
    weightRatePerWeek: weightRatePerWeek != null ? Math.round(weightRatePerWeek * 100) / 100 : null,
    weeksToGoalAtCurrentRate,
    hasEnoughData: daysLogged >= 2 || weekSessions.length >= 1,
  };
}

function summaryToText(s) {
  const lines = [];
  lines.push(`Food logged on ${s.daysLogged} of the last 7 days.`);
  if (s.daysLogged) {
    lines.push(
      `Average on days logged: ${s.avgCaloriesPerLoggedDay} kcal/day, ${s.avgProteinPerLoggedDay}g protein/day.` +
        (s.calorieGoal ? ` Their daily calorie goal is ${s.calorieGoal} kcal.` : " No calorie goal set.")
    );
  }
  lines.push(
    `This week: ${s.strengthCount} strength session(s) (goal ${s.strengthGoal}), ${s.cardioCount} cardio session(s) (goal ${s.cardioGoal}), ${s.restDaysLogged} rest day(s) logged.`
  );
  if (s.currentWeight != null) {
    lines.push(`Current weight: ${s.currentWeight} ${s.unit}.`);
    if (s.weightRatePerWeek != null) {
      const dir = s.weightRatePerWeek < 0 ? "losing" : s.weightRatePerWeek > 0 ? "gaining" : "steady";
      lines.push(`Weight trend: ${dir} about ${Math.abs(s.weightRatePerWeek)} ${s.unit}/week over the last ~4 weeks.`);
    } else {
      lines.push("Not enough recent weigh-ins to compute a trend yet.");
    }
    if (s.goalWeight != null) {
      lines.push(
        `Goal weight: ${s.goalWeight} ${s.unit} (currently ${Math.abs(s.weightToGoal).toFixed(1)} ${s.unit} ${s.weightToGoal > 0 ? "above" : "below"} goal).` +
          (s.weeksToGoalAtCurrentRate
            ? ` At their current trend, roughly ${s.weeksToGoalAtCurrentRate} week(s) to reach it.`
            : " Their current trend isn't moving toward that goal yet.")
      );
    } else {
      lines.push("No goal weight set.");
    }
  } else {
    lines.push("No body weight logged yet.");
  }
  return lines.join("\n");
}

// Generates fresh AI suggestions from this profile's own data and caches
// the result (via store.js) so it isn't silently re-generated on every
// visit. Returns { headline, suggestions, generatedAt }.
export async function generateInsights(data) {
  const summary = computeWeeklySummary(data);
  const { generateWeeklyInsights } = await import("./firebase.js");
  const { saveInsights } = await import("./store.js");
  const result = await generateWeeklyInsights(summaryToText(summary));
  return saveInsights(result);
}
