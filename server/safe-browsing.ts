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

function getApiKey(): string | null {
  const key = process.env.GoogleSafeBrowsing?.trim();
  return key || null;
}

export async function lookupSafeBrowsing(urls: string[]): Promise<SafeBrowsingLookup> {
  const key = getApiKey();
  const uniqueUrls = [...new Set(urls.filter((url) => /^https?:\/\//i.test(url)))].slice(0, 10);
  if (!uniqueUrls.length) return { verification: "NO_THREAT_FOUND", threats: [] };
  if (!key) return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };

  try {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "satark-ai", clientVersion: "2.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: uniqueUrls.map((url) => ({ url })),
        },
      }),
    });
    if (!response.ok) {
      console.warn(`[Satark AI] Safe Browsing lookup unavailable (HTTP ${response.status}) for ${uniqueUrls.length} URL(s).`);
      return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };
    }
    const payload = await response.json() as { matches?: Array<{ threat: { url: string }; threatType?: string; platformType?: string; threatEntryType?: string }> };
    const threats = (payload.matches ?? []).map((match) => ({
      url: match.threat.url,
      threatType: match.threatType ?? "UNKNOWN_THREAT",
      platformType: match.platformType ?? "ANY_PLATFORM",
      threatEntryType: match.threatEntryType ?? "URL",
    }));
    console.info(`[Satark AI] Safe Browsing checked ${uniqueUrls.length} URL(s); ${threats.length} threat match(es).`);
    return { verification: threats.length ? "VERIFIED_THREAT" : "NO_THREAT_FOUND", threats };
  } catch {
    console.warn(`[Satark AI] Safe Browsing request failed for ${uniqueUrls.length} URL(s); continuing without reputation evidence.`);
    return { verification: "VERIFICATION_UNAVAILABLE", threats: [] };
  }
}
