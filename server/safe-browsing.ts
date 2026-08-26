import type { UrlVerificationStatus } from "../shared/scam-analysis";

export type SafeBrowsingThreat = {
  url: string;
  threatType: string;
  platformType: string;
  threatEntryType: string;
};

export type SafeBrowsingLookup = {
  verification: UrlVerificationStatus;
  threats: SafeBrowsingThreat[];
};

const endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RATE_LIMIT_RETRIES = 2;
const BASE_RATE_LIMIT_DELAY_MS = 250;

function getApiKey(): string | null {
  const key = process.env.GoogleSafeBrowsing?.trim();
  return key || null;
}

function diagnosticHosts(urls: string[]): string {
  const hosts = urls.map((url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "invalid-url";
    }
  });
  return [...new Set(hosts)].join(", ");
}

function retryDelayMs(value: string | null, attempt: number): number {
  const retryAfterSeconds = Number(value);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) return Math.min(retryAfterSeconds * 1_000, 5_000);
  return Math.min(BASE_RATE_LIMIT_DELAY_MS * 2 ** attempt, 2_000);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function lookupSafeBrowsing(urls: string[]): Promise<SafeBrowsingLookup> {
  const key = getApiKey();
  const uniqueUrls = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))].slice(0, 10);
  if (!uniqueUrls.length) return { verification: "NO_THREAT_FOUND", threats: [] };
  if (!key) return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };

  const requestBody = JSON.stringify({
    client: { clientId: "satark-ai", clientVersion: "2.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: uniqueUrls.map((url) => ({ url })),
    },
  });
  const hosts = diagnosticHosts(uniqueUrls);

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal,
      });
      if (response.status === 429) {
        if (attempt < MAX_RATE_LIMIT_RETRIES) {
          const delay = retryDelayMs(response.headers.get("retry-after"), attempt);
          console.warn(`[Satark AI] Safe Browsing rate limited; verification=VERIFICATION_UNAVAILABLE; urlCount=${uniqueUrls.length}; hosts=${hosts}; retry=${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}; delayMs=${delay}.`);
          await sleep(delay);
          continue;
        }
        console.warn(`[Satark AI] Safe Browsing rate-limit retries exhausted; verification=VERIFICATION_UNAVAILABLE; urlCount=${uniqueUrls.length}; hosts=${hosts}.`);
        return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };
      }
      if (!response.ok) {
        console.warn(`[Satark AI] Safe Browsing lookup unavailable; verification=VERIFICATION_UNAVAILABLE; httpStatus=${response.status}; urlCount=${uniqueUrls.length}; hosts=${hosts}.`);
        return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };
      }
      const payload = await response.json() as { matches?: Array<{ threat: { url: string }; threatType?: string; platformType?: string; threatEntryType?: string }> };
      const threats = (payload.matches ?? []).map((match) => ({
        url: match.threat.url,
        threatType: match.threatType ?? "UNKNOWN_THREAT",
        platformType: match.platformType ?? "ANY_PLATFORM",
        threatEntryType: match.threatEntryType ?? "URL",
      }));
      const threatTypes = [...new Set(threats.map((threat) => threat.threatType))].join(", ") || "none";
      console.info(`[Satark AI] Safe Browsing verification=${threats.length ? "VERIFIED_THREAT" : "NO_THREAT_FOUND"}; urlCount=${uniqueUrls.length}; hosts=${hosts}; threatCount=${threats.length}; threatTypes=${threatTypes}.`);
      return { verification: threats.length ? "VERIFIED_THREAT" : "NO_THREAT_FOUND", threats };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      console.warn(`[Satark AI] Safe Browsing ${timedOut ? "timeout" : "request failure"}; verification=VERIFICATION_UNAVAILABLE; urlCount=${uniqueUrls.length}; hosts=${hosts}.`);
      return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };
}
