import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/_core/voiceTranscription", () => ({ transcribeAudio: vi.fn() }));
vi.mock("../server/scam-analysis", () => ({ analyzeSuspiciousText: vi.fn() }));

import { transcribeAudio } from "../server/_core/voiceTranscription";
import { analyzeSuspiciousText } from "../server/scam-analysis";
import { appRouter } from "../server/routers";

const mockedTranscribeAudio = vi.mocked(transcribeAudio);
const mockedAnalyzeSuspiciousText = vi.mocked(analyzeSuspiciousText);

describe("Audio to transcript to analysis routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the transcript through the same shared analysis function as typed text", async () => {
    mockedTranscribeAudio.mockResolvedValue({ text: "Your account will be blocked today. Share your OTP now." } as never);
    mockedAnalyzeSuspiciousText.mockResolvedValue({
      riskScore: 88,
      riskLevel: "Critical",
      language: "english",
      category: "SCAM",
      confidence: "HIGH",
      tactics: ["OTP/Credential Request"],
      riskSignals: [{ type: "CREDENTIAL_REQUEST", evidence: "Share your OTP now." }],
      legitimateSignals: [],
      likelyGoal: "Get you to share sensitive credentials.",
      explanation: "The transcript asks for a one-time password under pressure.",
      recommendedAction: "Do not share your OTP.",
      recommendedActions: ["Do not share your OTP."],
      urlFindings: [],
    });
    const caller = appRouter.createCaller({} as never);

    const result = await caller.audio.transcribeAndAnalyze({
      audioBase64: "ZmFrZS1hdWRpby1ieXRlcw==",
      mimeType: "audio/mpeg",
      speechLanguage: "en",
      analysisLanguage: "english",
    });

    expect(mockedTranscribeAudio).toHaveBeenCalledOnce();
    expect(mockedAnalyzeSuspiciousText).toHaveBeenCalledWith("Your account will be blocked today. Share your OTP now.", "english");
    expect(result).toMatchObject({ success: true, transcript: "Your account will be blocked today. Share your OTP now.", analysis: { category: "SCAM", riskLevel: "Critical" } });
  });
});
