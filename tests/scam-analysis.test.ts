import { describe, expect, it } from "vitest";

import { normalizeScamAnalysis, riskLevelForScore } from "../shared/scam-analysis";
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
    );

    expect(result.riskLevel).toBe("High Risk");
    expect(result.tactics).toContain("OTP/Credential Request");
    expect(result.urlFindings.length).toBeGreaterThan(0);
  });
});
