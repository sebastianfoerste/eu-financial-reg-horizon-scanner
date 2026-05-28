import type { SourceDiligenceView } from "@/lib/source-diligence";

export const SOURCE_SLA_HOURS = 24;

export type SourceFreshnessStatus = "CURRENT" | "DUE" | "STALE" | "BLOCKED" | "FAILED" | "NEVER_FETCHED";

export type SourceFreshnessAssessment = {
  status: SourceFreshnessStatus;
  label: string;
  detail: string;
  blocksSla: boolean;
  needsPoll: boolean;
  nextDueAt: string | null;
  hoursSinceFetch: number | null;
};

const HOUR_MS = 60 * 60 * 1000;

function parseDate(value: string | null) {
  return value ? new Date(value) : null;
}

function formatHours(hours: number) {
  if (hours < 1) return "less than 1 hour";
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function assessSourceFreshness(
  source: Pick<
    SourceDiligenceView,
    "reuseStatus" | "allowedCadenceMin" | "lastFetchedAt" | "lastRun" | "sourceName"
  >,
  now = new Date(),
): SourceFreshnessAssessment {
  if (!["REUSE_PERMITTED", "ATTRIBUTION_REQUIRED"].includes(source.reuseStatus)) {
    return {
      status: "BLOCKED",
      label: "Policy blocked",
      detail: `Reuse status ${source.reuseStatus.toLowerCase().replaceAll("_", " ")} blocks live polling.`,
      blocksSla: true,
      needsPoll: false,
      nextDueAt: null,
      hoursSinceFetch: null,
    };
  }

  if (source.lastRun?.status === "FAILED") {
    return {
      status: "FAILED",
      label: "Last run failed",
      detail: source.lastRun.message ?? "The last source fetch failed.",
      blocksSla: true,
      needsPoll: true,
      nextDueAt: null,
      hoursSinceFetch: null,
    };
  }

  const lastFetchedAt = parseDate(source.lastFetchedAt);
  if (!lastFetchedAt) {
    return {
      status: "NEVER_FETCHED",
      label: "Never fetched",
      detail: "No successful fetch timestamp is stored for this source.",
      blocksSla: true,
      needsPoll: true,
      nextDueAt: null,
      hoursSinceFetch: null,
    };
  }

  const elapsedMs = Math.max(0, now.getTime() - lastFetchedAt.getTime());
  const hoursSinceFetch = Math.floor(elapsedMs / HOUR_MS);
  const cadenceMin = source.allowedCadenceMin ?? 60;
  const nextDueAt = new Date(lastFetchedAt.getTime() + cadenceMin * 60_000);

  if (elapsedMs >= SOURCE_SLA_HOURS * HOUR_MS) {
    return {
      status: "STALE",
      label: "SLA stale",
      detail: `Last successful fetch was ${formatHours(hoursSinceFetch)} ago.`,
      blocksSla: true,
      needsPoll: true,
      nextDueAt: nextDueAt.toISOString(),
      hoursSinceFetch,
    };
  }

  if (now.getTime() >= nextDueAt.getTime()) {
    return {
      status: "DUE",
      label: "Poll due",
      detail: `Approved ${cadenceMin}-minute cadence has elapsed.`,
      blocksSla: false,
      needsPoll: true,
      nextDueAt: nextDueAt.toISOString(),
      hoursSinceFetch,
    };
  }

  return {
    status: "CURRENT",
    label: "Fresh",
    detail: `Last successful fetch was ${formatHours(hoursSinceFetch)} ago.`,
    blocksSla: false,
    needsPoll: false,
    nextDueAt: nextDueAt.toISOString(),
    hoursSinceFetch,
  };
}

export function summarizeSourceFreshness(records: SourceDiligenceView[], now = new Date()) {
  const assessed = records.map((source) => ({
    source,
    freshness: assessSourceFreshness(source, now),
  }));

  return {
    assessed,
    current: assessed.filter(({ freshness }) => freshness.status === "CURRENT").length,
    due: assessed.filter(({ freshness }) => freshness.status === "DUE").length,
    blocked: assessed.filter(({ freshness }) => freshness.status === "BLOCKED").length,
    stale: assessed.filter(({ freshness }) => freshness.blocksSla).length,
    pollable: assessed.filter(({ freshness }) => freshness.needsPoll).length,
  };
}
