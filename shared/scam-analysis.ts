export const riskLevels = ["Safe", "Suspicious", "High Risk"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const analysisLanguages = ["hindi", "marathi", "english"] as const;
export type AnalysisLanguage = (typeof analysisLanguages)[number];

export const messageCategories = ["SAFE", "SPAM / PROMOTIONAL", "SUSPICIOUS", "SCAM"] as const;
export type MessageCategory = (typeof messageCategories)[number];

export const confidenceLevels = ["LOW", "MEDIUM", "HIGH"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const urlVerificationStatuses = ["VERIFIED_THREAT", "NO_THREAT_FOUND", "VERIFICATION_UNAVAILABLE"] as const;
export type UrlVerificationStatus = (typeof urlVerificationStatuses)[number];

export type EvidenceSignal = { type: string; evidence: string };

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
  category: MessageCategory;
  confidence: ConfidenceLevel;
  tactics: string[];
  riskSignals: EvidenceSignal[];
  legitimateSignals: EvidenceSignal[];
  likelyGoal: string;
  explanation: string;
  recommendedAction: string;
  recommendedActions: string[];
  urlFindings: string[];
  urlVerification?: UrlVerificationStatus;
};

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 70) return "High Risk";
  if (score >= 35) return "Suspicious";
  return "Safe";
}

export function shouldShowEmergencyGuidance(score: number): boolean {
  return score >= 70;
}

function signalList(value: unknown): EvidenceSignal[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({ type: typeof item.type === "string" ? item.type.slice(0, 48) : "OTHER", evidence: typeof item.evidence === "string" ? item.evidence.slice(0, 180) : "" }))
    .filter((item) => item.evidence.length > 0)
    .slice(0, 6);
}

function stringList(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];
}

export function normalizeScamAnalysis(value: unknown): ScamAnalysis {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const numericScore = Number(source.riskScore ?? source.risk_score);
  const riskScore = Number.isFinite(numericScore) ? Math.round(Math.min(100, Math.max(0, numericScore))) : 15;
  const fallbackAction = typeof source.recommendedAction === "string" ? source.recommendedAction.trim() : typeof source.recommended_action === "string" ? source.recommended_action.trim() : "Stay cautious and verify independently before taking action.";
  const recommendedActions = stringList(source.recommendedActions ?? source.recommended_actions, 4);
  if (!recommendedActions.length) recommendedActions.push(fallbackAction);
  const category = messageCategories.includes(source.category as MessageCategory) ? source.category as MessageCategory : riskScore >= 80 ? "SCAM" : riskScore >= 40 ? "SUSPICIOUS" : "SAFE";
  const confidence = confidenceLevels.includes(source.confidence as ConfidenceLevel) ? source.confidence as ConfidenceLevel : riskScore >= 70 ? "HIGH" : "MEDIUM";
  const verificationValue = source.urlVerification ?? source.url_verification;
  const urlVerification = urlVerificationStatuses.includes(verificationValue as UrlVerificationStatus) ? verificationValue as UrlVerificationStatus : undefined;

  return {
    riskScore,
    riskLevel: riskLevelForScore(riskScore),
    language: analysisLanguages.includes(source.language as AnalysisLanguage) ? source.language as AnalysisLanguage : "english",
    category,
    confidence,
    tactics: stringList(source.tactics, 6),
    riskSignals: signalList(source.riskSignals ?? source.risk_signals),
    legitimateSignals: signalList(source.legitimateSignals ?? source.legitimate_signals),
    likelyGoal: typeof source.likelyGoal === "string" ? source.likelyGoal.slice(0, 220) : typeof source.likely_goal === "string" ? source.likely_goal.slice(0, 220) : "No suspicious action request detected.",
    explanation: typeof source.explanation === "string" && source.explanation.trim() ? source.explanation.trim().slice(0, 620) : "The message has been reviewed for contextual risk patterns. Verify important requests independently before acting.",
    recommendedAction: recommendedActions[0],
    recommendedActions,
    urlFindings: stringList(source.urlFindings ?? source.url_findings, 4),
    ...(urlVerification ? { urlVerification } : {}),
  };
}
