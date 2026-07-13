import { describe, expect, it } from "vitest";

import { buildBriefingDossier } from "@/lib/briefing-dossier";
import { mockPublications } from "@/lib/mock-data";
import { buildPilotBriefing } from "@/lib/pilot-briefing";
import { demoProductMap, type ProductMapView } from "@/lib/product-maps";
import type { ReviewQueueView } from "@/lib/review";

function reviewItem(publication = mockPublications[0]): ReviewQueueView {
  return {
    id: `review-${publication.id}`,
    publicationId: publication.id,
    status: "APPROVED",
    priority: publication.impactScore,
    reviewerName: "Reviewer",
    decisionReason: "Reviewed source metadata.",
    updatedAt: "2026-07-10T08:00:00.000Z",
    publication,
    revisions: [],
  };
}

function productMap(): ProductMapView {
  return {
    ...demoProductMap,
    organisationName: "Demo organisation",
    updatedAt: "2026-07-10T08:00:00.000Z",
    confirmationRequired: false,
    lastConfirmedAt: "2026-07-09T08:00:00.000Z",
    nextConfirmationDueAt: "2026-10-09T08:00:00.000Z",
    confirmedByName: "Reviewer",
  };
}

describe("briefing dossier", () => {
  it("creates a deterministic internal decision artifact without raw publication text", () => {
    const sourceFreshness = { current: 5, due: 0, stale: 0, pollable: 2 };
    const productMapReadiness = { ready: true, blockingMaps: [] };
    const briefing = buildPilotBriefing({
      publications: [mockPublications[0]],
      reviewItems: [reviewItem()],
      alerts: [],
      sourceFreshness,
      productMapReadiness,
      productMaps: [productMap()],
      generatedAt: new Date("2026-07-10T08:00:00.000Z"),
    });

    const dossier = buildBriefingDossier({ briefing, sourceFreshness, productMapReadiness });
    const repeated = buildBriefingDossier({ briefing, sourceFreshness, productMapReadiness });
    const serialized = JSON.stringify(dossier);

    expect(dossier.schema).toBe("horizon-scanner.briefing-dossier.v1");
    expect(dossier.external_action_allowed).toBe(false);
    expect(dossier.distribution.client_delivery_allowed).toBe(false);
    expect(dossier.integrity.digest).toHaveLength(64);
    expect(dossier.integrity.digest).toBe(repeated.integrity.digest);
    expect(dossier.risk_register[0]).toMatchObject({
      publication_id: mockPublications[0].id,
      source_code: mockPublications[0].sourceCode,
    });
    expect(serialized).not.toContain(mockPublications[0].bodyText);
  });
});
