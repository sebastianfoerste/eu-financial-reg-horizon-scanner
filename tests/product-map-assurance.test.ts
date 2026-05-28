import { describe, expect, it } from "vitest";

import {
  assessProductMapConfirmation,
  assessProductMapDeliveryReadiness,
  nextProductMapConfirmationDate,
} from "@/lib/product-map-assurance";

const now = new Date("2026-05-27T12:00:00.000Z");
const currentMap = {
  id: "pm-current",
  name: "Current footprint",
  confirmationRequired: false,
  lastConfirmedAt: new Date("2026-05-20T00:00:00.000Z"),
  nextConfirmationDueAt: new Date("2026-08-20T00:00:00.000Z"),
  confirmedByName: "Reviewer",
};

describe("product map assurance", () => {
  it("calculates the quarterly confirmation due date", () => {
    expect(nextProductMapConfirmationDate(new Date("2026-05-27T00:00:00.000Z")).toISOString()).toBe(
      "2026-08-27T00:00:00.000Z",
    );
  });

  it("keeps confirmed product maps eligible for alert routing", () => {
    const assessment = assessProductMapConfirmation(currentMap, now);

    expect(assessment.status).toBe("CURRENT");
    expect(assessment.blocksAlerts).toBe(false);
    expect(assessProductMapDeliveryReadiness([currentMap], now).ready).toBe(true);
  });

  it("surfaces a coming quarterly confirmation without blocking alerts", () => {
    const assessment = assessProductMapConfirmation(
      { ...currentMap, nextConfirmationDueAt: new Date("2026-06-05T00:00:00.000Z") },
      now,
    );

    expect(assessment.status).toBe("DUE_SOON");
    expect(assessment.blocksAlerts).toBe(false);
  });

  it("blocks routing after score-affecting facts require confirmation", () => {
    const changedMap = { ...currentMap, id: "pm-changed", name: "Changed footprint", confirmationRequired: true };
    const readiness = assessProductMapDeliveryReadiness([currentMap, changedMap], now);

    expect(readiness.ready).toBe(false);
    expect(readiness.blockingMaps.map(({ productMap }) => productMap.id)).toEqual(["pm-changed"]);
    expect(readiness.blockingMaps[0]?.assessment.status).toBe("REQUIRES_CONFIRMATION");
  });

  it("blocks routing when quarterly confirmation is overdue or missing", () => {
    expect(
      assessProductMapConfirmation(
        { ...currentMap, nextConfirmationDueAt: new Date("2026-05-01T00:00:00.000Z") },
        now,
      ).status,
    ).toBe("OVERDUE");
    expect(assessProductMapDeliveryReadiness([], now).ready).toBe(false);
  });
});
