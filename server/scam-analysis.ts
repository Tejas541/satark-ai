import { invokeLLM } from "./_core/llm";
import { normalizeScamAnalysis, riskLevelForScore, type ScamAnalysis } from "../shared/scam-analysis";

const analysisInstructions = `You are Satark AI, a cautious scam and manipulation detector for people in India.

Assess only the submitted text and any URL it contains. Do not claim certainty, do not identify a sender as criminal, and do not invent facts. Evaluate signals such as fake urgency, authority impersonation, payment pressure, requests for OTPs or credentials, and too-good-to-be-true offers. If a URL appears, flag only basic visible domain red flags such as brand misspellings, deceptive subdomains, suspicious TLDs, or a mismatch with the claimed organization.

Return a single JSON object with these fields: riskScore (integer 0-100), tactics (array of at most 5 short labels), explanation (plain-language explanation in the same language and register as the user input), recommendedAction (one concise, practical next step in the same language/register), and urlFindings (array of at most 4 concise findings). Use the tactic labels "Fake Urgency", "Authority Impersonation", "Payment Pressure", "OTP/Credential Request", and "Too-Good-To-Be-True Offer" where they fit. For Hindi input, write in natural Hindi; for Hinglish input, write natural Hinglish in Latin script; for English input, write English. Never request personal data.`;

export async function analyzeSuspiciousText(content: string): Promise<ScamAnalysis> {
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: analysisInstructions },
        { role: "user", content: content.trim() },
      ],
      response_format: { type: "json_object" },
    });

    const firstChoice = Array.isArray(response?.choices) ? response.choices[0] : undefined;
    const rawContent = firstChoice?.message?.content;
    if (typeof rawContent !== "string") {
      const responseKeys = response && typeof response === "object" ? Object.keys(response).join(", ") : "no response";
      console.error(`[Satark AI] Unexpected LLM response shape. Top-level keys: ${responseKeys || "none"}`);
      return createSafetyFallback(content);
    }

    return normalizeScamAnalysis(JSON.parse(rawContent));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    console.error(`[Satark AI] Analysis provider failed; returning a basic safety scan. ${message}`);
    return createSafetyFallback(content);
  }
}

export function createSafetyFallback(content: string): ScamAnalysis {
  const lower = content.toLowerCase();
  const tactics: string[] = [];
  const urlFindings: string[] = [];
  let score = 5;

  const addTactic = (label: string, points: number) => {
    if (!tactics.includes(label)) tactics.push(label);
    score += points;
  };

  if (/urgent|immediately|today|now|expire|blocked|suspend|जल्दी|तुरंत|आज|बंद/.test(lower)) addTactic("Fake Urgency", 26);
  if (/bank|kyc|police|government|official|rbi|income tax|बैंक|सरकार|पुलिस/.test(lower)) addTactic("Authority Impersonation", 20);
  if (/pay|payment|fee|transfer|upi|recharge|refund|पैसे|भुगतान|ट्रांसफर/.test(lower)) addTactic("Payment Pressure", 24);
  if (/otp|password|pin|cvv|credential|verify.*account|ओटीपी|पासवर्ड/.test(lower)) addTactic("OTP/Credential Request", 34);
  if (/congratulations|winner|free|reward|prize|cashback|लकी|इनाम|जीत/.test(lower)) addTactic("Too-Good-To-Be-True Offer", 20);

  const urls = content.match(/(?:https?:\/\/|www\.)[^\s]+|\b[\w-]+\.(?:com|in|net|org|info|xyz|top|click|link|ly)\b/gi) ?? [];
  for (const url of urls.slice(0, 2)) {
    if (/\b(bit\.ly|tinyurl\.com|t\.co)\b/i.test(url)) {
      urlFindings.push("Shortened links can hide the real destination. Verify it before opening.");
      score += 15;
    } else if (/\.(xyz|top|click|link)\b/i.test(url)) {
      urlFindings.push("This domain ending deserves extra verification before you sign in or pay.");
      score += 12;
    } else {
      urlFindings.push("Check that this domain exactly matches the organisation's official website.");
      score += 6;
    }
  }

  score = Math.min(100, Math.max(0, score));
  const level = riskLevelForScore(score);
  const isHindi = /[\u0900-\u097F]/.test(content);
  const isHinglish = !isHindi && /\b(hai|karo|aap|apna|jaldi|paise|bank|otp)\b/i.test(content);

  if (isHindi) {
    return { riskScore: score, riskLevel: level, tactics, urlFindings, explanation: "इस संदेश में दबाव डालने या निजी जानकारी लेने के संकेत हो सकते हैं। भेजने वाले की पहचान आधिकारिक माध्यम से अलग से जांचें।", recommendedAction: "कोई OTP, पासवर्ड या भुगतान साझा न करें। आधिकारिक वेबसाइट या नंबर से सत्यापन करें।" };
  }
  if (isHinglish) {
    return { riskScore: score, riskLevel: level, tactics, urlFindings, explanation: "Is message mein pressure ya personal information lene ke signals ho sakte hain. Sender ko official channel se alag se verify karo.", recommendedAction: "OTP, password ya payment details share mat karo. Official website ya number se verify karo." };
  }
  return { riskScore: score, riskLevel: level, tactics, urlFindings, explanation: "This message contains signals commonly used to pressure people into acting quickly or sharing sensitive information. Verify the sender through an official channel before you act.", recommendedAction: "Do not share OTPs, passwords, or payment details. Verify independently through an official website or phone number." };
}
