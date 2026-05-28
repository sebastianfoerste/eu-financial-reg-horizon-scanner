import { describe, expect, it } from "vitest";

import { buildOperatorActions } from "@/lib/operator-command-center";

describe("operator command center", () => {
  it("prioritises footprint confirmation before review and alert work", () => {
    const actions = buildOperatorActions({
      highImpactCount: 2,
      reviewItems: [{ status: "PENDING" }, { status: "APPROVED" }],
      alerts: [{ status: "DRAFT" }, { status: "APPROVED" }],
      sourceFreshness: { stale: 0, pollable: 0 },
      footprintReadiness: {
        ready: false,
        blockingMaps: [{ productMap: { id: "pm-1", name: "CASP footprint" } }],
      },
      runtimeChecks: [],
    });

    expect(actions.map((action) => action.key).slice(0, 4)).toEqual([
      "footprint",
      "review",
      "send",
      "drafts",
    ]);
    expect(actions[0]).toMatchObject({
      title: "Confirm client footprint",
      href: "/product-maps/pm-1",
      metric: "1",
      tone: "urgent",
    });
  });

  it("counts delivery and runtime blocks without hiding high-impact publications", () => {
    const actions = buildOperatorActions({
      highImpactCount: 3,
      reviewItems: [],
      alerts: [{ status: "BLOCKED_BY_CONFIG" }, { status: "FAILED" }, { status: "SENT" }],
      sourceFreshness: { stale: 0, pollable: 0 },
      footprintReadiness: { ready: true, blockingMaps: [] },
      runtimeChecks: [
        { ok: true, severity: "info" },
        { ok: false, severity: "warning" },
      ],
    });

    expect(actions.map((action) => action.key)).toEqual(["delivery", "runtime", "high-impact"]);
    expect(actions.find((action) => action.key === "delivery")?.metric).toBe("2");
    expect(actions.find((action) => action.key === "high-impact")?.href).toBe("/?bucket=HIGH");
  });

  it("puts stale source freshness ahead of other work", () => {
    const actions = buildOperatorActions({
      highImpactCount: 4,
      reviewItems: [{ status: "PENDING" }],
      alerts: [{ status: "APPROVED" }],
      sourceFreshness: { stale: 2, pollable: 3 },
      footprintReadiness: { ready: true, blockingMaps: [] },
      runtimeChecks: [],
    });

    expect(actions[0]).toMatchObject({
      key: "source-freshness",
      href: "/sources",
      metric: "2",
      tone: "urgent",
    });
  });

  it("returns a calm clear state when no operator action is waiting", () => {
    expect(
      buildOperatorActions({
        highImpactCount: 0,
        reviewItems: [],
        alerts: [],
        sourceFreshness: { stale: 0, pollable: 0 },
        footprintReadiness: { ready: true, blockingMaps: [] },
        runtimeChecks: [{ ok: true, severity: "info" }],
      }),
    ).toEqual([
      {
        key: "clear",
        title: "Action queue clear",
        detail: "No immediate review, alert or runtime action is waiting.",
        href: "/sources",
        metric: "0",
        tone: "success",
        priority: 0,
      },
    ]);
  });
});
