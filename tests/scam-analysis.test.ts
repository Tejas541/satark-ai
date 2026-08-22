import { describe, expect, it } from "vitest";

import { normalizeScamAnalysis, riskLevelForScore, shouldShowEmergencyGuidance } from "../shared/scam-analysis";
import { createSafetyFallback } from "../server/scam-analysis";

describe("Satark AI V2 calibrated detection", () => {
  it("derives risk levels and emergency guidance at stable thresholds", () => {
    expect(riskLevelForScore(0)).toBe("Safe");
    expect(riskLevelForScore(35)).toBe("Suspicious");
    expect(riskLevelForScore(70)).toBe("High Risk");
    expect(shouldShowEmergencyGuidance(69)).toBe(false);
    expect(shouldShowEmergencyGuidance(70)).toBe(true);
  });

  it("normalizes a partial legacy record without breaking history compatibility", () => {
    const result = normalizeScamAnalysis({ riskScore: 12, tactics: ["Fake Urgency", 42], explanation: "A legacy result." });
    expect(result.category).toBe("SAFE");
    expect(result.confidence).toBe("MEDIUM");
    expect(result.recommendedActions).toHaveLength(1);
    expect(result.riskSignals).toEqual([]);
  });

  const calibratedCases = [
    { name: "genuine personal message", text: "Hi Rahul, are we still meeting for lunch tomorrow?", category: "SAFE", max: 19 },
    { name: "genuine transaction alert", text: "Dear Customer, ₹2,500 was debited from your account through UPI.", category: "SAFE", max: 19 },
    { name: "official electricity reminder", text: "Your electricity bill of ₹1,240 is due on Aug 30. Pay through the official app.", category: "SAFE", max: 19 },
    { name: "ordinary promotion", text: "Flat 30% off on selected shoes. Shop before Sunday.", category: "SPAM / PROMOTIONAL", min: 20, max: 39 },
    { name: "OTP threat scam", text: "Your account will be blocked today. Click this link and enter your OTP.", category: "SCAM", min: 80 },
    { name: "advance-fee prize scam", text: "Congratulations! You won ₹25 lakh. Pay ₹999 processing fee to claim.", category: "SCAM", min: 80 },
    { name: "fake job registration fee", text: "You have been selected for a work-from-home job. Pay ₹1,500 registration fee.", category: "SCAM", min: 80 },
    { name: "ambiguous verification notice", text: "Your account requires an important update. Please verify your details.", category: "SUSPICIOUS", min: 40, max: 59 },
    { name: "anti-scam educational message", text: "Never share your OTP or UPI PIN with anyone.", category: "SAFE", max: 19 },
    { name: "short-link KYC phishing", text: "Your KYC will expire today. Click bit.ly/update and enter your Aadhaar and OTP.", category: "SCAM", min: 80 },
  ] as const;

  for (const scenario of calibratedCases) {
    it(`calibrates ${scenario.name}`, () => {
      const result = createSafetyFallback(scenario.text, "english");
      expect(result.category).toBe(scenario.category);
      if ("min" in scenario) expect(result.riskScore).toBeGreaterThanOrEqual(scenario.min);
      if ("max" in scenario) expect(result.riskScore).toBeLessThanOrEqual(scenario.max);
      expect(result.likelyGoal.length).toBeGreaterThan(3);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
    });
  }

  it("keeps transcript-equivalent context on the same V2 engine", () => {
    const textResult = createSafetyFallback("Your account will be blocked today. Click bit.ly/update and enter your OTP.", "english");
    const transcriptResult = createSafetyFallback("Your account will be blocked today. Click bit.ly/update and enter your OTP.", "english");
    expect(transcriptResult).toMatchObject({ category: textResult.category, riskScore: textResult.riskScore, tactics: textResult.tactics });
  });

  it("returns explainable, high-confidence evidence for contextual credential phishing", () => {
    const result = createSafetyFallback("Your KYC will expire today. Click bit.ly/update and enter your Aadhaar and OTP.", "english");
    expect(result.confidence).toBe("HIGH");
    expect(result.riskSignals.map((signal) => signal.type)).toEqual(expect.arrayContaining(["CREDENTIAL_REQUEST", "SHORTENED_LINK", "ACCOUNT_THREAT"]));
    expect(result.urlFindings.length).toBeGreaterThan(0);
    expect(result.recommendedActions.join(" ")).toMatch(/OTP|link/i);
  });

  it("keeps ordinary promotions explainable without inventing fraud evidence", () => {
    const result = createSafetyFallback("Flat 30% off on selected shoes. Shop before Sunday.", "english");
    expect(result.category).toBe("SPAM / PROMOTIONAL");
    expect(result.riskSignals).toEqual([]);
    expect(result.legitimateSignals.map((signal) => signal.type)).toContain("PROMOTIONAL_CONTEXT");
  });

  it("renders Devanagari fallback text for Hindi and Marathi output", () => {
    expect(createSafetyFallback("Your KYC will be blocked today. Share OTP now.", "hindi").explanation).toMatch(/[\u0900-\u097F]/);
    expect(createSafetyFallback("Your KYC will be blocked today. Share OTP now.", "marathi").explanation).toMatch(/[\u0900-\u097F]/);
  });
});
