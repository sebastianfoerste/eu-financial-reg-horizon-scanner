export type OperatorActionTone = "urgent" | "warning" | "normal" | "success";

export type OperatorAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  metric: string;
  tone: OperatorActionTone;
  priority: number;
};

type ReviewSignal = {
  status: string;
};

type AlertSignal = {
  status: string;
};

type RuntimeSignal = {
  ok: boolean;
  severity: "info" | "warning" | "error";
};

type SourceFreshnessSignal = {
  stale: number;
  pollable: number;
};

type FootprintReadinessSignal = {
  ready: boolean;
  blockingMaps: Array<{
    productMap: {
      id: string;
      name: string;
    };
  }>;
};

export function buildOperatorActions(input: {
  highImpactCount: number;
  reviewItems: ReviewSignal[];
  alerts: AlertSignal[];
  sourceFreshness: SourceFreshnessSignal;
  footprintReadiness: FootprintReadinessSignal;
  runtimeChecks: RuntimeSignal[];
}) {
  const reviewAttentionCount = input.reviewItems.filter((item) =>
    ["PENDING", "IN_REVIEW", "NEEDS_CHANGES"].includes(item.status),
  ).length;
  const draftCount = input.alerts.filter((alert) => alert.status === "DRAFT").length;
  const approvedCount = input.alerts.filter((alert) => alert.status === "APPROVED").length;
  const failedDeliveryCount = input.alerts.filter((alert) =>
    ["BLOCKED_BY_CONFIG", "FAILED"].includes(alert.status),
  ).length;
  const runtimeIssueCount = input.runtimeChecks.filter(
    (check) => !check.ok && ["warning", "error"].includes(check.severity),
  ).length;

  const actions: OperatorAction[] = [];

  if (input.sourceFreshness.stale) {
    actions.push({
      key: "source-freshness",
      title: "Restore source freshness",
      detail: "One or more source adapters are outside the monitoring SLA or blocked by policy.",
      href: "/sources",
      metric: input.sourceFreshness.stale.toString(),
      tone: "urgent",
      priority: 110,
    });
  } else if (input.sourceFreshness.pollable) {
    actions.push({
      key: "source-polling",
      title: "Poll due sources",
      detail: "Approved polling cadence has elapsed for one or more sources.",
      href: "/sources",
      metric: input.sourceFreshness.pollable.toString(),
      tone: "normal",
      priority: 45,
    });
  }

  if (!input.footprintReadiness.ready) {
    const firstBlockingMap = input.footprintReadiness.blockingMaps[0]?.productMap;
    actions.push({
      key: "footprint",
      title: "Confirm client footprint",
      detail: firstBlockingMap
        ? `${firstBlockingMap.name} is blocking alert routing.`
        : "Active product-map facts are required before alert routing.",
      href: firstBlockingMap ? `/product-maps/${firstBlockingMap.id}` : "/product-maps",
      metric: input.footprintReadiness.blockingMaps.length.toString(),
      tone: "urgent",
      priority: 100,
    });
  }

  if (reviewAttentionCount) {
    actions.push({
      key: "review",
      title: "Review classifications",
      detail: "Human review items are waiting before approved alert drafts can be generated.",
      href: "/review",
      metric: reviewAttentionCount.toString(),
      tone: "warning",
      priority: 90,
    });
  }

  if (approvedCount) {
    actions.push({
      key: "send",
      title: "Send approved alerts",
      detail: "Approved drafts still require an explicit reviewed send action.",
      href: "/alerts",
      metric: approvedCount.toString(),
      tone: "urgent",
      priority: 80,
    });
  }

  if (draftCount) {
    actions.push({
      key: "drafts",
      title: "Approve alert drafts",
      detail: "Draft payloads are ready for reviewer approval before any delivery attempt.",
      href: "/alerts",
      metric: draftCount.toString(),
      tone: "warning",
      priority: 70,
    });
  }

  if (failedDeliveryCount) {
    actions.push({
      key: "delivery",
      title: "Resolve delivery blocks",
      detail: "Delivery attempts need configuration or retry review.",
      href: "/alerts",
      metric: failedDeliveryCount.toString(),
      tone: "warning",
      priority: 60,
    });
  }

  if (runtimeIssueCount) {
    actions.push({
      key: "runtime",
      title: "Resolve runtime checks",
      detail: "Configuration warnings should be cleared before pilot reliance.",
      href: "/integrations",
      metric: runtimeIssueCount.toString(),
      tone: "warning",
      priority: 50,
    });
  }

  if (input.highImpactCount) {
    actions.push({
      key: "high-impact",
      title: "Inspect high-impact items",
      detail: "Critical and high-score publications are ready for review in the publication list.",
      href: "/?bucket=HIGH",
      metric: input.highImpactCount.toString(),
      tone: "normal",
      priority: 40,
    });
  }

  if (!actions.length) {
    actions.push({
      key: "clear",
      title: "Action queue clear",
      detail: "No immediate review, alert or runtime action is waiting.",
      href: "/sources",
      metric: "0",
      tone: "success",
      priority: 0,
    });
  }

  return actions.sort((a, b) => b.priority - a.priority);
}
