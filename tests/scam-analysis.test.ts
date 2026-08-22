import { describe, expect, it } from "vitest";

import { normalizeScamAnalysis, riskLevelForScore, shouldShowEmergencyGuidance } from "../shared/scam-analysis";
import { createSafetyFallback } from "../server/scam-analysis";

describe("Satark AI analysis normalization", () => {
  it("derives the risk level from the normalized score", () => {
    expect(riskLevelForScore(0)).toBe("Safe");
    expect(riskLevelForScore(35)).toBe("Suspicious");
    expect(riskLevelForScore(70)).toBe("High Risk");
  });

  it("clamps malformed scores and removes non-text findings", () => {
    const result = normalizeScamAnalysis({
      riskScore: 145.4,
      tactics: ["Fake Urgency", 42, "OTP/Credential Request"],
      urlFindings: ["The domain is a lookalike", null],
      explanation: "An OTP request and immediate deadline are common pressure signals.",
      recommendedAction: "Do not share the OTP. Verify with your bank's official number.",
    });

    expect(result.riskScore).toBe(100);
    expect(result.riskLevel).toBe("High Risk");
    expect(result.tactics).toEqual(["Fake Urgency", "OTP/Credential Request"]);
    expect(result.urlFindings).toEqual(["The domain is a lookalike"]);
  });

  it("returns a usable risk result when the model response is unavailable", () => {
    const result = createSafetyFallback(
      "Congratulations! Your KYC will be blocked today. Click bit.ly/update-kyc-now and enter your OTP now.",
      "english",
    );

    expect(result.riskLevel).toBe("High Risk");
    expect(result.tactics).toContain("OTP/Credential Request");
    expect(result.urlFindings.length).toBeGreaterThan(0);
  });

  it("honors the selected Hindi register in a fallback result", () => {
    const result = createSafetyFallback("Your KYC will be blocked today. Share OTP now.", "hindi");

    expect(result.language).toBe("hindi");
    expect(result.explanation).toMatch(/[\u0900-\u097F]/);
    expect(result.recommendedAction).toMatch(/[\u0900-\u097F]/);
  });

  it("honors the selected Marathi register in a fallback result", () => {
    const result = createSafetyFallback("Your KYC will be blocked today. Share OTP now.", "marathi");

    expect(result.language).toBe("marathi");
    expect(result.explanation).toContain("संदेशात");
    expect(result.recommendedAction).toMatch(/[\u0900-\u097F]/);
  });

  it("defaults malformed language values to English", () => {
    const result = normalizeScamAnalysis({ riskScore: 12, language: "unsupported" });
    expect(result.language).toBe("english");
  });

  it("shows emergency actions only for high-risk scores", () => {
    expect(shouldShowEmergencyGuidance(69)).toBe(false);
    expect(shouldShowEmergencyGuidance(70)).toBe(true);
  });
});
