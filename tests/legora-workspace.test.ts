import { describe, expect, it } from "vitest";
import { buildDemoLegoraWorkspace, canExportBrief, decideBriefChange, lockPublicationReview } from "@/lib/legora-workspace";

describe("research, collaboration and evidence editor", () => {
  it("keeps taxonomy and publication versions on research plans", () => {
    const { researchPlan } = buildDemoLegoraWorkspace();
    expect(researchPlan.taxonomyVersion).toBeTruthy();
    expect(researchPlan.passages[0].authorityTier).toBe("eu_legislation");
  });

  it("rejects stale review locks", () => {
    const { collaboration } = buildDemoLegoraWorkspace();
    const locked = lockPublicationReview({ collaboration, actor: "Reviewer", expectedRevision: 1, now: new Date("2026-07-13T10:00:00Z") });
    expect(() => lockPublicationReview({ collaboration: locked, actor: "Other", expectedRevision: 1, now: new Date("2026-07-13T10:01:00Z") })).toThrow("409 Conflict");
  });

  it("keeps editor export behind evidence and approval", () => {
    const { editor } = buildDemoLegoraWorkspace();
    const decided = decideBriefChange(editor, editor.changes[0].id, "accepted");
    expect(canExportBrief(decided)).toBe(false);
    expect(canExportBrief({ ...decided, reviewerApproved: true })).toBe(true);
    expect(decided.externalDeliveryAllowed).toBe(false);
  });
});
