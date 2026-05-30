import { describe, expect, it } from "vitest";

import type { AlertView } from "@/lib/alerts";
import { mockPublications } from "@/lib/mock-data";
import { buildPilotBriefing } from "@/lib/pilot-briefing";
import { demoProductMap, type ProductMapView } from "@/lib/product-maps";
import type { ReviewQueueView } from "@/lib/review";

function reviewItem(
  publication = mockPublications[0],
  partial: Partial<ReviewQueueView> = {},
): ReviewQueueView {
  return {
    id: `review-${publication.id}`,
    publicationId: publication.id,
    status: "APPROVED",
    priority: publication.impactScore,
    reviewerName: "Sebastian",
    decisionReason: "Reviewed.",
    updatedAt: "2026-05-28T08:00:00.000Z",
    publication,
    revisions: [],
    ...partial,
  };
}

function productMap(partial: Partial<ProductMapView> = {}): ProductMapView {
  return {
    ...demoProductMap,
    organisationName: "Demo organisation",
    updatedAt: "2026-05-28T08:00:00.000Z",
    confirmationRequired: false,
    lastConfirmedAt: "2026-05-27T08:00:00.000Z",
    nextConfirmationDueAt: "2026-08-27T08:00:00.000Z",
    confirmedByName: "Sebastian",
    ...partial,
  };
}

function alert(partial: Partial<AlertView> = {}): AlertView {
  return {
    id: "alert-1",
    organisationId: "demo-org",
    organisationName: "Demo organisation",
    publicationId: mockPublications[0].id,
    publicationTitle: mockPublications[0].title,
    publicationSource: mockPublications[0].sourceCode,
    channel: "EMAIL_REALTIME",
    status: "APPROVED",
    scheduledFor: "2026-05-28T08:00:00.000Z",
    approvedAt: "2026-05-28T08:10:00.000Z",
    approvedByName: "Sebastian",
    sentAt: null,
    errorMessage: null,
    payload: {
      subject: "Approved alert",
      text: "Reviewed alert draft.",
      title: mockPublications[0].title,
      sourceUrl: mockPublications[0].sourceUrl,
      publicationUrl: `/publications/${mockPublications[0].id}`,
      impactBucket: mockPublications[0].impactBucket,
      impactScore: mockPublications[0].impactScore,
      serviceOfferingIds: mockPublications[0].serviceOfferingIds,
    },
    deliveryAttempts: [],
    ...partial,
  };
}

describe("pilot briefing", () => {
  it("prioritises source and review blockers in the briefing actions", () => {
    const briefing = buildPilotBriefing({
      publications: mockPublications,
      reviewItems: [reviewItem(mockPublications[0]), reviewItem(mockPublications[1], { status: "PENDING" })],
      alerts: [alert({ status: "DRAFT" })],
      sourceFreshness: { current: 4, due: 1, stale: 1, pollable: 2 },
      productMapReadiness: { ready: true, blockingMaps: [] },
      productMaps: [productMap()],
      generatedAt: new Date("2026-05-28T08:00:00.000Z"),
    });

    expect(briefing.status).toBe("ACTION_REQUIRED");
    expect(briefing.actions.map((action) => action.key).slice(0, 3)).toEqual(["sources", "review", "approve"]);
    expect(briefing.metrics.sourceSlaBlockers).toBe(1);
    expect(briefing.metrics.reviewBlocked).toBe(1);
  });

  it("surfaces approved alerts as ready to send when blockers are clear", () => {
    const briefing = buildPilotBriefing({
      publications: [mockPublications[0]],
      reviewItems: [reviewItem(mockPublications[0])],
      alerts: [alert({ status: "APPROVED" })],
      sourceFreshness: { current: 5, due: 0, stale: 0, pollable: 0 },
      productMapReadiness: { ready: true, blockingMaps: [] },
      productMaps: [productMap()],
      generatedAt: new Date("2026-05-28T08:00:00.000Z"),
    });

    expect(briefing.status).toBe("READY_TO_SEND");
    expect(briefing.actions[0]).toMatchObject({ key: "send", tone: "urgent" });
    expect(briefing.narrative.at(-1)).toBe("All delivery remains review-gated and requires an explicit send action.");
  });

  it("keeps a sorted risk queue for relevant publications", () => {
    const briefing = buildPilotBriefing({
      publications: mockPublications,
      reviewItems: mockPublications.map((publication) => reviewItem(publication)),
      alerts: [],
      sourceFreshness: { current: 5, due: 0, stale: 0, pollable: 0 },
      productMapReadiness: { ready: true, blockingMaps: [] },
      productMaps: [productMap()],
      generatedAt: new Date("2026-05-28T08:00:00.000Z"),
    });

    expect(briefing.riskQueue.map((item) => item.impactScore)).toEqual([82, 64]);
    expect(briefing.metrics.serviceOfferings).toBeGreaterThan(0);
    expect(briefing.metrics.criticalProductLines).toBe(1);
  });
});
