import { describe, expect, it } from "vitest";

import { assessSourceFreshness, summarizeSourceFreshness } from "@/lib/source-health";
import type { SourceDiligenceView } from "@/lib/source-diligence";

const now = new Date("2026-05-28T09:00:00.000Z");

function source(partial: Partial<SourceDiligenceView>): SourceDiligenceView {
  return {
    id: "source-diligence-bafin",
    sourceId: "source-bafin",
    sourceCode: "bafin",
    sourceName: "BaFin",
    baseUrl: "https://www.bafin.de",
    reuseStatus: "ATTRIBUTION_REQUIRED",
    attributionRequirement: null,
    robotsNotes: null,
    allowedCadenceMin: 60,
    lastReviewedAt: null,
    nextReviewAt: null,
    ownerNotes: null,
    lastFetchedAt: "2026-05-28T08:30:00.000Z",
    lastRun: { status: "OK", finishedAt: "2026-05-28T08:30:00.000Z", message: null },
    ...partial,
  };
}

describe("source freshness", () => {
  it("keeps recently fetched approved sources current", () => {
    expect(assessSourceFreshness(source({}), now)).toMatchObject({
      status: "CURRENT",
      blocksSla: false,
      needsPoll: false,
    });
  });

  it("marks sources due after cadence without breaching the SLA", () => {
    expect(
      assessSourceFreshness(source({ lastFetchedAt: "2026-05-28T07:30:00.000Z" }), now),
    ).toMatchObject({
      status: "DUE",
      blocksSla: false,
      needsPoll: true,
    });
  });

  it("marks stale and policy-blocked sources as SLA blockers", () => {
    const summary = summarizeSourceFreshness(
      [
        source({ lastFetchedAt: "2026-05-27T08:00:00.000Z" }),
        source({ sourceCode: "bundesbank", reuseStatus: "REVIEW_REQUIRED", lastFetchedAt: null }),
      ],
      now,
    );

    expect(summary.stale).toBe(2);
    expect(summary.assessed.map(({ freshness }) => freshness.status)).toEqual(["STALE", "BLOCKED"]);
  });

  it("surfaces failed fetch runs even with an older successful timestamp", () => {
    expect(
      assessSourceFreshness(
        source({
          lastFetchedAt: "2026-05-28T08:30:00.000Z",
          lastRun: { status: "FAILED", finishedAt: "2026-05-28T08:45:00.000Z", message: "HTTP 500" },
        }),
        now,
      ),
    ).toMatchObject({
      status: "FAILED",
      blocksSla: true,
      needsPoll: true,
      detail: "HTTP 500",
    });
  });
});
