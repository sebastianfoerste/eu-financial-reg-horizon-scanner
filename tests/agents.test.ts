import { describe, expect, it } from "vitest";

import { listAgentDefinitions } from "@/lib/agents/config";
import { assertAgentCapability, redactLocalFactsForLlm } from "@/lib/agents/policy";
import { applyAgentArtifact, runAgent, updateAgentArtifactStatus } from "@/lib/agents/runner";

describe("agent registry and policy", () => {
  it("loads the versioned agent registry with bounded capabilities", () => {
    const definitions = listAgentDefinitions();

    expect(definitions).toHaveLength(9);
    expect(definitions.map((definition) => definition.kind)).toContain("ALERT_DRAFT");
    expect(definitions.find((definition) => definition.kind === "CLASSIFICATION_TRIAGE")).toMatchObject({
      llmPolicy: "PUBLICATION_ONLY",
    });
  });

  it("enforces default-deny capability checks", () => {
    const sourceMonitor = listAgentDefinitions().find((definition) => definition.kind === "SOURCE_MONITOR");
    expect(sourceMonitor).toBeDefined();
    expect(() => assertAgentCapability(sourceMonitor!, "source:read")).not.toThrow();
    expect(() => assertAgentCapability(sourceMonitor!, "alert_draft:create")).toThrow(/not allowed/);
  });

  it("redacts local client facts before any future local-fact LLM policy use", () => {
    expect(
      redactLocalFactsForLlm({
        legalName: "Design Partner CASP GmbH",
        licenceReference: "DE-123",
        publicSourceCode: "esma",
      }),
    ).toEqual({
      legalName: "[redacted]",
      licenceReference: "[redacted]",
      publicSourceCode: "esma",
    });
  });
});

describe("agent runner", () => {
  it("runs deterministic review QA in demo mode and creates review suggestion artifacts", async () => {
    const run = await runAgent({ kind: "REVIEW_QA", trigger: "manual" });

    expect(run.status).toBe("SUCCEEDED");
    expect(run.steps.map((step) => step.stepKey)).toContain("summarize-review-readiness");
    expect(run.artifacts.every((artifact) => artifact.type === "REVIEW_SUGGESTION")).toBe(true);
  });

  it("keeps alert draft agents draft-only and delivery-blocked", async () => {
    const run = await runAgent({ kind: "ALERT_DRAFT", trigger: "manual" });
    const alertDraft = run.artifacts.find((artifact) => artifact.type === "ALERT_DRAFT");

    expect(run.status).toBe("SUCCEEDED");
    expect(run.steps.map((step) => step.stepKey)).toContain("load-approved-review-items");
    expect(alertDraft?.payloadJson).toMatchObject({
      externalDeliveryPermitted: false,
      impactBucket: "HIGH",
      publicationUrl: "/publications/pub-esma-qa-2845",
    });
  });

  it("uses deterministic classification triage unless agent LLM execution is enabled", async () => {
    const run = await runAgent({ kind: "CLASSIFICATION_TRIAGE", trigger: "manual", limit: 1 });

    expect(run.model).toBe("deterministic-classification-stub");
    expect(run.artifacts[0]?.provenanceJson).toMatchObject({
      publicTextOnly: true,
    });
  });

  it("allows artifact review status updates to stay no-op safe in demo mode", async () => {
    await expect(
      updateAgentArtifactStatus({
        artifactId: "demo-artifact",
        status: "DISMISSED",
      }),
    ).resolves.toMatchObject({ ok: true, mode: "demo", status: "DISMISSED" });
  });

  it("keeps artifact application no-op safe in demo mode", async () => {
    await expect(
      applyAgentArtifact({
        artifactId: "demo-artifact",
      }),
    ).resolves.toMatchObject({ ok: true, mode: "demo", applied: false });
  });
});
