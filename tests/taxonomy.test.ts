import { describe, expect, it } from "vitest";

import {
  assertTaxonomyValue,
  getPublicationTypes,
  getRegulationFamilies,
  getJurisdictionValues,
  getTopicPaths,
  loadTaxonomy,
} from "@/lib/taxonomy";

describe("taxonomy", () => {
  it("loads the delivered taxonomy and exposes the main axes", () => {
    const taxonomy = loadTaxonomy();

    expect(taxonomy.version).toBe("2026.05.27");
    expect(getRegulationFamilies(taxonomy)).toContain("micar");
    expect(taxonomy.activity).toContain("custody_safekeeping_crypto");
    expect(taxonomy.licence_type).toContain("casp_micar");
    expect(getTopicPaths(taxonomy)).toContain("digital_assets_specific.white_paper_review");
    expect(getJurisdictionValues(taxonomy)).toContain("eu");
    expect(getPublicationTypes(taxonomy)).toContain("q_and_a_published");
  });

  it("rejects unknown taxonomy values", () => {
    expect(() => assertTaxonomyValue("licence_type", "invented_licence")).toThrow(
      "Unknown taxonomy value",
    );
  });

  it("keeps service-offering trigger values within the controlled taxonomy", () => {
    const taxonomy = loadTaxonomy();
    const axes = {
      regulation_family: "regulation_family",
      activity: "activity",
      licence_type: "licence_type",
      topic: "topic",
      jurisdiction: "jurisdiction",
    } as const;

    for (const offering of taxonomy.service_offerings) {
      for (const [axis, values] of Object.entries(offering.triggers)) {
        for (const value of values) {
          expect(() => assertTaxonomyValue(axes[axis as keyof typeof axes], value)).not.toThrow();
        }
      }
    }
  });
});
