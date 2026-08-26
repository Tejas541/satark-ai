import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lookupSafeBrowsing } from "../server/safe-browsing";

const secretEnvName = ["Google", "Safe", "Browsing"].join("");
const originalKey = process.env[secretEnvName];

describe("Safe Browsing verification resilience", () => {
  beforeEach(() => {
    process.env[secretEnvName] = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env[secretEnvName];
    else process.env[secretEnvName] = originalKey;
  });

  it("returns a verified threat with the reported type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      matches: [{ threat: { url: "https://test.example/threat" }, threatType: "MALWARE", platformType: "ANY_PLATFORM", threatEntryType: "URL" }],
    }), { status: 200 })));

    const result = await lookupSafeBrowsing(["https://test.example/threat"]);
    expect(result.verification).toBe("VERIFIED_THREAT");
    expect(result.threats).toMatchObject([{ threatType: "MALWARE", url: "https://test.example/threat" }]);
  });

  it("returns a neutral no-threat result without claiming URL safety", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    const result = await lookupSafeBrowsing(["https://example.com/document"]);
    expect(result).toEqual({ verification: "NO_THREAT_FOUND", threats: [] });
  });

  it("returns unavailable for generic request failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const result = await lookupSafeBrowsing(["https://example.com/document"]);
    expect(result).toEqual({ verification: "VERIFICATION_UNAVAILABLE", threats: [] });
  });

  it("returns unavailable for timeout-style aborts without converting the URL to safe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));

    const result = await lookupSafeBrowsing(["https://example.com/document"]);
    expect(result).toEqual({ verification: "VERIFICATION_UNAVAILABLE", threats: [] });
  });

  it("retries a bounded number of times after rate limits and then returns unavailable", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "0" } }));
    vi.stubGlobal("fetch", mockedFetch);

    const result = await lookupSafeBrowsing(["https://example.com/document"]);
    expect(result).toEqual({ verification: "VERIFICATION_UNAVAILABLE", threats: [] });
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });

  it("deduplicates multiple URLs before one bounded threat-match request", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", mockedFetch);

    await lookupSafeBrowsing(["https://example.com/a", "https://example.com/a", "https://example.org/b"]);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.threatInfo.threatEntries).toEqual([{ url: "https://example.com/a" }, { url: "https://example.org/b" }]);
  });
});
