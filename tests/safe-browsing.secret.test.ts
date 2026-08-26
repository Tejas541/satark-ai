import { describe, expect, it } from "vitest";

import { lookupSafeBrowsing } from "../server/safe-browsing";

describe("Google Safe Browsing secret", () => {
  it("authorizes a harmless server-side URL lookup", async () => {
    const result = await lookupSafeBrowsing(["https://example.com/"]);
    expect(result.verification).toBe("NO_THREAT_FOUND");
    expect(result.threats).toEqual([]);
  }, 20_000);
});
