import { describe, it, expect } from "vitest";
import { decideAiDraftAccess } from "@/lib/ai/draft-access";

describe("decideAiDraftAccess", () => {
  it("allows paid plans without touching credits", () => {
    expect(decideAiDraftAccess("pro", 0)).toEqual({ allowed: true, reserveCredit: false });
    expect(decideAiDraftAccess("team", 0)).toEqual({ allowed: true, reserveCredit: false });
  });
  it("allows free with a credit and requires reservation", () => {
    expect(decideAiDraftAccess("free", 1)).toEqual({ allowed: true, reserveCredit: true });
  });
  it("blocks free with zero credits", () => {
    expect(decideAiDraftAccess("free", 0)).toEqual({ allowed: false, reserveCredit: false });
  });
});
