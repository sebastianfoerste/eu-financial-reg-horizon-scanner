import { describe, expect, it } from "vitest";

import { buildScoreExplanation } from "@/lib/score-explanation";

describe("score explanation", () => {
  it("surfaces every scoring component used in the UI", () => {
    const explanation = buildScoreExplanation({
      publicationType: "q_and_a_published",
      classification: {
        regulationFamilies: ["micar"],
        activities: ["custody_safekeeping_crypto"],
        licenceTypes: ["casp_micar"],
        topicPaths: ["digital_assets_specific.white_paper_review"],
        jurisdictions: ["eu"],
      },
      matchedLicences: ["casp_micar"],
      matchedActivities: ["custody_safekeeping_crypto"],
      matchedJurisdictions: ["eu"],
      matchedHomeJurisdictions: ["eu"],
      matchedPassportJurisdictions: [],
      matchedTopics: ["digital_assets_specific.white_paper_review"],
      criticalProductLineMatched: true,
      floorAdjustment: 0,
    });

    expect(explanation.items.map((item) => item.label)).toEqual([
      "Licence match",
      "Activity overlap",
      "Jurisdiction match",
      "Watchlist topic",
      "Critical product line",
      "Publication-type floor",
    ]);
    expect(explanation.items.every((item) => typeof item.points === "number")).toBe(true);
    expect(explanation.items.at(-1)?.points).toBe(0);
  });

  it("shows the stored passport weight without inventing a floor uplift", () => {
    const explanation = buildScoreExplanation({
      publicationType: "q_and_a_published",
      classification: {
        regulationFamilies: ["micar"],
        activities: [],
        licenceTypes: ["casp_micar"],
        topicPaths: [],
        jurisdictions: ["eu"],
      },
      matchedLicences: ["casp_micar"],
      matchedJurisdictions: ["eu"],
      matchedHomeJurisdictions: [],
      matchedPassportJurisdictions: ["eu"],
      floorAdjustment: 0,
    });

    expect(explanation.items.find((item) => item.label === "Jurisdiction match")?.points).toBe(10);
    expect(explanation.items.find((item) => item.label === "Publication-type floor")?.points).toBe(0);
  });
});
