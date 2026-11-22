export type Nutrients = {
  energy?: number; sugar?: number; saturatedFat?: number; salt?: number;
  transFat?: number; fiber?: number; protein?: number;
};
export type Factor = { key: string; label: string; score: number; detail: string; value?: number; unit?: string; available: boolean };
export type Analysis = { score: number | null; band: string; factors: Factor[]; confidence: "Good" | "Limited" | "Insufficient"; missing: string[]; summary: string };
const clamp = (n: number) => Math.max(0, Math.min(100, n));
// Prototype thresholds for a transparent educational indicator, not clinical or regulatory cut-offs.
function ramp(value: number | undefined, low: number, high: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return clamp(((value - low) / (high - low)) * 100);
}
export function scoreNutrition(n: Nutrients): Analysis {
  const definitions = [
    { key: "salt", label: "Salt", weight: 25, unit: "g/100g", get: () => ramp(n.salt, 0.3, 2), reason: "Higher salt intake can contribute to elevated blood pressure over time." },
    { key: "saturatedFat", label: "Saturated fat", weight: 20, unit: "g/100g", get: () => ramp(n.saturatedFat, 1.5, 10), reason: "Frequent high intake can raise LDL cholesterol." },
    { key: "sugar", label: "Sugars", weight: 20, unit: "g/100g", get: () => ramp(n.sugar, 5, 22.5), reason: "High-sugar foods can make it easier to exceed recommended free-sugar intake." },
    { key: "energy", label: "Energy density", weight: 15, unit: "kcal/100g", get: () => ramp(n.energy, 250, 550), reason: "Energy-dense foods can add substantial calories in small portions." },
    { key: "transFat", label: "Trans fat", weight: 10, unit: "g/100g", get: () => ramp(n.transFat, 0, 2), reason: "Industrial trans fats are especially undesirable for cardiovascular health." },
    { key: "fiber", label: "Low fibre", weight: 10, unit: "g/100g", get: () => n.fiber === undefined ? undefined : clamp(((5 - n.fiber) / 5) * 100), reason: "Low fibre means this snack contributes less dietary fibre." }
  ];
  const factors: Factor[] = definitions.map(d => {
    const value = d.get();
    const raw = (n as Record<string, number | undefined>)[d.key];
    return { key: d.key, label: d.label, score: value ?? 0, detail: d.reason, value: raw, unit: d.unit, available: value !== undefined };
  });
  const available = factors.filter(f => f.available);
  const weight = definitions.filter(d => factors.find(f => f.key === d.key)?.available).reduce((a, d) => a + d.weight, 0);
  const calculated = weight ? Math.round(available.reduce((sum, f) => sum + f.score * (definitions.find(d => d.key === f.key)!.weight), 0) / weight) : 0;
  const score = available.length >= 3 ? calculated : null;
  const missing = factors.filter(f => !f.available).map(f => f.label);
  const band = score === null ? "Insufficient data" : score <= 20 ? "Lower concern" : score <= 40 ? "Moderate concern" : score <= 60 ? "Elevated concern" : score <= 80 ? "High concern" : "Very high concern";
  return { score, band, factors, confidence: available.length >= 5 ? "Good" : available.length >= 3 ? "Limited" : "Insufficient", missing, summary: available.length < 3 ? "Not enough nutrition data for a meaningful score. A score is withheld until at least 3 of 6 nutrition factors per 100 g are available." : `Based on ${available.length} of 6 nutrition factors per 100 g. This is an experimental screening indicator, not a medical risk prediction.` };
}
