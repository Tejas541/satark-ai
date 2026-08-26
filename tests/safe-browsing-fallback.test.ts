import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupSafeBrowsing } from "../server/safe-browsing";

describe("Safe Browsing graceful fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns unavailable rather than claiming an unchecked URL is safe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const result = await lookupSafeBrowsing(["https://example.com/document"]);
    expect(result).toEqual({ verification: "VERIFICATION_UNAVAILABLE", threats: [] });
  });
});
