import { describe, expect, it } from "vitest";

import type { AlertView } from "@/lib/alerts";
import { buildHorizonReviewTable } from "@/lib/horizon-review-table";
import { mockPublications } from "@/lib/mock-data";
import type { ReviewQueueView } from "@/lib/review";
import type { SourceDiligenceView } from "@/lib/source-diligence";

const now = new Date("2026-06-13T09:00:00.000Z");

function sourceDiligenceFor(sourceCode: string): SourceDiligenceView {
  return {
    id: `source-diligence-${sourceCode}`,
    sourceId: sourceCode,
    sourceCode,
    sourceName: sourceCode.toUpperCase(),
    baseUrl: "https://example.test",
    reuseStatus: "ATTRIBUTION_REQUIRED",
    attributionRequirement: "Attribute source.",
    robotsNotes: "Fixture source.",
    allowedCadenceMin: 60,
    lastReviewedAt: "2026-06-13T08:00:00.000Z",
    nextReviewAt: "2026-09-13T08:00:00.000Z",
    ownerNotes: null,
    lastFetchedAt: "2026-06-13T08:30:00.000Z",
    lastRun: { status: "OK", finishedAt: "2026-06-13T08:30:00.000Z", message: null },
  };
}

function reviewItem(index: number, status: ReviewQueueView["status"]): ReviewQueueView {
  const publication = mockPublications[index];
  return {
    id: `review-${publication.id}`,
    publicationId: publication.id,
    status,
    priority: publication.impactScore,
    reviewerName: status === "APPROVED" ? "Sebastian" : null,
    decisionReason: null,
    updatedAt: now.toISOString(),
    publication,
    revisions: [],
  };
}

function alertFor(index: number): AlertView {
  const publication = mockPublications[index];
  return {
    id: `alert-${publication.id}`,
    organisationId: "demo-org",
    organisationName: "Demo organisation",
    publicationId: publication.id,
    publicationTitle: publication.title,
    publicationSource: publication.sourceCode,
    channel: "SLACK",
    status: "APPROVED",
    scheduledFor: now.toISOString(),
    approvedAt: now.toISOString(),
    approvedByName: "Sebastian",
    sentAt: null,
    errorMessage: null,
    payload: {
      subject: publication.title,
      text: publication.summary,
      title: publication.title,
      sourceUrl: publication.sourceUrl,
      publicationUrl: `/publications/${publication.id}`,
      impactBucket: publication.impactBucket,
      impactScore: publication.impactScore,
      serviceOfferingIds: publication.serviceOfferingIds,
    },
    deliveryAttempts: [],
    proofPackets: [
      {
        id: `packet-${publication.id}`,
        createdAt: now.toISOString(),
        sourceAuthority: "supervisory_material",
        sourceReviewState: "verified_current",
        reviewerState: "approved",
        recipientState: "not_required",
        httpsSourceCheck: true,
        gateStatus: "ready_for_delivery",
        payloadDigest: "a".repeat(64),
        reasons: [],
      },
    ],
  };
}

describe("horizon review table", () => {
  it("keeps alert delivery blocked until review and proof gates are satisfied", () => {
    const publications = mockPublications.slice(0, 2);
    const table = buildHorizonReviewTable({
      publications,
      reviewItems: [reviewItem(0, "APPROVED"), reviewItem(1, "IN_REVIEW")],
      alerts: [alertFor(0)],
      sourceDiligence: publications.map((publication) => sourceDiligenceFor(publication.sourceCode)),
      deliveryReadiness: {
        ready: true,
        message: "Active product maps are confirmed for alert routing.",
        blockingMaps: [],
      },
      now,
    });

    const readyRow = table.rows.find((row) => row.publicationId === publications[0].id);
    const blockedRow = table.rows.find((row) => row.publicationId === publications[1].id);

    expect(table.summary.totalRows).toBe(2);
    expect(readyRow).toMatchObject({
      proofPacketStatus: "ready",
      citationCoverage: "complete",
      deliveryStatus: "ready_for_delivery",
      reviewerQueuePosition: 2,
      reviewerDecision: "Approved publication row. Decision reason should be recorded before delivery.",
    });
    expect(readyRow?.playbook).toMatchObject({
      jurisdiction: "EU",
      externalActionAllowed: false,
    });
    expect(readyRow?.citations.some((citation) => citation.sourceClass === "regulator_publication")).toBe(true);
    expect(readyRow?.citations.some((citation) => citation.sourceClass === "proof_packet" && citation.verified)).toBe(true);
    expect(readyRow?.cells).toHaveLength(11);
    expect(readyRow?.cells.every((cell) => cell.externalActionAllowed === false)).toBe(true);
    expect(readyRow?.cells.find((cell) => cell.columnId === "delivery_status")).toMatchObject({
      value: "ready_for_delivery",
      status: "complete",
    });
    expect(blockedRow?.deliveryStatus).toBe("blocked");
    expect(blockedRow?.reviewerQueuePosition).toBe(1);
    expect(blockedRow?.blockers).toContain("Human review approval missing.");
    expect(blockedRow?.blockers).toContain("Reviewed alert draft has not been generated.");
    expect(blockedRow?.cells.find((cell) => cell.columnId === "delivery_status")?.status).toBe("blocked");
    expect(table.controlProfile.schema).toBe("horizon-scanner.alert-review-control.v1");
    expect(table.controlProfile.externalActionAllowed).toBe(false);
    expect(table.controlProfile.workflowRoutes.at(-1)).toMatchObject({
      key: "external-delivery",
      status: "blocked",
    });
    expect(table.reviewTableScale).toMatchObject({
      schema: "horizon-scanner.review-table-scale.v1",
      rowCount: 2,
      columnCount: 11,
      estimatedCellTasks: 22,
      maxVaultDocuments: 100_000,
    });
    expect(table.reviewTableScale.columnIds).toContain("delivery_status");
    expect(table.reviewTableScale.resetStrategy).toContain("separate cell task");
    expect(table.controlProfile.sourceConnectors.some((connector) => connector.key === "product-map")).toBe(true);
    expect(table.controlProfile.futureBulkExtractionPolicy).toMatchObject({
      enabled: false,
      runner: "inngest",
      concurrencyPerOrganisationOrSourceGroup: 1,
      deliverySideEffectsAllowed: false,
    });
    expect(table.controlProfile.futureBulkExtractionPolicy.idempotencyKeyParts).toEqual([
      "publication_id",
      "column_id",
      "source_hash",
      "prompt_version",
    ]);
    expect(table.promptBrief.schema).toBe("horizon-scanner.alert-prompt-brief.v1");
    expect(table.promptBrief.suggestedPrompt).toContain("Review gate: draft only");
    expect(table.promptBrief.failureConditions).toContain("Human review approval missing.");
    expect(table.monitorProfile.schema).toBe("horizon-scanner.monitor-review");
    expect(table.monitorProfile.vendorIntegration).toBe("none");
    expect(table.monitorProfile.externalActionAllowed).toBe(false);
    expect(table.monitorProfile.tabularReview.externalActionAllowed).toBe(false);
    expect(table.monitorProfile.trustedSources.sourceMode).toBe("public_regulator_sources");
    expect(table.monitorProfile.monitors.regulatoryPerimeter).toContain("MiCAR");
    expect(table.monitorProfile.portalRoom.externalGuestAccessAllowed).toBe(false);
    expect(table.monitorProfile.securityGovernance.approvalGate).toBe("required_for_alert_delivery");
    expect(table.monitorProfile.lists.items.length).toBeGreaterThan(0);
    expect(table.monitorProfile.workspaceProfile.schema).toBe("horizon-scanner.monitor-workspace.v1");
    expect(table.monitorProfile.workspaceProfile.externalActionAllowed).toBe(false);
    expect(table.workspaceProfile.sourceControls).toContain("regulator_publication");
    expect(table.workspaceProfile.deliveryGate).toBe("blocked_without_review");
    expect(table.monitorProfile.reviewLayers.map((layer) => layer.key)).toContain("security_governance");
    expect(table.monitorProfile.reviewNotice).toContain("draft-only until reviewed delivery approval");
  });
});
