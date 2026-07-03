import type { AlertView } from "@/lib/alerts";
import type { PublicationListItem } from "@/lib/mock-data";
import type { ProductMapView } from "@/lib/product-maps";
import type { ReviewQueueView } from "@/lib/review";
import { summarizeReviewReadiness } from "@/lib/review-readiness";

type SourceFreshnessSignal = {
  current: number;
  due: number;
  stale: number;
  pollable: number;
};

type ProductMapReadinessSignal = {
  ready: boolean;
  blockingMaps: Array<{
    productMap: {
      id: string;
      name: string;
    };
  }>;
};

export type BriefingTone = "urgent" | "warning" | "normal" | "success";

export type PilotBriefingAction = {
  key: string;
  label: string;
  detail: string;
  href: string;
  tone: BriefingTone;
  priority: number;
};

export type PilotBriefingRiskItem = {
  publicationId: string;
  title: string;
  sourceCode: string;
  impactBucket: PublicationListItem["impactBucket"];
  impactScore: number;
  reviewStatus: string;
  readinessLabel: string;
  readinessTone: BriefingTone;
  href: string;
  serviceOfferingIds: string[];
};

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function verb(count: number, singular: string, pluralValue: string) {
  return count === 1 ? singular : pluralValue;
}

function scoreBucket(publication: Pick<PublicationListItem, "impactBucket">) {
  if (publication.impactBucket === "CRITICAL") return 5;
  if (publication.impactBucket === "HIGH") return 4;
  if (publication.impactBucket === "MEDIUM") return 3;
  if (publication.impactBucket === "LOW") return 2;
  return 1;
}

function buildExecutiveSummary(input: {
  highImpactCount: number;
  reviewBlockers: number;
  approvedAlerts: number;
  sourceBlockers: number;
  productMapBlockers: number;
}) {
  if (input.sourceBlockers) {
    return `Source monitoring needs attention before the 24-hour promise can be relied on. ${plural(input.sourceBlockers, "source")} currently ${verb(input.sourceBlockers, "blocks", "block")} the monitoring posture.`;
  }
  if (input.productMapBlockers) {
    return `Client footprint confirmation is the binding constraint. ${plural(input.productMapBlockers, "product map")} must be confirmed before alert routing resumes.`;
  }
  if (input.reviewBlockers) {
    return `Human review is the active bottleneck. ${plural(input.reviewBlockers, "publication")} still ${verb(input.reviewBlockers, "needs", "need")} a readiness decision before alert drafting.`;
  }
  if (input.approvedAlerts) {
    return `Reviewed alerts are ready for explicit send. ${plural(input.approvedAlerts, "approved draft")} ${verb(input.approvedAlerts, "is", "are")} waiting in the alert cockpit.`;
  }
  if (input.highImpactCount) {
    return `High-impact publications are under control. ${plural(input.highImpactCount, "item")} ${verb(input.highImpactCount, "remains", "remain")} visible for continued monitoring.`;
  }
  return "The pilot cockpit is calm. Source freshness, review posture and alert routing have no immediate blockers.";
}

export function buildPilotBriefing(input: {
  publications: PublicationListItem[];
  reviewItems: ReviewQueueView[];
  alerts: AlertView[];
  sourceFreshness: SourceFreshnessSignal;
  productMapReadiness: ProductMapReadinessSignal;
  productMaps: ProductMapView[];
  generatedAt?: Date;
}) {
  const highImpactPublications = input.publications.filter((publication) =>
    ["CRITICAL", "HIGH"].includes(publication.impactBucket),
  );
  const relevantPublications = input.publications.filter((publication) =>
    ["CRITICAL", "HIGH", "MEDIUM"].includes(publication.impactBucket),
  );
  const reviewByPublicationId = new Map(input.reviewItems.map((item) => [item.publicationId, item]));
  const reviewReadiness = input.reviewItems.map((item) => ({
    item,
    readiness: summarizeReviewReadiness(item),
  }));
  const reviewBlockers = reviewReadiness.filter(({ readiness }) => !readiness.readyForAlertDraft).length;
  const readyReviews = reviewReadiness.filter(({ readiness }) => readiness.readyForAlertDraft).length;
  const draftAlerts = input.alerts.filter((alert) => alert.status === "DRAFT").length;
  const approvedAlerts = input.alerts.filter((alert) => alert.status === "APPROVED").length;
  const failedAlerts = input.alerts.filter((alert) =>
    ["BLOCKED_BY_CONFIG", "FAILED"].includes(alert.status),
  ).length;
  const serviceOfferingIds = new Set(input.publications.flatMap((publication) => publication.serviceOfferingIds));
  const criticalProductLines = input.productMaps.flatMap((productMap) =>
    productMap.productLines.filter((line) => line.isCritical),
  );

  const riskQueue: PilotBriefingRiskItem[] = relevantPublications
    .map((publication) => {
      const reviewItem = reviewByPublicationId.get(publication.id);
      const readiness = reviewItem ? summarizeReviewReadiness(reviewItem) : null;
      const ready = Boolean(readiness?.readyForAlertDraft);
      return {
        publicationId: publication.id,
        title: publication.title,
        sourceCode: publication.sourceCode,
        impactBucket: publication.impactBucket,
        impactScore: publication.impactScore,
        reviewStatus: reviewItem?.status ?? "UNQUEUED",
        readinessLabel: ready
          ? "Ready for alert drafting"
          : `${readiness?.blockingCount ?? 1} review blocker${(readiness?.blockingCount ?? 1) === 1 ? "" : "s"}`,
        readinessTone: ready ? ("success" as const) : ("urgent" as const),
        href: reviewItem ? `/review/${publication.id}` : `/publications/${publication.id}`,
        serviceOfferingIds: publication.serviceOfferingIds,
      };
    })
    .sort((a, b) => scoreBucket(b) - scoreBucket(a) || b.impactScore - a.impactScore)
    .slice(0, 6);

  const actions: PilotBriefingAction[] = [];
  if (input.sourceFreshness.stale) {
    actions.push({
      key: "sources",
      label: "Restore source posture",
      detail: `${plural(input.sourceFreshness.stale, "source")} blocks the monitoring SLA.`,
      href: "/sources",
      tone: "urgent",
      priority: 100,
    });
  }
  if (!input.productMapReadiness.ready) {
    actions.push({
      key: "footprint",
      label: "Confirm product maps",
      detail: `${plural(input.productMapReadiness.blockingMaps.length, "map")} blocks alert routing.`,
      href: "/product-maps",
      tone: "urgent",
      priority: 90,
    });
  }
  if (reviewBlockers) {
    actions.push({
      key: "review",
      label: "Clear review blockers",
      detail: `${plural(reviewBlockers, "publication")} ${verb(reviewBlockers, "needs", "need")} readiness work.`,
      href: "/review",
      tone: "warning",
      priority: 80,
    });
  }
  if (approvedAlerts) {
    actions.push({
      key: "send",
      label: "Send approved alerts",
      detail: `${plural(approvedAlerts, "draft")} is approved and waiting for explicit send.`,
      href: "/alerts",
      tone: "urgent",
      priority: 70,
    });
  }
  if (draftAlerts) {
    actions.push({
      key: "approve",
      label: "Approve draft alerts",
      detail: `${plural(draftAlerts, "draft")} needs reviewer approval.`,
      href: "/alerts",
      tone: "warning",
      priority: 60,
    });
  }
  if (failedAlerts) {
    actions.push({
      key: "delivery",
      label: "Resolve delivery failures",
      detail: `${plural(failedAlerts, "alert")} needs configuration or retry review.`,
      href: "/alerts",
      tone: "warning",
      priority: 50,
    });
  }
  if (!actions.length) {
    actions.push({
      key: "clear",
      label: "Briefing clear",
      detail: "No immediate briefing action is waiting.",
      href: "/",
      tone: "success",
      priority: 0,
    });
  }

  const metrics = {
    publications: input.publications.length,
    highImpact: highImpactPublications.length,
    reviewReady: readyReviews,
    reviewBlocked: reviewBlockers,
    alertDrafts: draftAlerts,
    approvedAlerts,
    sourceSlaBlockers: input.sourceFreshness.stale,
    sourcePollable: input.sourceFreshness.pollable,
    productMapBlockers: input.productMapReadiness.blockingMaps.length,
    criticalProductLines: criticalProductLines.length,
    serviceOfferings: serviceOfferingIds.size,
  };

  const executiveSummary = buildExecutiveSummary({
    highImpactCount: metrics.highImpact,
    reviewBlockers: metrics.reviewBlocked,
    approvedAlerts: metrics.approvedAlerts,
    sourceBlockers: metrics.sourceSlaBlockers,
    productMapBlockers: metrics.productMapBlockers,
  });

  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    status:
      metrics.sourceSlaBlockers || metrics.productMapBlockers || metrics.reviewBlocked
        ? "ACTION_REQUIRED"
        : metrics.approvedAlerts
          ? "READY_TO_SEND"
          : "MONITORING",
    executiveSummary,
    metrics,
    riskQueue,
    actions: actions.sort((a, b) => b.priority - a.priority),
    narrative: [
      executiveSummary,
      `${plural(metrics.highImpact, "high-impact item")} and ${plural(metrics.serviceOfferings, "service route")} ${verb(metrics.highImpact + metrics.serviceOfferings, "is", "are")} in the current pilot view.`,
      `${plural(metrics.criticalProductLines, "critical product line")} ${verb(metrics.criticalProductLines, "informs", "inform")} deterministic impact scoring.`,
      "All delivery remains review-gated and requires an explicit send action.",
    ],
  };
}
