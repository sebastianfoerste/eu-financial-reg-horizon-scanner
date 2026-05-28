import { describe, expect, it } from "vitest";

import { scorePublicationForProductMap } from "@/lib/impact-scoring";
import { demoProductMap } from "@/lib/product-maps";
import { loadScoringRules } from "@/lib/scoring-rules";

describe("impact scoring", () => {
  it("scores direct licence, activity, jurisdiction, and watchlist matches as high impact", () => {
    const result = scorePublicationForProductMap({
      publicationType: "q_and_a_published",
      productMap: demoProductMap,
      classification: {
        regulationFamilies: ["micar"],
        licenceTypes: ["casp_micar"],
        activities: ["custody_safekeeping_crypto"],
        topicPaths: ["digital_assets_specific.white_paper_review"],
        jurisdictions: ["de", "bafin"],
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.bucket).toBe("CRITICAL");
    expect(result.matchedLicences).toEqual(["casp_micar"]);
    expect(result.matchedActivities).toEqual(["custody_safekeeping_crypto"]);
  });

  it("keeps unrelated publications out of the alerting buckets", () => {
    const result = scorePublicationForProductMap({
      publicationType: "press_release",
      productMap: demoProductMap,
      classification: {
        regulationFamilies: ["sfdr_taxonomy"],
        licenceTypes: ["aifm"],
        activities: ["benchmark_administration"],
        topicPaths: ["sustainable_finance.sfdr_disclosures"],
        jurisdictions: ["fr", "amf"],
      },
    });

    expect(result.score).toBe(0);
    expect(result.bucket).toBe("NONE");
  });

  it("awards watchlist points only for topics configured on that local product map", () => {
    const result = scorePublicationForProductMap({
      publicationType: "press_release",
      productMap: { ...demoProductMap, topicWatchlist: [], licences: [], productLines: [], jurisdictions: [] },
      classification: {
        regulationFamilies: ["dora"],
        licenceTypes: [],
        activities: [],
        topicPaths: ["ict_and_resilience.third_party_arrangements"],
        jurisdictions: [],
      },
    });

    expect(result.matchedTopics).toEqual([]);
    expect(result.rawScore).toBe(0);
    expect(result.score).toBe(0);
  });

  it("records a publication floor as an uplift rather than an extra scoring component", () => {
    const result = scorePublicationForProductMap({
      publicationType: "q_and_a_published",
      productMap: { ...demoProductMap, topicWatchlist: [], productLines: [], jurisdictions: [] },
      classification: {
        regulationFamilies: ["micar"],
        licenceTypes: ["casp_micar"],
        activities: [],
        topicPaths: [],
        jurisdictions: [],
      },
    });

    expect(result.rawScore).toBe(45);
    expect(result.floorAdjustment).toBe(10);
    expect(result.score).toBe(55);
  });

  it("loads the versioned rule artifact", () => {
    expect(loadScoringRules().version).toBe("2026.05.20-mvp");
  });
});
