import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("../server/safe-browsing", () => ({ lookupSafeBrowsing: vi.fn(async () => ({ status: "checked", threats: [] })) }));

import { invokeLLM } from "../server/_core/llm";
import { analyzeSuspiciousText } from "../server/scam-analysis";

const mockedInvokeLLM = vi.mocked(invokeLLM);

function llmResponse(payload: object) {
  return {
    id: "test",
    created: 0,
    model: "claude-sonnet-4-6",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(payload) } }],
  } as never;
}

describe("Structured LLM analysis integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses a coherent structured LLM assessment while preserving the established response contract", async () => {
    mockedInvokeLLM.mockResolvedValue(llmResponse({
      riskScore: 22,
      category: "SPAM / PROMOTIONAL",
      confidence: "HIGH",
      tactics: ["Marketing offer"],
      riskSignals: [],
      legitimateSignals: [{ type: "PROMOTIONAL_CONTEXT", evidence: "A sale is offered without a sensitive request." }],
      likelyGoal: "Promote a product or service.",
      explanation: "This is a normal promotional offer without a request for credentials, payment to an unknown party, or urgent manipulation.",
      recommendedActions: ["Stay cautious and verify independently before taking action."],
      urlFindings: [],
    }));

    const result = await analyzeSuspiciousText("Flat 40% off on selected shoes. Offer valid until Sunday.", "english");
    expect(mockedInvokeLLM).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ category: "SPAM / PROMOTIONAL", riskScore: 22, confidence: "HIGH", language: "english" });
    expect(result.legitimateSignals[0]?.type).toBe("PROMOTIONAL_CONTEXT");
    expect(result.recommendedActions).toHaveLength(1);
  });

  it("falls back to the existing calibrated engine when LLM output is malformed", async () => {
    mockedInvokeLLM.mockResolvedValue({ id: "bad", created: 0, model: "claude-sonnet-4-6", choices: [] } as never);

    const result = await analyzeSuspiciousText("Your KYC will expire today. Click bit.ly/update and enter your Aadhaar and OTP.", "english");
    expect(result.category).toBe("SCAM");
    expect(result.riskScore).toBeGreaterThanOrEqual(80);
    expect(result.riskSignals.map((signal) => signal.type)).toEqual(expect.arrayContaining(["CREDENTIAL_REQUEST", "SHORTENED_LINK"]));
  });
});
