import { inferSourceAuthorityLevel, type SourceAuthorityLevel } from "@/lib/source-hierarchy";
import type { SourceDiligenceView } from "@/lib/source-diligence";

export type SourceCurrencyQueueItem = {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  baseUrl: string;
  authorityLevel: SourceAuthorityLevel;
  reuseStatus: SourceDiligenceView["reuseStatus"];
  score: number;
  activeAlertBlockers: number;
  blockers: string[];
  warnings: string[];
  nextAction: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  allowedCadenceMin: number | null;
  lastRunStatus: string | null;
};

export function buildSourceCurrencyQueue(
  sources: SourceDiligenceView[],
  activeAlertBlockers: Record<string, number> = {},
  now = new Date(),
): SourceCurrencyQueueItem[] {
  return sources
    .map((source) => {
      const blockers: string[] = [];
      const warnings: string[] = [];
      let score = 0;
      const authorityLevel = inferSourceAuthorityLevel(source.sourceCode);
      const alertBlockers = activeAlertBlockers[source.sourceCode] ?? 0;

      if (alertBlockers > 0) {
        blockers.push("active-alert-proof-blockers");
        score += 60 + alertBlockers * 3;
      }
      if (source.reuseStatus === "RESTRICTED") {
        blockers.push("restricted-reuse");
        score += 36;
      } else if (source.reuseStatus === "REVIEW_REQUIRED") {
        blockers.push("reuse-review-required");
        score += 28;
      } else if (source.reuseStatus === "UNKNOWN") {
        warnings.push("reuse-status-unknown");
        score += 20;
      }
      if (!source.lastReviewedAt) {
        blockers.push("source-review-missing");
        score += 32;
      } else if (isPast(source.nextReviewAt, now) || daysBetween(source.lastReviewedAt, now) > 90) {
        blockers.push("source-review-stale");
        score += 30;
      }
      if (!source.allowedCadenceMin) {
        warnings.push("cadence-unknown");
        score += 12;
      }
      if (source.lastRun?.status === "FAILED") {
        blockers.push("last-fetch-failed");
        score += 34;
      }
      if (authorityLevel === "legal_commentary" || authorityLevel === "industry_material") {
        warnings.push("commentary-or-market-context-only");
        score += 18;
      }

      const uniqueBlockers = [...new Set(blockers)].sort();
      const uniqueWarnings = [...new Set(warnings)].sort();

      return {
        sourceId: source.sourceId,
        sourceCode: source.sourceCode,
        sourceName: source.sourceName,
        baseUrl: source.baseUrl,
        authorityLevel,
        reuseStatus: source.reuseStatus,
        score,
        activeAlertBlockers: alertBlockers,
        blockers: uniqueBlockers,
        warnings: uniqueWarnings,
        nextAction: nextAction(uniqueBlockers, uniqueWarnings),
        lastReviewedAt: source.lastReviewedAt,
        nextReviewAt: source.nextReviewAt,
        allowedCadenceMin: source.allowedCadenceMin,
        lastRunStatus: source.lastRun?.status ?? null,
      };
    })
    .sort((left, right) => right.score - left.score || left.sourceName.localeCompare(right.sourceName));
}

function nextAction(blockers: string[], warnings: string[]) {
  if (blockers.includes("active-alert-proof-blockers")) return "Resolve alert proof blockers before external delivery.";
  if (blockers.includes("restricted-reuse")) return "Confirm reuse rights or remove source from live polling.";
  if (blockers.includes("source-review-missing")) return "Complete source diligence review.";
  if (blockers.includes("source-review-stale")) return "Refresh source diligence and reviewer notes.";
  if (blockers.includes("last-fetch-failed")) return "Inspect the latest fetch run and retry from fixture-backed parsing.";
  if (warnings.includes("cadence-unknown")) return "Set an approved polling cadence.";
  if (warnings.includes("commentary-or-market-context-only")) return "Pair commentary with an official primary or supervisory source.";
  return "Source is current for reviewed scanning.";
}

function isPast(value: string | null, now: Date) {
  return value ? new Date(value).getTime() <= now.getTime() : false;
}

function daysBetween(value: string, now: Date) {
  return Math.floor(Math.max(0, now.getTime() - new Date(value).getTime()) / 86_400_000);
}
