import {
  assessSourceHierarchy,
  inferSourceAuthorityLevel,
  type SourceAuthorityLevel,
  type SourceVerificationStatus,
} from "@/lib/source-hierarchy";

export type AlertProofPacketInput = {
  alertId: string;
  publicationTitle: string;
  channel:
    | "EMAIL_REALTIME"
    | "EMAIL_DIGEST_DAILY"
    | "EMAIL_DIGEST_WEEKLY"
    | "SLACK"
    | "MS_TEAMS"
    | "HUBSPOT"
    | "IN_APP"
    | "WEBHOOK";
  source: {
    title: string;
    url: string;
    authorityLevel: SourceAuthorityLevel;
    reviewedAt?: string | null;
    superseded?: boolean;
  };
  payload: {
    subject: string;
    text: string;
    recipient?: string | null;
  };
  approvedByName?: string | null;
  approvedAt?: string | null;
};

export type AlertProofPacket = {
  schema: "horizon-scanner.alert-proof-packet.v1";
  generatedAt: string;
  alertId: string;
  publicationTitle: string;
  channel: AlertProofPacketInput["channel"];
  sourceStatus: SourceVerificationStatus;
  externalSendAllowed: boolean;
  sourceAuthority: SourceAuthorityLevel;
  reviewerState: "approved" | "missing";
  recipientState: "approved" | "not_required" | "missing";
  httpsSourceCheck: boolean;
  reviewGate: {
    status: "blocked" | "ready_for_delivery";
    reasons: string[];
  };
  source: AlertProofPacketInput["source"];
  payloadDigest: string;
  blockers: string[];
  warnings: string[];
  reviewNotice: string;
};

export type AlertProofPacketRecord = {
  id: string;
  publication: {
    title: string;
    sourceUrl: string;
    source: {
      code: string;
      displayName: string;
      diligenceRecords?: Array<{
        lastReviewedAt?: Date | string | null;
      }>;
    };
  };
  channel: AlertProofPacketInput["channel"];
  approvedByName?: string | null;
  approvedAt?: Date | string | null;
  payload: {
    subject: string;
    text: string;
    to?: string | null;
  };
};

export async function buildAlertProofPacket(
  input: AlertProofPacketInput,
  now = new Date(),
): Promise<AlertProofPacket> {
  const sourceAssessment = assessSourceHierarchy(
    {
      authorityLevel: input.source.authorityLevel,
      reviewedAt: input.source.reviewedAt,
      superseded: input.source.superseded,
    },
    now,
  );
  const reasons: string[] = [];

  if (sourceAssessment.blocksExternalAlert) {
    reasons.push(sourceAssessment.detail);
  }
  if (!input.approvedAt || !input.approvedByName) {
    reasons.push("Alert has no reviewer approval record.");
  }
  if (input.channel === "EMAIL_REALTIME" && !input.payload.recipient) {
    reasons.push("Email alert has no approved recipient.");
  }
  if (!input.source.url.startsWith("https://")) {
    reasons.push("Source URL must use HTTPS before external delivery.");
  }

  const uniqueReasons = [...new Set(reasons)].sort();
  const reviewerState = input.approvedAt && input.approvedByName ? "approved" : "missing";
  const recipientState =
    input.channel === "EMAIL_REALTIME" ? (input.payload.recipient ? "approved" : "missing") : "not_required";
  const httpsSourceCheck = input.source.url.startsWith("https://");

  return {
    schema: "horizon-scanner.alert-proof-packet.v1",
    generatedAt: now.toISOString(),
    alertId: input.alertId,
    publicationTitle: input.publicationTitle,
    channel: input.channel,
    sourceStatus: sourceAssessment.status,
    externalSendAllowed: uniqueReasons.length === 0,
    sourceAuthority: input.source.authorityLevel,
    reviewerState,
    recipientState,
    httpsSourceCheck,
    reviewGate: {
      status: uniqueReasons.length === 0 ? "ready_for_delivery" : "blocked",
      reasons: uniqueReasons,
    },
    source: input.source,
    payloadDigest: await sha256(`${input.payload.subject}\n${input.payload.text}`),
    blockers: uniqueReasons,
    warnings: sourceAssessment.requiresPrimarySource && !uniqueReasons.includes(sourceAssessment.detail)
      ? [sourceAssessment.detail]
      : [],
    reviewNotice: "Alert proof packets store source metadata and payload digests only. Human approval remains mandatory before external delivery.",
  };
}

export function alertProofPacketInputFromRecord(record: AlertProofPacketRecord): AlertProofPacketInput {
  const lastReviewedAt = record.publication.source.diligenceRecords?.[0]?.lastReviewedAt ?? null;
  return {
    alertId: record.id,
    publicationTitle: record.publication.title,
    channel: record.channel,
    source: {
      title: record.publication.source.displayName,
      url: record.publication.sourceUrl,
      authorityLevel: inferSourceAuthorityLevel(record.publication.source.code),
      reviewedAt: lastReviewedAt ? new Date(lastReviewedAt).toISOString() : null,
    },
    payload: {
      subject: record.payload.subject,
      text: record.payload.text,
      recipient: record.payload.to ?? null,
    },
    approvedByName: record.approvedByName,
    approvedAt: record.approvedAt ? new Date(record.approvedAt).toISOString() : null,
  };
}

export function summarizeAlertProofPacket(packet: AlertProofPacket) {
  return {
    schema: packet.schema,
    generatedAt: packet.generatedAt,
    sourceStatus: packet.sourceStatus,
    externalSendAllowed: packet.externalSendAllowed,
    sourceAuthority: packet.sourceAuthority,
    reviewerState: packet.reviewerState,
    recipientState: packet.recipientState,
    httpsSourceCheck: packet.httpsSourceCheck,
    reviewGate: packet.reviewGate,
    payloadDigest: packet.payloadDigest,
    source: packet.source,
    blockers: packet.blockers,
    warnings: packet.warnings,
    reviewNotice: packet.reviewNotice,
  };
}

export function alertProofPacketPersistence(packet: AlertProofPacket) {
  return {
    sourceAuthority: packet.sourceAuthority,
    sourceReviewState: packet.sourceStatus,
    reviewerState: packet.reviewerState,
    recipientState: packet.recipientState,
    httpsSourceCheck: packet.httpsSourceCheck,
    payloadDigest: packet.payloadDigest,
    gateStatus: packet.reviewGate.status,
    reasons: packet.reviewGate.reasons,
    packetJson: summarizeAlertProofPacket(packet),
  };
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
