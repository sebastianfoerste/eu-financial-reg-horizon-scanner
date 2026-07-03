import { describe, expect, it } from "vitest";

import { assessSourceHierarchy, inferSourceAuthorityLevel } from "@/lib/source-hierarchy";

const now = new Date("2026-06-12T12:00:00.000Z");

describe("source hierarchy", () => {
  it("allows reviewed current binding sources to support external alert drafts", () => {
    expect(
      assessSourceHierarchy(
        {
          authorityLevel: "binding_law",
          retrievedAt: "2026-06-12T08:00:00.000Z",
          reviewedAt: "2026-06-12T09:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({
      status: "verified_current",
      blocksExternalAlert: false,
    });
  });

  it("blocks legal commentary from carrying an external alert alone", () => {
    expect(
      assessSourceHierarchy(
        {
          authorityLevel: "legal_commentary",
          reviewedAt: "2026-06-12T09:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({
      status: "context_only",
      blocksExternalAlert: true,
      requiresPrimarySource: true,
    });
  });

  it("marks superseded or stale primary sources as blockers", () => {
    expect(
      assessSourceHierarchy(
        {
          authorityLevel: "supervisory_material",
          reviewedAt: "2026-04-01T09:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({
      status: "stale",
      blocksExternalAlert: true,
    });

    expect(
      assessSourceHierarchy(
        {
          authorityLevel: "binding_law",
          reviewedAt: "2026-06-12T09:00:00.000Z",
          superseded: true,
        },
        now,
      ),
    ).toMatchObject({
      status: "stale",
      blocksExternalAlert: true,
    });
  });

  it("maps official source codes conservatively", () => {
    expect(inferSourceAuthorityLevel("eurlex")).toBe("binding_law");
    expect(inferSourceAuthorityLevel("esma")).toBe("supervisory_material");
    expect(inferSourceAuthorityLevel("unknown-newsletter")).toBe("legal_commentary");
  });
});
