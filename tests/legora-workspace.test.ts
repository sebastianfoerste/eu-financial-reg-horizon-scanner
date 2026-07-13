import { describe, expect, it } from "vitest";
import { buildDemoLegoraWorkspace, canExportBrief, decideBriefChange, lockPublicationReview } from "@/lib/legora-workspace";
import { workspaceIds } from "@/lib/legora-persistence";

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

  it("derives isolated persistence identifiers for each organisation", () => {
    const first = workspaceIds({ userId: "user:1", organisationId: "org:one", mode: "clerk", isInternalOperator: false, displayName: "One" });
    const second = workspaceIds({ userId: "user:2", organisationId: "org:two", mode: "clerk", isInternalOperator: false, displayName: "Two" });

    expect(first.planId).not.toBe(second.planId);
    expect(first.reviewId).not.toBe(second.reviewId);
    expect(first.briefId).not.toBe(second.briefId);
  });
});
