import { describe, expect, it, vi } from "vitest";

import {
  buildPublicClassificationPrompt,
  classifyPublicationWithRuntime,
  validateGeneratedClassification,
} from "@/lib/ai/classification";

const publicPublication = {
  title: "ESMA Q&A on modified MiCA white papers",
  bodyText: "ESMA sets out the machine-readable format for modified MiCA white papers.",
  sourceCode: "esma",
  language: "en",
  publicationType: "q_and_a_published",
};

describe("publication-only classification", () => {
  it("keeps deterministic classification active until a provider is configured", async () => {
    const generate = vi.fn();
    const result = await classifyPublicationWithRuntime(
      publicPublication,
      { provider: "stub", model: "stub-classifier-v0", gatewayAuthenticated: false },
      generate,
    );

    expect(result.classifierStatus).toBe("STUB");
    expect(result.serviceOfferingIds).toContain("gc_micar_white_paper");
    expect(generate).not.toHaveBeenCalled();
  });

  it("validates structured provider output and maps services through deterministic rules", async () => {
    const result = await classifyPublicationWithRuntime(
      publicPublication,
      { provider: "gateway", model: "google/example-classifier", gatewayAuthenticated: true },
      async () => ({
        regulationFamilies: ["micar", "micar"],
        subTopics: ["white_paper"],
        activities: ["issuance_of_other_crypto_assets"],
        licenceTypes: ["casp_micar"],
        topicPaths: ["digital_assets_specific.white_paper_review"],
        jurisdictions: ["eu", "esma"],
        summary: "ESMA clarifies machine-readable MiCA white paper submissions.",
        whatChanged: "The Q&A clarifies the required filing format.",
        whoIsAffected: "Offerors and persons seeking admission to trading.",
        deadline: null,
        recommendedAction: "Review pending modified white paper submissions.",
        confidence: 0.93,
      }),
    );

    expect(result.classifierStatus).toBe("GENERATED");
    expect(result.regulationFamilies).toEqual(["micar"]);
    expect(result.serviceOfferingIds).toEqual(["gc_micar_white_paper"]);
  });

  it("records a visible deterministic fallback when generated tags are invalid", async () => {
    const result = await classifyPublicationWithRuntime(
      publicPublication,
      { provider: "gateway", model: "google/example-classifier", gatewayAuthenticated: true },
      async () => ({
        regulationFamilies: ["invented_regulation"],
        subTopics: [],
        activities: [],
        licenceTypes: [],
        topicPaths: [],
        jurisdictions: ["eu"],
        summary: "Invalid output.",
        whatChanged: null,
        whoIsAffected: null,
        deadline: null,
        recommendedAction: null,
        confidence: 0.1,
      }),
    );

    expect(result.classifierStatus).toBe("FALLBACK");
    expect(result.classifierError).toContain("Deterministic classification");
    expect(result.regulationFamilies).toContain("micar");
  });

  it("builds prompts exclusively from public publication inputs and bounded taxonomy context", () => {
    const prompt = buildPublicClassificationPrompt(publicPublication);

    expect(prompt).toContain(publicPublication.bodyText);
    expect(prompt).toContain("Source authority code: esma");
    expect(prompt).toContain("Regulation families:");
    expect(prompt).not.toContain("product map");
  });

  it("rejects unknown taxonomy values from a provider result", () => {
    expect(() =>
      validateGeneratedClassification({
        regulationFamilies: ["micar"],
        subTopics: ["invented_subtopic"],
        activities: [],
        licenceTypes: [],
        topicPaths: [],
        jurisdictions: ["eu"],
        summary: "Summary.",
        whatChanged: null,
        whoIsAffected: null,
        deadline: null,
        recommendedAction: null,
        confidence: 0.5,
      }),
    ).toThrow("Unknown taxonomy value");
  });
});
