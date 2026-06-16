import { describe, expect, it } from "vitest";

import {
  alertProofPacketInputFromRecord,
  alertProofPacketPersistence,
  buildAlertProofPacket,
  summarizeAlertProofPacket,
} from "@/lib/alert-proof-packet";

const now = new Date("2026-06-13T09:00:00.000Z");

describe("alert proof packet", () => {
  it("blocks external delivery when source review or recipient approval is missing", async () => {
    const packet = await buildAlertProofPacket(
      {
        alertId: "alert-1",
        publicationTitle: "Draft RTS update",
        channel: "EMAIL_REALTIME",
        source: {
          title: "Commentary note",
          url: "https://example.test/commentary",
          authorityLevel: "legal_commentary",
        },
        payload: {
          subject: "Regulatory alert",
          text: "Draft alert text",
          recipient: null,
        },
      },
      now,
    );

    expect(packet.schema).toBe("horizon-scanner.alert-proof-packet.v1");
    expect(packet.externalSendAllowed).toBe(false);
    expect(packet.reviewerState).toBe("missing");
    expect(packet.recipientState).toBe("missing");
    expect(packet.httpsSourceCheck).toBe(true);
    expect(packet.reviewGate.status).toBe("blocked");
    expect(packet.reviewGate.reasons).toContain("Email alert has no approved recipient.");
    expect(packet.sourceStatus).toBe("context_only");
  });

  it("allows delivery only after source, recipient and review gates pass", async () => {
    const packet = await buildAlertProofPacket(
      {
        alertId: "alert-2",
        publicationTitle: "Final RTS update",
        channel: "EMAIL_REALTIME",
        source: {
          title: "Official journal source",
          url: "https://eur-lex.europa.eu/legal-content/EN/TXT/",
          authorityLevel: "binding_law",
          reviewedAt: "2026-06-13T08:00:00.000Z",
        },
        payload: {
          subject: "Regulatory alert",
          text: "Reviewed alert text",
          recipient: "reviewed@example.test",
        },
        approvedByName: "Reviewer",
        approvedAt: "2026-06-13T08:30:00.000Z",
      },
      now,
    );

    expect(packet.externalSendAllowed).toBe(true);
    expect(packet.reviewGate.reasons).toEqual([]);
    expect(packet.payloadDigest).toHaveLength(64);
  });

  it("projects alert records into digest-only proof summaries", async () => {
    const packet = await buildAlertProofPacket(
      alertProofPacketInputFromRecord({
        id: "alert-3",
        publication: {
          title: "ESMA Q&A update",
          sourceUrl: "https://www.esma.europa.eu/esma-qa-search-page/all",
          source: {
            code: "esma",
            displayName: "ESMA",
            diligenceRecords: [{ lastReviewedAt: "2026-06-13T08:00:00.000Z" }],
          },
        },
        channel: "SLACK",
        approvedByName: "Reviewer",
        approvedAt: "2026-06-13T08:30:00.000Z",
        payload: {
          subject: "Reviewed alert",
          text: "CONFIDENTIAL ALERT BODY SHOULD NOT BE STORED IN SUMMARY",
        },
      }),
      now,
    );

    const summary = summarizeAlertProofPacket(packet);
    const persisted = alertProofPacketPersistence(packet);
    const summaryJson = JSON.stringify(summary);

    expect(packet.externalSendAllowed).toBe(true);
    expect(summary.payloadDigest).toHaveLength(64);
    expect(summary.source.authorityLevel).toBe("supervisory_material");
    expect(persisted).toMatchObject({
      sourceAuthority: "supervisory_material",
      sourceReviewState: "verified_current",
      reviewerState: "approved",
      recipientState: "not_required",
      httpsSourceCheck: true,
      gateStatus: "ready_for_delivery",
    });
    expect(summaryJson).not.toContain("CONFIDENTIAL ALERT BODY SHOULD NOT BE STORED IN SUMMARY");
  });
});
