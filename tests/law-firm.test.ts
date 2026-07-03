import { describe, expect, it } from "vitest";

import {
  buildClientBriefBody,
  buildDemoLawFirmWorkbench,
  demoMatterProfiles,
  getLawFirmImplementationPlan,
  scorePublicationForMatter,
} from "@/lib/law-firm";
import { mockPublications } from "@/lib/mock-data";

describe("law firm mode", () => {
  it("builds detailed implementation plans for the three target firm profiles", () => {
    const plans = getLawFirmImplementationPlan();

    expect(plans.map((plan) => plan.firmExample)).toEqual(["Kirkland & Ellis", "YPOG", "Annerton"]);
    expect(plans.every((plan) => plan.workflow.length >= 4)).toBe(true);
    expect(plans.every((plan) => plan.productChanges.length >= 4)).toBe(true);
    expect(plans.every((plan) => plan.reviewGate.toLowerCase().includes("approval"))).toBe(true);
  });

  it("scores MiCAR publications against a tech-boutique authorisation matter", () => {
    const caspMatter = demoMatterProfiles.find((matter) => matter.id === "matter-casp-zag-authorisation");
    const micarPublication = mockPublications.find((publication) => publication.id === "pub-esma-qa-2845");

    expect(caspMatter).toBeDefined();
    expect(micarPublication).toBeDefined();

    const scored = scorePublicationForMatter(micarPublication!, caspMatter!);

    expect(scored.bucket).toBe("HIGH");
    expect(scored.score).toBeGreaterThanOrEqual(65);
    expect(scored.matches.regulationFamilies).toContain("micar");
    expect(scored.matches.licenceTypes).toContain("casp_micar");
  });

  it("keeps restricted specialist matters behind an explicit ethical wall", () => {
    const workbench = buildDemoLawFirmWorkbench();
    const restrictedMatter = workbench.matters.find((matter) => matter.id === "matter-emi-dora-outsourcing");

    expect(restrictedMatter).toBeDefined();
    expect(restrictedMatter?.accessPolicy).toBe("RESTRICTED");
    expect(restrictedMatter?.ethicalWalls).toHaveLength(1);
    expect(restrictedMatter?.ethicalWalls[0]).toMatchObject({
      accessPolicy: "RESTRICTED",
      name: "Restricted implementation matter team",
    });
  });

  it("generates internal client brief text with provenance and review-gate language", () => {
    const workbench = buildDemoLawFirmWorkbench();
    const matter = workbench.matters.find((item) => item.id === "matter-global-sponsor-diligence");
    const signal = matter?.signals[0];
    const publication = mockPublications.find((item) => item.id === signal?.publicationId);

    expect(matter).toBeDefined();
    expect(signal).toBeDefined();
    expect(publication).toBeDefined();

    const body = buildClientBriefBody({
      matter: matter!,
      publication: publication!,
      signal: signal!,
    });

    expect(body).toContain(`Source: ${publication!.sourceName}`);
    expect(body).toContain("Matter relevance:");
    expect(body).toContain("Status: internal draft for law-firm review");
    expect(body).toContain("Client-facing use requires partner approval");
  });

  it("surfaces commercial opportunities and draft briefs in the workbench", () => {
    const workbench = buildDemoLawFirmWorkbench();

    expect(workbench.metrics.clients).toBe(3);
    expect(workbench.metrics.openMatters).toBe(3);
    expect(workbench.metrics.draftBriefs).toBeGreaterThanOrEqual(3);
    expect(workbench.metrics.identifiedOpportunities).toBe(3);
    expect(workbench.opportunities.map((opportunity) => opportunity.serviceOfferingId)).toEqual(
      expect.arrayContaining(["gc_micar_authorisation", "gc_dora_register", "gc_regulatory_strategy_retainer"]),
    );
  });
});
