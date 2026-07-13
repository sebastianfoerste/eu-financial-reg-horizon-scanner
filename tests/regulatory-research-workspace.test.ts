import { describe, expect, it } from "vitest";

import {
  buildDemoResearchWorkspace,
  buildRegulatoryKnowledgeBase,
  researchRegulatoryImpact,
} from "../src/lib/regulatory-research-workspace";

describe("regulatory research workspace", () => {
  it("builds a source-status-aware knowledge base", () => {
    const { knowledgeBase } = buildDemoResearchWorkspace();
    expect(knowledgeBase.authorities).toEqual(["ESMA", "EBA"]);
    expect(knowledgeBase.verifiedCount).toBe(1);
    expect(knowledgeBase.openReviewCount).toBe(1);
    expect(knowledgeBase.topicIndex.DORA).toEqual(["pub-eba-dora"]);
  });

  it("returns cited impact research and keeps delivery blocked", () => {
    const { answer } = buildDemoResearchWorkspace();
    expect(answer.citations).toHaveLength(2);
    expect(answer.status).toBe("review_required");
    expect(answer.reviewRequired).toBe(true);
    expect(answer.deliveryAllowed).toBe(false);
  });

  it("fails closed when the knowledge base has no matching source", () => {
    const answer = researchRegulatoryImpact(buildRegulatoryKnowledgeBase([]), "unknown topic");
    expect(answer.status).toBe("insufficient_sources");
    expect(answer.citations).toEqual([]);
  });

  it("creates a shared impact space with role-specific access", () => {
    const { sharedSpace } = buildDemoResearchWorkspace();
    expect(sharedSpace.participants.map((participant) => participant.role)).toEqual([
      "legal_owner",
      "compliance_reviewer",
      "product_owner",
    ]);
    expect(sharedSpace.decisionState).toBe("draft");
    expect(sharedSpace.externalDeliveryAllowed).toBe(false);
  });
});
