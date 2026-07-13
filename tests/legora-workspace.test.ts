import { describe, expect, it } from "vitest";
import { buildDemoLegoraWorkspace, buildResearchPlan, canExportBrief, decideBriefChange, lockPublicationReview } from "@/lib/legora-workspace";
import { workspaceIds } from "@/lib/legora-persistence";

describe("research, collaboration and evidence editor", () => {
  it("keeps taxonomy and publication versions on research plans", () => {
    const { researchPlan } = buildDemoLegoraWorkspace();
    expect(researchPlan.taxonomyVersion).toBeTruthy();
    expect(researchPlan.passages[0].authorityTier).toBe("eu_legislation");
  });

  it("resolves questions using short regulatory terms and Unicode text", () => {
    const plan = buildResearchPlan({
      id: "research:unicode",
      organisationId: null,
      publicationId: "publication:unicode",
      publicationVersionId: "version:unicode",
      taxonomyVersion: "2026.07.13",
      jurisdictions: ["EU"],
      questions: ["Does DORA govern résilience testing?"],
      passages: [{
        id: "passage:unicode",
        authorityTier: "eu_legislation",
        text: "DORA includes résilience testing obligations.",
        sourceRef: "fixture://dora",
        retrievalOrigin: "fixture",
        verification: "verified",
      }],
    });
    expect(plan.unresolvedQuestions).toEqual([]);
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
