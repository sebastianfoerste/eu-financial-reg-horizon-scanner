import type { AlertChannel, AlertStatus, Prisma } from "@prisma/client";

import {
  alertProofPacketInputFromRecord,
  alertProofPacketPersistence,
  buildAlertProofPacket,
  summarizeAlertProofPacket,
  type AlertProofPacketInput,
} from "@/lib/alert-proof-packet";
import { writeAuditLog } from "@/lib/audit";
import { assertOrganisationAccess, getReviewerName, requireOperator } from "@/lib/authz";
import { deliverApprovedAlert, getDeliveryGovernanceBlock, providerForChannel } from "@/lib/delivery";
import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import { mockPublications } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";
import { getProductMapDeliveryReadiness } from "@/lib/product-maps";
import { getReviewItem } from "@/lib/review";
import { summarizeReviewReadiness } from "@/lib/review-readiness";
import { getRoutedServiceOfferings } from "@/lib/service-offerings";

const reviewedDeliveryChannels: AlertChannel[] = ["EMAIL_REALTIME", "SLACK", "MS_TEAMS", "HUBSPOT"];

type AlertPayload = {
  subject: string;
  text: string;
  html?: string;
  to?: string | null;
  title: string;
  sourceUrl: string;
  publicationUrl: string;
  impactBucket: string;
  impactScore: number;
  rawImpactScore?: number;
  floorAdjustment?: number;
  scoringRuleVersion?: string;
  serviceOfferingIds: string[];
  serviceOfferings?: Array<{
    id: string;
    name: string;
    priceIndication: string;
    ctaUrl: string | null;
  }>;
};

export type AlertView = {
  id: string;
  organisationId: string;
  organisationName: string;
  publicationId: string;
  publicationTitle: string;
  publicationSource: string;
  channel: AlertChannel;
  status: AlertStatus;
  scheduledFor: string;
  approvedAt: string | null;
  approvedByName: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  payload: AlertPayload;
  deliveryAttempts: Array<{
    id: string;
    provider: string;
    status: string;
    attemptedAt: string;
    errorMessage: string | null;
  }>;
  proofPackets: Array<{
    id: string;
    createdAt: string;
    sourceAuthority: string;
    sourceReviewState: string;
    reviewerState: string;
    recipientState: string;
    httpsSourceCheck: boolean;
    gateStatus: string;
    payloadDigest: string;
    reasons: string[];
  }>;
};

function asAlertPayload(value: Prisma.JsonValue): AlertPayload {
  return value as unknown as AlertPayload;
}

export function escapeAlertHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function canApproveAlertStatus(status: AlertStatus) {
  return ["DRAFT", "BLOCKED_BY_CONFIG", "FAILED"].includes(status);
}

function buildPayload(input: {
  organisationName: string;
  primaryContact?: string | null;
  publication: {
    id: string;
    title: string;
    sourceUrl: string;
    publicationType: string;
    classifications: Array<{
      summary: string;
      whatChanged: string | null;
      whoIsAffected: string | null;
      recommendedAction: string | null;
      serviceOfferingIds: string[];
    }>;
    impactScores: Array<{
      score: number;
      bucket: string;
      rationale: string;
      rawScore: number;
      floorAdjustment: number;
      ruleVersion: string;
    }>;
  };
  serviceOfferings: Array<{
    id: string;
    name: string;
    priceIndication: string;
    calendlyUrl: string | null;
  }>;
}): AlertPayload {
  const classification = input.publication.classifications[0];
  const impact = input.publication.impactScores[0];
  const subject = `${impact?.bucket ?? "REVIEW"} regulatory alert: ${input.publication.title}`;
  const lines = [
    subject,
    "",
    classification?.summary ?? "Classification summary is pending.",
    "",
    `Impact: ${impact?.bucket ?? "NONE"} (${impact?.score ?? 0}/100)`,
    impact
      ? `Scoring: weighted subtotal ${impact.rawScore}; floor uplift ${impact.floorAdjustment}; rule ${impact.ruleVersion}`
      : null,
    impact?.rationale ? `Explanation: ${impact.rationale}` : null,
    classification?.whoIsAffected ? `Affected: ${classification.whoIsAffected}` : null,
    classification?.recommendedAction ? `Action: ${classification.recommendedAction}` : null,
    ...input.serviceOfferings.map(
      (offering) => `Service: ${offering.name} (${offering.priceIndication})`,
    ),
    `Source: ${input.publication.sourceUrl}`,
  ].filter(Boolean) as string[];

  return {
    subject,
    text: lines.join("\n"),
    html: lines.map((line) => `<p>${escapeAlertHtml(line)}</p>`).join(""),
    to: input.primaryContact ?? null,
    title: input.publication.title,
    sourceUrl: input.publication.sourceUrl,
    publicationUrl: `/publications/${input.publication.id}`,
    impactBucket: impact?.bucket ?? "NONE",
    impactScore: impact?.score ?? 0,
    rawImpactScore: impact?.rawScore ?? 0,
    floorAdjustment: impact?.floorAdjustment ?? 0,
    scoringRuleVersion: impact?.ruleVersion ?? "unscored",
    serviceOfferingIds: classification?.serviceOfferingIds ?? [],
    serviceOfferings: input.serviceOfferings.map((offering) => ({
      id: offering.id,
      name: offering.name,
      priceIndication: offering.priceIndication,
      ctaUrl: offering.calendlyUrl,
    })),
  };
}

export async function listAlerts(organisationId?: string): Promise<AlertView[]> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return mockPublications.slice(0, 2).map((publication, index) => ({
      id: `alert-demo-${publication.id}`,
      organisationId: "demo-org",
      organisationName: "Demo organisation",
      publicationId: publication.id,
      publicationTitle: publication.title,
      publicationSource: publication.sourceCode,
      channel: index === 0 ? "EMAIL_REALTIME" : "SLACK",
      status: index === 0 ? "DRAFT" : "APPROVED",
      scheduledFor: new Date().toISOString(),
      approvedAt: index === 0 ? null : new Date().toISOString(),
      approvedByName: index === 0 ? null : "Sebastian",
      sentAt: null,
      errorMessage: null,
      payload: {
        subject: `${publication.impactBucket} regulatory alert: ${publication.title}`,
        text: `${publication.summary}\n\nSource: ${publication.sourceUrl}`,
        title: publication.title,
        sourceUrl: publication.sourceUrl,
        publicationUrl: `/publications/${publication.id}`,
        impactBucket: publication.impactBucket,
        impactScore: publication.impactScore,
        rawImpactScore: publication.rawImpactScore,
        floorAdjustment: publication.impactFloorAdjustment,
        scoringRuleVersion: publication.scoringRuleVersion,
        serviceOfferingIds: publication.serviceOfferingIds,
        to: null,
      },
      deliveryAttempts: [],
      proofPackets: [],
    }));
  }

  const prisma = getPrisma();
  const alerts = await prisma.alert.findMany({
    where: { organisationId },
    orderBy: [{ status: "asc" }, { scheduledFor: "desc" }],
    take: 100,
    include: {
      organisation: true,
      publication: {
        include: { source: true },
      },
      deliveryAttempts: {
        orderBy: { attemptedAt: "desc" },
        take: 5,
      },
      proofPackets: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    organisationId: alert.organisationId,
    organisationName: alert.organisation.name,
    publicationId: alert.publicationId,
    publicationTitle: alert.publication.title,
    publicationSource: alert.publication.source.code,
    channel: alert.channel,
    status: alert.status,
    scheduledFor: alert.scheduledFor.toISOString(),
    approvedAt: alert.approvedAt?.toISOString() ?? null,
    approvedByName: alert.approvedByName,
    sentAt: alert.sentAt?.toISOString() ?? null,
    errorMessage: alert.errorMessage,
    payload: asAlertPayload(alert.payloadJson),
    deliveryAttempts: alert.deliveryAttempts.map((attempt) => ({
      id: attempt.id,
      provider: attempt.provider,
      status: attempt.status,
      attemptedAt: attempt.attemptedAt.toISOString(),
      errorMessage: attempt.errorMessage,
    })),
    proofPackets: alert.proofPackets.map((packet) => ({
      id: packet.id,
      createdAt: packet.createdAt.toISOString(),
      sourceAuthority: packet.sourceAuthority,
      sourceReviewState: packet.sourceReviewState,
      reviewerState: packet.reviewerState,
      recipientState: packet.recipientState,
      httpsSourceCheck: packet.httpsSourceCheck,
      gateStatus: packet.gateStatus,
      payloadDigest: packet.payloadDigest,
      reasons: packet.reasons,
    })),
  }));
}

export async function generateAlertDrafts(input: {
  organisationId?: string;
  channels?: AlertChannel[];
} = {}) {
  const operator = await requireOperator();

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    await writeAuditLog({
      action: "alert.generate",
      entityType: "alert",
      entityId: "demo",
      actorUserId: operator.userId,
      organisationId: operator.organisationId,
      payloadJson: { mode: "demo" },
    });
    return { created: mockPublications.length, skipped: 0, mode: "demo" as const };
  }

  const prisma = getPrisma();
  if (operator.mode === "clerk" && !operator.organisationId) {
    throw new Error("An active organisation is required before alert drafts can be generated.");
  }
  if (operator.mode === "clerk" && input.organisationId) {
    assertOrganisationAccess(operator, input.organisationId);
  }
  const organisationId = operator.mode === "clerk" ? operator.organisationId : input.organisationId;
  const organisation =
    (organisationId
      ? await prisma.organisation.findUnique({ where: { id: organisationId } })
      : await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await prisma.organisation.create({ data: { name: "Pilot organisation", tier: "TRIAL" } }));
  const footprintReadiness = await getProductMapDeliveryReadiness(organisation.id);
  if (!footprintReadiness.ready) {
    await writeAuditLog({
      action: "alert.generate.blocked",
      entityType: "organisation",
      entityId: organisation.id,
      organisationId: organisation.id,
      actorUserId: operator.userId,
      payloadJson: {
        reason: footprintReadiness.message,
        blockingProductMaps: footprintReadiness.blockingMaps.length,
      },
    });
    return { created: 0, skipped: 0, mode: "database" as const, blockedReason: footprintReadiness.message };
  }
  const channels = input.channels?.length ? input.channels : reviewedDeliveryChannels;
  const unsupportedChannel = channels.find((channel) => !reviewedDeliveryChannels.includes(channel));
  if (unsupportedChannel) {
    throw new Error(`Channel ${unsupportedChannel} is not supported for reviewed external delivery.`);
  }

  const publications = await prisma.publication.findMany({
    where: {
      reviewQueueItems: { some: { status: "APPROVED" } },
      impactScores: {
        some: {
          organisationId: organisation.id,
          bucket: { in: ["CRITICAL", "HIGH", "MEDIUM"] },
        },
      },
    },
    include: {
      classifications: { orderBy: { createdAt: "desc" }, take: 1 },
      impactScores: {
        where: { organisationId: organisation.id },
        orderBy: { score: "desc" },
        take: 1,
      },
    },
    take: 50,
  });

  let created = 0;
  let skipped = 0;
  let readinessSkipped = 0;
  for (const publication of publications) {
    const reviewItem = await getReviewItem(publication.id, organisation.id);
    const reviewReadiness = reviewItem ? summarizeReviewReadiness(reviewItem) : null;
    if (!reviewReadiness?.readyForAlertDraft) {
      skipped += channels.length;
      readinessSkipped += 1;
      continue;
    }

    const serviceOfferings = await getRoutedServiceOfferings(
      publication.classifications[0]?.serviceOfferingIds ?? [],
    );
    for (const channel of channels) {
      const existing = await prisma.alert.findFirst({
        where: {
          organisationId: organisation.id,
          publicationId: publication.id,
          channel,
          status: { in: ["DRAFT", "APPROVED", "SENDING", "SENT"] },
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const payload = buildPayload({
        organisationName: organisation.name,
        primaryContact: organisation.primaryContact,
        publication,
        serviceOfferings,
      });

      await prisma.alert.create({
        data: {
          organisationId: organisation.id,
          publicationId: publication.id,
          impactScoreId: publication.impactScores[0]?.id,
          channel,
          status: "DRAFT",
          scheduledFor: new Date(),
          payloadJson: payload as unknown as Prisma.InputJsonValue,
          targetMetadataJson: {
            provider: providerForChannel(channel),
            recipient: payload.to ?? null,
          },
        },
      });
      created += 1;
    }
  }

  await writeAuditLog({
    action: "alert.generate",
    entityType: "organisation",
    entityId: organisation.id,
    organisationId: organisation.id,
    actorUserId: operator.userId,
    payloadJson: { created, skipped, readinessSkipped, channels },
  });

  return { created, skipped, mode: "database" as const };
}

export async function approveAlert(input: { alertId: string; reviewerName: string }) {
  const operator = await requireOperator();
  const reviewerName = getReviewerName(operator, input.reviewerName);

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    await writeAuditLog({
      action: "alert.approve",
      entityType: "alert",
      entityId: input.alertId,
      actorUserId: operator.userId,
      organisationId: operator.organisationId,
      payloadJson: { mode: "demo", reviewerName },
    });
    return { ok: true, mode: "demo" as const };
  }

  const prisma = getPrisma();
  const currentAlert = await prisma.alert.findUniqueOrThrow({ where: { id: input.alertId } });
  assertOrganisationAccess(operator, currentAlert.organisationId);
  if (!canApproveAlertStatus(currentAlert.status)) {
    throw new Error("Only draft or failed alert attempts can be approved.");
  }
  const readiness = await getProductMapDeliveryReadiness(currentAlert.organisationId);
  if (!readiness.ready) {
    await writeAuditLog({
      action: "alert.approve.blocked",
      entityType: "alert",
      entityId: currentAlert.id,
      organisationId: currentAlert.organisationId,
      actorUserId: operator.userId,
      payloadJson: { reason: readiness.message },
    });
    return { ok: false, mode: "database" as const, blockedReason: readiness.message };
  }
  const alert = await prisma.alert.update({
    where: { id: currentAlert.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: operator.userId,
      approvedByName: reviewerName,
    },
    include: {
      publication: {
        include: {
          source: {
            include: {
              diligenceRecords: {
                orderBy: { updatedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  const payload = asAlertPayload(alert.payloadJson);
  const proofPacket = await persistAlertProofPacket(
    prisma,
    alertProofPacketInputFromRecord({
      id: alert.id,
      publication: alert.publication,
      channel: alert.channel,
      approvedAt: alert.approvedAt,
      approvedByName: alert.approvedByName,
      payload: {
        subject: payload.subject,
        text: payload.text,
        to: payload.to,
      },
    }),
  );

  await writeAuditLog({
    action: "alert.approve",
    entityType: "alert",
    entityId: input.alertId,
    organisationId: alert.organisationId,
    actorUserId: operator.userId,
    payloadJson: { reviewerName, proofPacket: summarizeAlertProofPacket(proofPacket) },
  });

  return { ok: true, mode: "database" as const, alert };
}

export async function sendApprovedAlert(input: { alertId: string }) {
  const operator = await requireOperator();

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    await writeAuditLog({
      action: "alert.send.blocked",
      entityType: "alert",
      entityId: input.alertId,
      actorUserId: operator.userId,
      organisationId: operator.organisationId,
      payloadJson: { mode: "demo", reason: "Demo mode never sends external alerts." },
    });
    return { ok: false, mode: "demo" as const, status: "BLOCKED_BY_CONFIG" as const };
  }

  const prisma = getPrisma();
  const alert = await prisma.alert.findUniqueOrThrow({
    where: { id: input.alertId },
    include: {
      publication: {
        include: {
          source: {
            include: {
              diligenceRecords: {
                orderBy: { updatedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  assertOrganisationAccess(operator, alert.organisationId);
  if (alert.status !== "APPROVED") {
    throw new Error("Only approved alert drafts can be sent.");
  }
  const payload = asAlertPayload(alert.payloadJson);
  const readiness = await getProductMapDeliveryReadiness(alert.organisationId);
  if (!readiness.ready) {
    const errorMessage = "Product-map confirmation is due. Confirm the footprint and generate a new reviewed alert draft.";
    await prisma.alert.update({
      where: { id: alert.id },
      data: { status: "SKIPPED", errorMessage },
    });
    await writeAuditLog({
      action: "alert.send.blocked",
      entityType: "alert",
      entityId: alert.id,
      organisationId: alert.organisationId,
      actorUserId: operator.userId,
      payloadJson: { reason: readiness.message },
    });
    return { ok: false, mode: "database" as const, status: "SKIPPED" as const };
  }

  const proofPacket = await persistAlertProofPacket(
    prisma,
    alertProofPacketInputFromRecord({
      id: alert.id,
      publication: alert.publication,
      channel: alert.channel,
      approvedAt: alert.approvedAt,
      approvedByName: alert.approvedByName,
      payload: {
        subject: payload.subject,
        text: payload.text,
        to: payload.to,
      },
    }),
  );
  if (!proofPacket.externalSendAllowed) {
    const errorMessage = `Alert proof packet blocked external delivery: ${proofPacket.reviewGate.reasons.join(" ")}`;
    await prisma.alert.update({
      where: { id: alert.id },
      data: { status: "SKIPPED", errorMessage },
    });
    await writeAuditLog({
      action: "alert.send.blocked",
      entityType: "alert",
      entityId: alert.id,
      organisationId: alert.organisationId,
      actorUserId: operator.userId,
      payloadJson: { proofPacket: summarizeAlertProofPacket(proofPacket) },
    });
    return { ok: false, mode: "database" as const, status: "SKIPPED" as const };
  }

  const sendClaim = await prisma.alert.updateMany({
    where: { id: alert.id, status: "APPROVED" },
    data: { status: "SENDING", errorMessage: null },
  });
  if (sendClaim.count !== 1) {
    throw new Error("This alert has already been claimed for delivery.");
  }

  const governanceBlock = await getDeliveryGovernanceBlock(alert.channel, alert.organisationId);
  const result =
    governanceBlock ??
    (await deliverApprovedAlert({ channel: alert.channel, payload }).catch((error) => ({
      provider: providerForChannel(alert.channel) ?? "HUBSPOT",
      status: "FAILED" as const,
      requestJson: undefined,
      responseJson: undefined,
      errorMessage: error instanceof Error ? error.message : "Unknown delivery error",
    })));

  await prisma.deliveryAttempt.create({
    data: {
      alertId: alert.id,
      provider: result.provider,
      status: result.status,
      requestJson: result.requestJson as Prisma.InputJsonValue,
      responseJson: result.responseJson as Prisma.InputJsonValue,
      errorMessage: result.errorMessage,
    },
  });

  const nextStatus: AlertStatus =
    result.status === "SENT" ? "SENT" : result.status === "BLOCKED_BY_CONFIG" ? "BLOCKED_BY_CONFIG" : "FAILED";
  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      status: nextStatus,
      sentAt: nextStatus === "SENT" ? new Date() : null,
      errorMessage: result.errorMessage,
    },
  });

  await writeAuditLog({
    action: nextStatus === "SENT" ? "alert.send" : "alert.send.failed",
    entityType: "alert",
    entityId: alert.id,
    organisationId: alert.organisationId,
    actorUserId: operator.userId,
    payloadJson: {
      provider: result.provider,
      status: result.status,
      errorMessage: result.errorMessage,
      proofPacket: summarizeAlertProofPacket(proofPacket),
    },
  });

  return { ok: nextStatus === "SENT", mode: "database" as const, status: nextStatus };
}

async function persistAlertProofPacket(prisma: ReturnType<typeof getPrisma>, input: AlertProofPacketInput) {
  const packet = await buildAlertProofPacket(input);
  const persistence = alertProofPacketPersistence(packet);
  await prisma.alertProofPacket.create({
    data: {
      alertId: packet.alertId,
      sourceAuthority: persistence.sourceAuthority,
      sourceReviewState: persistence.sourceReviewState,
      reviewerState: persistence.reviewerState,
      recipientState: persistence.recipientState,
      httpsSourceCheck: persistence.httpsSourceCheck,
      payloadDigest: persistence.payloadDigest,
      gateStatus: persistence.gateStatus,
      reasons: persistence.reasons,
      packetJson: persistence.packetJson as Prisma.InputJsonValue,
    },
  });
  return packet;
}
