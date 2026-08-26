import { describe, expect, it } from "vitest";

import { normalizeScamAnalysis, riskLevelForScore, shouldShowEmergencyGuidance } from "../shared/scam-analysis";
import { createSafetyFallback, extractMeaningfulUrls, markUrlVerificationUnavailable, mergeSafeBrowsingEvidence } from "../server/scam-analysis";

describe("Satark AI V2 calibrated detection", () => {
  it("derives risk levels and emergency guidance at stable thresholds", () => {
    expect(riskLevelForScore(20)).toBe("Low");
    expect(riskLevelForScore(21)).toBe("Suspicious");
    expect(riskLevelForScore(49)).toBe("Suspicious");
    expect(riskLevelForScore(50)).toBe("High");
    expect(riskLevelForScore(74)).toBe("High");
    expect(riskLevelForScore(75)).toBe("Critical");
    expect(riskLevelForScore(100)).toBe("Critical");
    expect(shouldShowEmergencyGuidance(49)).toBe(false);
    expect(shouldShowEmergencyGuidance(50)).toBe(true);
  });

  it("normalizes a partial legacy record without breaking history compatibility", () => {
    const result = normalizeScamAnalysis({ riskScore: 12, tactics: ["Fake Urgency", 42], explanation: "A legacy result." });
    expect(result.category).toBe("SAFE");
    expect(result.confidence).toBe("MEDIUM");
    expect(result.recommendedActions).toHaveLength(1);
    expect(result.riskSignals).toEqual([]);
  });

  const calibratedCases = [
    { name: "genuine personal message", text: "Hi Rahul, are we still meeting for lunch tomorrow?", category: "SAFE", max: 20 },
    { name: "genuine transaction alert", text: "Dear Customer, ₹2,500 was debited from your account through UPI.", category: "SAFE", max: 20 },
    { name: "official electricity reminder", text: "Your electricity bill of ₹1,240 is due on Aug 30. Pay through the official app.", category: "SAFE", max: 20 },
    { name: "ordinary promotion", text: "Flat 30% off on selected shoes. Shop before Sunday.", category: "SPAM / PROMOTIONAL", min: 21, max: 49 },
    { name: "OTP threat scam", text: "Your account will be blocked today. Click this link and enter your OTP.", category: "SCAM", min: 75 },
    { name: "advance-fee prize scam", text: "Congratulations! You won ₹25 lakh. Pay ₹999 processing fee to claim.", category: "SCAM", min: 75 },
    { name: "fake job registration fee", text: "You have been selected for a work-from-home job. Pay ₹1,500 registration fee.", category: "SCAM", min: 75 },
    { name: "ambiguous verification notice", text: "Your account requires an important update. Please verify your details.", category: "SUSPICIOUS", min: 21, max: 49 },
    { name: "anti-scam educational message", text: "Never share your OTP or UPI PIN with anyone.", category: "SAFE", max: 20 },
    { name: "short-link KYC phishing", text: "Your KYC will expire today. Click bit.ly/update and enter your Aadhaar and OTP.", category: "SCAM", min: 75 },
    { name: "delivery fee cancellation pressure", text: "Your parcel could not be delivered because of an incomplete address. Pay ₹25 delivery verification fee now to avoid cancellation: https://example.com", category: "SCAM", min: 75 },
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

  it("extracts meaningful URLs without treating an ordinary URL as unsafe", () => {
    expect(extractMeaningfulUrls("Here is the document: https://example.com/document.")).toEqual(["https://example.com/document"]);
    expect(extractMeaningfulUrls("Read www.example.com/a, www.example.com/a, and malformed https://")).toEqual(["https://www.example.com/a"]);
    const result = createSafetyFallback("Here is the document: https://example.com/document", "english");
    expect(result.category).toBe("SAFE");
    expect(result.riskSignals).toEqual([]);
  });

  it("uses a verified Safe Browsing threat as strong URL evidence without replacing other context", () => {
    const base = createSafetyFallback("Your parcel could not be delivered. Pay ₹25 verification fee now to avoid cancellation: https://delivery-check.example", "english");
    const result = mergeSafeBrowsingEvidence(base, [{ url: "https://delivery-check.example", threatType: "SOCIAL_ENGINEERING", platformType: "ANY_PLATFORM", threatEntryType: "URL" }]);
    expect(result.category).toBe("SCAM");
    expect(result.confidence).toBe("HIGH");
    expect(result.riskScore).toBeGreaterThanOrEqual(75);
    expect(result.riskSignals.map((signal) => signal.type)).toContain("UNSAFE_URL");
    expect(result.explanation).toMatch(/Safe Browsing/i);
    expect(result.recommendedActions.join(" ")).toMatch(/link/i);
    expect(result.urlVerification).toBe("VERIFIED_THREAT");
  });

  it("represents unavailable URL verification without changing contextual risk or claiming the link is safe", () => {
    const base = createSafetyFallback("Please update your account details using https://example.com/verify", "english");
    const result = markUrlVerificationUnavailable(base);
    expect(result.urlVerification).toBe("VERIFICATION_UNAVAILABLE");
    expect(result.riskScore).toBe(base.riskScore);
    expect(result.category).toBe(base.category);
    expect(result.urlFindings.join(" ")).toMatch(/could not be independently verified/i);
  });

  it("renders Devanagari fallback text for Hindi and Marathi output", () => {
    expect(createSafetyFallback("Your KYC will be blocked today. Share OTP now.", "hindi").explanation).toMatch(/[\u0900-\u097F]/);
    expect(createSafetyFallback("Your KYC will be blocked today. Share OTP now.", "marathi").explanation).toMatch(/[\u0900-\u097F]/);
  });
});
