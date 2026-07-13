import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/canonical-json";
import type { ReviewQueueView } from "@/lib/review";
import { summarizeReviewReadiness } from "@/lib/review-readiness";
import type { SourceDiligenceView } from "@/lib/source-diligence";
import { inferSourceAuthorityLevel, type SourceAuthorityLevel } from "@/lib/source-hierarchy";

export type RegulatoryActionProofSummary = {
  gateStatus: string;
  sourceReviewState: string;
  payloadDigest: string;
  reasons: string[];
  createdAt: string;
};

export type RegulatoryActionParagraphDiffInput = {
  paragraphIndex: number;
  changeType: "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";
  beforeHash?: string | null;
  afterHash?: string | null;
  beforeText?: string | null;
  afterText?: string | null;
  semanticSummary: string | null;
};

export type RegulatoryActionChangeProof = {
  paragraph_diff_count: number;
  changed_paragraphs: Array<{
    paragraph_index: number;
    change_type: "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";
    before_hash: string | null;
    after_hash: string | null;
    semantic_summary: string | null;
  }>;
  text_retention: "hashes_only";
};

export type RegulatoryActionPacket = {
  schema: "horizon-scanner.regulatory-action-packet.v1";
  generated_at: string;
  publication_id: string;
  review_item_id: string;
  action_summary: {
    title: string;
    summary: string;
    what_changed: string;
    recommended_action: string;
  };
  affected_tags: {
    licence_types: string[];
    activities: string[];
    topic_paths: string[];
    jurisdictions: string[];
  };
  source_status: {
    source_code: string;
    source_name: string;
    source_url: string;
    authority_level: SourceAuthorityLevel;
    reuse_status: string;
    last_reviewed_at: string | null;
    next_review_at: string | null;
  };
  review_gate: {
    status: ReviewQueueView["status"];
    ready_for_alert_draft: boolean;
    blockers: string[];
  };
  alert_eligibility: {
    eligible: boolean;
    latest_gate_status: string | null;
    latest_payload_digest: string | null;
    reasons: string[];
  };
  change_proof: RegulatoryActionChangeProof;
  service_routing_hints: {
    service_offering_ids: string[];
    impact_bucket: string;
    impact_score: number;
    scoring_rule_version: string;
  };
  blockers: string[];
  warnings: string[];
  digest: string;
  review_notice: string;
};

export function buildRegulatoryActionPacket(input: {
  reviewItem: ReviewQueueView;
  sourceDiligence?: SourceDiligenceView | null;
  alertProofPackets?: RegulatoryActionProofSummary[];
  paragraphDiffs?: RegulatoryActionParagraphDiffInput[];
  generatedAt?: string;
}): RegulatoryActionPacket {
  const publication = input.reviewItem.publication;
  const readiness = summarizeReviewReadiness(input.reviewItem);
  const latestProof = [...(input.alertProofPackets ?? [])].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];
  const blockers = readiness.checks.filter((check) => check.status === "BLOCK").map((check) => check.key);
  const warnings: string[] = [];
  if (!input.sourceDiligence) {
    warnings.push("source-diligence-missing");
  }
  if (latestProof?.gateStatus === "blocked") {
    blockers.push("alert-proof-blocked");
  }

  const unsigned = {
    schema: "horizon-scanner.regulatory-action-packet.v1" as const,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    publication_id: publication.id,
    review_item_id: input.reviewItem.id,
    action_summary: {
      title: capText(publication.title, 180),
      summary: capText(publication.summary, 360),
      what_changed: capText(publication.whatChanged, 360),
      recommended_action: capText(publication.recommendedAction, 300),
    },
    affected_tags: {
      licence_types: publication.tags.licenceTypes,
      activities: publication.tags.activities,
      topic_paths: publication.tags.topicPaths,
      jurisdictions: publication.tags.jurisdictions,
    },
    source_status: {
      source_code: publication.sourceCode,
      source_name: publication.sourceName,
      source_url: publication.sourceUrl,
      authority_level: inferSourceAuthorityLevel(publication.sourceCode),
      reuse_status: input.sourceDiligence?.reuseStatus ?? "UNKNOWN",
      last_reviewed_at: input.sourceDiligence?.lastReviewedAt ?? null,
      next_review_at: input.sourceDiligence?.nextReviewAt ?? null,
    },
    review_gate: {
      status: input.reviewItem.status,
      ready_for_alert_draft: readiness.readyForAlertDraft,
      blockers: readiness.checks.filter((check) => check.status === "BLOCK").map((check) => check.key),
    },
    alert_eligibility: {
      eligible: readiness.readyForAlertDraft && latestProof?.gateStatus !== "blocked",
      latest_gate_status: latestProof?.gateStatus ?? null,
      latest_payload_digest: latestProof?.payloadDigest ?? null,
      reasons: latestProof?.reasons ?? [],
    },
    change_proof: buildChangeProof(input.paragraphDiffs ?? []),
    service_routing_hints: {
      service_offering_ids: publication.serviceOfferingIds,
      impact_bucket: publication.impactBucket,
      impact_score: publication.impactScore,
      scoring_rule_version: publication.scoringRuleVersion,
    },
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
    review_notice: "Regulatory action packets contain reviewed metadata, digests, and routing hints only. Human review remains mandatory before alert delivery or client use.",
  };

  return {
    ...unsigned,
    digest: createHash("sha256").update(stableStringify(unsigned)).digest("hex"),
  };
}

function buildChangeProof(diffs: RegulatoryActionParagraphDiffInput[]): RegulatoryActionChangeProof {
  const changed = diffs.filter((diff) => diff.changeType !== "UNCHANGED");

  return {
    paragraph_diff_count: changed.length,
    changed_paragraphs: changed.map((diff) => ({
      paragraph_index: diff.paragraphIndex,
      change_type: diff.changeType,
      before_hash: diff.beforeHash ?? hashOptionalText(diff.beforeText),
      after_hash: diff.afterHash ?? hashOptionalText(diff.afterText),
      semantic_summary: capOptionalText(diff.semanticSummary, 220),
    })),
    text_retention: "hashes_only",
  };
}

function hashOptionalText(value: string | null | undefined) {
  return value ? createHash("sha256").update(value, "utf8").digest("hex") : null;
}

function capOptionalText(value: string | null | undefined, limit: number) {
  if (!value) return null;
  return capText(value, limit);
}

function capText(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit - 3).trim()}...`;
}
