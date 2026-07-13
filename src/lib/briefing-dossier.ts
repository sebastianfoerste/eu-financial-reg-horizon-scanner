import { createHash } from "node:crypto";

import type { buildPilotBriefing } from "@/lib/pilot-briefing";

type Briefing = ReturnType<typeof buildPilotBriefing>;

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

export type BriefingDossier = {
  schema: "horizon-scanner.briefing-dossier.v1";
  generated_at: string;
  status: Briefing["status"];
  external_action_allowed: false;
  distribution: {
    classification: "internal_draft";
    client_delivery_allowed: false;
    review_notice: string;
  };
  executive_summary: string;
  decision_queue: Array<{
    key: string;
    priority: number;
    label: string;
    detail: string;
    href: string;
  }>;
  risk_register: Array<{
    publication_id: string;
    title: string;
    source_code: string;
    impact_bucket: string;
    impact_score: number;
    review_status: string;
    review_readiness: string;
    service_offering_ids: string[];
    href: string;
  }>;
  control_posture: {
    source_freshness: SourceFreshnessSignal;
    product_map_routing_ready: boolean;
    product_map_blockers: Array<{ id: string; name: string }>;
    review_ready_items: number;
    review_blocked_items: number;
    approved_alert_drafts: number;
  };
  integrity: {
    algorithm: "sha256";
    digest: string;
    raw_publication_text_included: false;
  };
};

export function buildBriefingDossier(input: {
  briefing: Briefing;
  sourceFreshness: SourceFreshnessSignal;
  productMapReadiness: ProductMapReadinessSignal;
}): BriefingDossier {
  const unsigned = {
    schema: "horizon-scanner.briefing-dossier.v1" as const,
    generated_at: input.briefing.generatedAt,
    status: input.briefing.status,
    external_action_allowed: false as const,
    distribution: {
      classification: "internal_draft" as const,
      client_delivery_allowed: false as const,
      review_notice:
        "This dossier contains reviewed metadata and decision context only. It cannot send alerts, publish content, or replace legal review.",
    },
    executive_summary: input.briefing.executiveSummary,
    decision_queue: input.briefing.actions.map((action) => ({
      key: action.key,
      priority: action.priority,
      label: action.label,
      detail: action.detail,
      href: action.href,
    })),
    risk_register: input.briefing.riskQueue.map((item) => ({
      publication_id: item.publicationId,
      title: item.title,
      source_code: item.sourceCode,
      impact_bucket: item.impactBucket,
      impact_score: item.impactScore,
      review_status: item.reviewStatus,
      review_readiness: item.readinessLabel,
      service_offering_ids: item.serviceOfferingIds,
      href: item.href,
    })),
    control_posture: {
      source_freshness: input.sourceFreshness,
      product_map_routing_ready: input.productMapReadiness.ready,
      product_map_blockers: input.productMapReadiness.blockingMaps.map(({ productMap }) => ({
        id: productMap.id,
        name: productMap.name,
      })),
      review_ready_items: input.briefing.metrics.reviewReady,
      review_blocked_items: input.briefing.metrics.reviewBlocked,
      approved_alert_drafts: input.briefing.metrics.approvedAlerts,
    },
  };

  return {
    ...unsigned,
    integrity: {
      algorithm: "sha256",
      digest: createHash("sha256").update(stableStringify(unsigned)).digest("hex"),
      raw_publication_text_included: false,
    },
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
