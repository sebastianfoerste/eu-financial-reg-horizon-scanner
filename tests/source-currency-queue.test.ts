import { describe, expect, it } from "vitest";

import { buildSourceCurrencyQueue } from "@/lib/source-currency-queue";
import type { SourceDiligenceView } from "@/lib/source-diligence";

const now = new Date("2026-06-16T09:00:00.000Z");

function source(overrides: Partial<SourceDiligenceView>): SourceDiligenceView {
  return {
    id: `diligence-${overrides.sourceCode ?? "esma"}`,
    sourceId: overrides.sourceId ?? overrides.sourceCode ?? "esma",
    sourceCode: overrides.sourceCode ?? "esma",
    sourceName: overrides.sourceName ?? "ESMA",
    baseUrl: overrides.baseUrl ?? "https://example.test",
    reuseStatus: overrides.reuseStatus ?? "ATTRIBUTION_REQUIRED",
    attributionRequirement: null,
    robotsNotes: null,
    allowedCadenceMin: overrides.allowedCadenceMin ?? 60,
    lastReviewedAt: overrides.lastReviewedAt ?? "2026-06-01T00:00:00.000Z",
    nextReviewAt: overrides.nextReviewAt ?? "2026-09-01T00:00:00.000Z",
    ownerNotes: null,
    lastFetchedAt: overrides.lastFetchedAt ?? "2026-06-16T08:00:00.000Z",
    lastRun: overrides.lastRun ?? { status: "OK", finishedAt: "2026-06-16T08:00:00.000Z", message: null },
  };
}

describe("source currency queue", () => {
  it("ranks stale official sources, restricted reuse, failed fetches, and alert blockers above current supervisory sources", () => {
    const queue = buildSourceCurrencyQueue(
      [
        source({
          sourceCode: "esma",
          sourceName: "ESMA current",
        }),
        source({
          sourceCode: "bafin",
          sourceName: "BaFin stale",
          lastReviewedAt: "2026-01-01T00:00:00.000Z",
          nextReviewAt: "2026-03-01T00:00:00.000Z",
        }),
        source({
          sourceCode: "newsletter",
          sourceName: "Commentary newsletter",
          reuseStatus: "UNKNOWN",
          lastReviewedAt: null,
          nextReviewAt: null,
          allowedCadenceMin: null,
        }),
        source({
          sourceCode: "industry-feed",
          sourceName: "Restricted feed",
          reuseStatus: "RESTRICTED",
          lastRun: { status: "FAILED", finishedAt: "2026-06-16T08:00:00.000Z", message: "Fixture parse failed." },
        }),
      ],
      { bafin: 2 },
      now,
    );

    expect(queue[0].sourceCode).toBe("bafin");
    expect(queue[0].blockers).toContain("active-alert-proof-blockers");
    expect(queue[0].blockers).toContain("source-review-stale");
    expect(queue.find((item) => item.sourceCode === "newsletter")?.warnings).toContain("commentary-or-market-context-only");
    expect(queue.find((item) => item.sourceCode === "industry-feed")?.blockers).toEqual(
      expect.arrayContaining(["restricted-reuse", "last-fetch-failed"]),
    );
    expect(queue.at(-1)?.sourceCode).toBe("esma");
  });
});
