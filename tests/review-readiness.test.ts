import { describe, expect, it } from "vitest";

import { summarizeReviewReadiness } from "@/lib/review-readiness";
import type { ReviewQueueView } from "@/lib/review";
import { mockPublications } from "@/lib/mock-data";

function item(partial: Partial<ReviewQueueView> = {}): ReviewQueueView {
  return {
    id: "review-1",
    publicationId: "pub-1",
    status: "APPROVED",
    priority: 90,
    reviewerName: "Sebastian",
    decisionReason: "Reviewed.",
    updatedAt: "2026-05-28T09:00:00.000Z",
    publication: mockPublications[0],
    revisions: [],
    ...partial,
  };
}

describe("review readiness", () => {
  it("allows approved publications with taxonomy and impact data into alert drafting", () => {
    const readiness = summarizeReviewReadiness(item());

    expect(readiness.readyForAlertDraft).toBe(true);
    expect(readiness.blockingCount).toBe(0);
    expect(readiness.checks.find((check) => check.key === "decision")).toMatchObject({
      status: "PASS",
    });
  });

  it("blocks unapproved or unclassified publications", () => {
    const readiness = summarizeReviewReadiness(
      item({
        status: "IN_REVIEW",
        publication: {
          ...mockPublications[0],
          taxonomyVersion: "unclassified",
          tags: {
            regulationFamilies: [],
            activities: [],
            licenceTypes: [],
            topicPaths: [],
            jurisdictions: [],
          },
        },
      }),
    );

    expect(readiness.readyForAlertDraft).toBe(false);
    expect(readiness.blockingCount).toBe(3);
    expect(readiness.checks.map((check) => [check.key, check.status])).toContainEqual(["decision", "BLOCK"]);
    expect(readiness.checks.map((check) => [check.key, check.status])).toContainEqual(["taxonomy", "BLOCK"]);
    expect(readiness.checks.map((check) => [check.key, check.status])).toContainEqual(["coverage", "BLOCK"]);
  });

  it("warns on low confidence and missing service routing without blocking review completion", () => {
    const readiness = summarizeReviewReadiness(
      item({
        publication: {
          ...mockPublications[0],
          confidence: 0.41,
          serviceOfferingIds: [],
        },
      }),
    );

    expect(readiness.readyForAlertDraft).toBe(true);
    expect(readiness.warningCount).toBe(2);
    expect(readiness.checks.map((check) => [check.key, check.status])).toContainEqual(["confidence", "WARN"]);
    expect(readiness.checks.map((check) => [check.key, check.status])).toContainEqual(["services", "WARN"]);
  });
});
