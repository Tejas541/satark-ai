export const riskLevels = ["Safe", "Suspicious", "High Risk"] as const;

export type RiskLevel = (typeof riskLevels)[number];

export const analysisLanguages = ["hindi", "marathi", "english"] as const;
export type AnalysisLanguage = (typeof analysisLanguages)[number];

export const tacticLabels = [
  "Fake Urgency",
  "Authority Impersonation",
  "Payment Pressure",
  "OTP/Credential Request",
  "Too-Good-To-Be-True Offer",
] as const;

export type ScamAnalysis = {
  riskScore: number;
  riskLevel: RiskLevel;
  language: AnalysisLanguage;
  tactics: string[];
  explanation: string;
  recommendedAction: string;
  urlFindings: string[];
};

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 70) return "High Risk";
  if (score >= 35) return "Suspicious";
  return "Safe";
}

export function shouldShowEmergencyGuidance(score: number): boolean {
  return score >= 70;
}

export function normalizeScamAnalysis(value: unknown): ScamAnalysis {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const numericScore = Number(source.riskScore);
  const riskScore = Number.isFinite(numericScore) ? Math.round(Math.min(100, Math.max(0, numericScore))) : 50;
  const tactics = Array.isArray(source.tactics)
    ? source.tactics.filter((item): item is string => typeof item === "string").slice(0, 5)
    : [];
  const urlFindings = Array.isArray(source.urlFindings)
    ? source.urlFindings.filter((item): item is string => typeof item === "string").slice(0, 4)
    : [];

  return {
    riskScore,
    riskLevel: riskLevelForScore(riskScore),
    language: analysisLanguages.includes(source.language as AnalysisLanguage)
      ? (source.language as AnalysisLanguage)
      : "english",
    tactics,
    explanation:
      typeof source.explanation === "string" && source.explanation.trim()
        ? source.explanation.trim().slice(0, 520)
        : "The message has been reviewed for common signs of manipulation. Verify important requests independently before acting.",
    recommendedAction:
      typeof source.recommendedAction === "string" && source.recommendedAction.trim()
        ? source.recommendedAction.trim().slice(0, 220)
        : "Pause before acting. Use an official website or phone number to verify the request.",
    urlFindings,
  };
}
