import { describe, expect, it } from "vitest";

import { buildRegulatoryActionPacket } from "@/lib/regulatory-action-packet";
import type { ReviewQueueView } from "@/lib/review";
import type { SourceDiligenceView } from "@/lib/source-diligence";

const reviewItem: ReviewQueueView = {
  id: "review-1",
  publicationId: "publication-1",
  status: "APPROVED",
  priority: 90,
  reviewerName: "Reviewer",
  decisionReason: "Reviewed source metadata.",
  updatedAt: "2026-06-16T09:00:00.000Z",
  revisions: [],
  publication: {
    id: "publication-1",
    title: "ESMA supervisory update",
    sourceCode: "esma",
    sourceName: "ESMA",
    sourceUrl: "https://www.esma.europa.eu/supervisory-update",
    publicationType: "supervisory_statement",
    publishedAt: "2026-06-16T08:00:00.000Z",
    fetchedAt: "2026-06-16T08:05:00.000Z",
    language: "en",
    bodyText: "RAW PUBLICATION BODY MUST NOT ENTER THE ACTION PACKET",
    tags: {
      regulationFamilies: ["micar"],
      activities: ["crypto_asset_service"],
      licenceTypes: ["casp_micar"],
      topicPaths: ["digital_assets_specific.white_paper_review"],
      jurisdictions: ["eu"],
    },
    confidence: 0.91,
    classifierModel: "deterministic",
    classifierVersion: "v1",
    classifierStatus: "STUB",
    classifierError: null,
    taxonomyVersion: "2026.05.27",
    deadline: null,
    impactBucket: "HIGH",
    impactScore: 88,
    summary: "Reviewed metadata summary.",
    whatChanged: "A supervisory position changed.",
    whoIsAffected: "Crypto asset service providers.",
    recommendedAction: "Review MiCA white paper processes.",
    serviceOfferingIds: ["gc_micar_white_paper"],
    rawHash: "raw-hash",
    scoreRationale: "Matched MiCA tags.",
    matchedLicences: ["casp_micar"],
    matchedActivities: ["crypto_asset_service"],
    matchedJurisdictions: ["eu"],
    matchedHomeJurisdictions: [],
    matchedPassportJurisdictions: ["eu"],
    matchedTopics: ["digital_assets_specific.white_paper_review"],
    criticalProductLineMatched: false,
    rawImpactScore: 88,
    impactFloorAdjustment: 0,
    scoringRuleVersion: "mvp-seed-v0",
  },
};

const sourceDiligence: SourceDiligenceView = {
  id: "diligence-esma",
  sourceId: "esma",
  sourceCode: "esma",
  sourceName: "ESMA",
  baseUrl: "https://www.esma.europa.eu",
  reuseStatus: "ATTRIBUTION_REQUIRED",
  attributionRequirement: "Attribute ESMA.",
  robotsNotes: null,
  allowedCadenceMin: 60,
  lastReviewedAt: "2026-06-01T00:00:00.000Z",
  nextReviewAt: "2026-09-01T00:00:00.000Z",
  ownerNotes: null,
  lastFetchedAt: "2026-06-16T08:00:00.000Z",
  lastRun: { status: "OK", finishedAt: "2026-06-16T08:00:00.000Z", message: null },
};

describe("regulatory action packet", () => {
  it("builds approved metadata packets without raw body text", () => {
    const packet = buildRegulatoryActionPacket({
      reviewItem,
      sourceDiligence,
      alertProofPackets: [
        {
          gateStatus: "ready_for_delivery",
          sourceReviewState: "verified_current",
          payloadDigest: "digest-1",
          reasons: [],
          createdAt: "2026-06-16T09:10:00.000Z",
        },
      ],
      generatedAt: "2026-06-16T09:15:00.000Z",
    });

    const json = JSON.stringify(packet);

    expect(packet.schema).toBe("horizon-scanner.regulatory-action-packet.v1");
    expect(packet.review_gate.ready_for_alert_draft).toBe(true);
    expect(packet.alert_eligibility.eligible).toBe(true);
    expect(packet.source_status.authority_level).toBe("supervisory_material");
    expect(packet.digest).toHaveLength(64);
    expect(json).not.toContain("RAW PUBLICATION BODY MUST NOT ENTER THE ACTION PACKET");
  });

  it("surfaces blocked alert proof packets as action blockers", () => {
    const packet = buildRegulatoryActionPacket({
      reviewItem,
      sourceDiligence,
      alertProofPackets: [
        {
          gateStatus: "blocked",
          sourceReviewState: "stale",
          payloadDigest: "digest-2",
          reasons: ["Source review is older than 45 days."],
          createdAt: "2026-06-16T09:10:00.000Z",
        },
      ],
      generatedAt: "2026-06-16T09:15:00.000Z",
    });

    expect(packet.alert_eligibility.eligible).toBe(false);
    expect(packet.blockers).toContain("alert-proof-blocked");
    expect(packet.alert_eligibility.reasons).toEqual(["Source review is older than 45 days."]);
  });
});
