import { invokeLLM } from "./_core/llm";
import { normalizeScamAnalysis, type ScamAnalysis } from "../shared/scam-analysis";

const analysisInstructions = `You are Satark AI, a cautious scam and manipulation detector for people in India.

Assess only the submitted text and any URL it contains. Do not claim certainty, do not identify a sender as criminal, and do not invent facts. Evaluate signals such as fake urgency, authority impersonation, payment pressure, requests for OTPs or credentials, and too-good-to-be-true offers. If a URL appears, flag only basic visible domain red flags such as brand misspellings, deceptive subdomains, suspicious TLDs, or a mismatch with the claimed organization.

Return a single JSON object with these fields: riskScore (integer 0-100), tactics (array of at most 5 short labels), explanation (plain-language explanation in the same language and register as the user input), recommendedAction (one concise, practical next step in the same language/register), and urlFindings (array of at most 4 concise findings). Use the tactic labels "Fake Urgency", "Authority Impersonation", "Payment Pressure", "OTP/Credential Request", and "Too-Good-To-Be-True Offer" where they fit. For Hindi input, write in natural Hindi; for Hinglish input, write natural Hinglish in Latin script; for English input, write English. Never request personal data.`;

export async function analyzeSuspiciousText(content: string): Promise<ScamAnalysis> {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: analysisInstructions },
      { role: "user", content: content.trim() },
    ],
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (typeof rawContent !== "string") {
    throw new Error("Analysis was unavailable. Please try again.");
  }

  try {
    return normalizeScamAnalysis(JSON.parse(rawContent));
  } catch {
    throw new Error("Analysis returned an invalid result. Please try again.");
  }
}
