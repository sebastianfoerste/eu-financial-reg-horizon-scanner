import type { AgentKind } from "@prisma/client";

import type { AgentCapability, AgentDefinitionConfig } from "@/lib/agents/types";
import { agentKinds } from "@/lib/agents/types";
import { getEnv } from "@/lib/env";

export function assertAgentCapability(definition: AgentDefinitionConfig, capability: AgentCapability) {
  if (!definition.capabilities.includes(capability)) {
    throw new Error(`${definition.name} is not allowed to use capability ${capability}.`);
  }
}

export function isAgentKind(value: string): value is AgentKind {
  return (agentKinds as readonly string[]).includes(value);
}

export function assertAgentsEnabled(kind: AgentKind, trigger: string) {
  const env = getEnv();
  if (!env.HORIZON_AGENTS_ENABLED) {
    throw new Error(`Agent execution is disabled. ${kind} was requested through ${trigger}.`);
  }
}

export function assertAgentLlmPolicy(definition: AgentDefinitionConfig, input: { containsClientFacts?: boolean }) {
  const env = getEnv();
  if (definition.llmPolicy === "NONE") {
    throw new Error(`${definition.name} has no LLM permission.`);
  }
  if (!env.HORIZON_AGENT_LLM_ENABLED) {
    throw new Error("Agent LLM execution is disabled.");
  }
  if (input.containsClientFacts && definition.llmPolicy !== "REDACTED_LOCAL_FACTS") {
    throw new Error("Client or product-map facts cannot be sent to publication-only agent LLM calls.");
  }
}

export function assertAgentCostBudget(definition: AgentDefinitionConfig) {
  const env = getEnv();
  if (definition.maxCostCents > env.HORIZON_AGENT_MAX_COST_CENTS_PER_RUN) {
    throw new Error(
      `${definition.name} exceeds the per-run agent cost budget of ${env.HORIZON_AGENT_MAX_COST_CENTS_PER_RUN} cents.`,
    );
  }
}

export function redactLocalFactsForLlm(input: Record<string, unknown>) {
  const blockedKeys = new Set([
    "organisationName",
    "legalName",
    "licenceReference",
    "primaryContact",
    "hubspotCompanyId",
    "customerSegment",
    "thirdPartyProvider",
    "notes",
  ]);

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, blockedKeys.has(key) ? "[redacted]" : value]),
  );
}
