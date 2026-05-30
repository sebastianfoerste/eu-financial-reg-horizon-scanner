import { readFileSync } from "node:fs";
import path from "node:path";

import type { AgentKind } from "@prisma/client";
import { parse } from "yaml";
import { z } from "zod";

import { getPrisma } from "@/lib/prisma";
import {
  agentCapabilities,
  agentKinds,
  agentLlmPolicies,
  type AgentCapability,
  type AgentDefinitionConfig,
} from "@/lib/agents/types";
import { hasDatabaseUrl } from "@/lib/env";

const capabilityValues = agentCapabilities as readonly [AgentCapability, ...AgentCapability[]];

const AgentDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(agentKinds),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  enabled: z.boolean().default(true),
  schedule: z.string().nullable().optional(),
  llmPolicy: z.enum(agentLlmPolicies).default("NONE"),
  maxRuntimeSeconds: z.number().int().positive().default(60),
  maxCostCents: z.number().int().nonnegative().default(0),
  capabilities: z.array(z.enum(capabilityValues)).default([]),
});

const AgentsConfigSchema = z.object({
  version: z.string().min(1),
  agents: z.array(AgentDefinitionSchema).min(1),
});

let cachedAgentsConfig: z.infer<typeof AgentsConfigSchema> | null = null;

export function loadAgentsConfig() {
  if (!cachedAgentsConfig) {
    const filePath = path.join(process.cwd(), "config", "agents.yaml");
    cachedAgentsConfig = AgentsConfigSchema.parse(parse(readFileSync(filePath, "utf8")));
  }
  return cachedAgentsConfig;
}

export function listAgentDefinitions(): AgentDefinitionConfig[] {
  return loadAgentsConfig().agents.map((agent) => ({
    ...agent,
    schedule: agent.schedule ?? null,
  }));
}

export function getAgentDefinition(kind: AgentKind) {
  const definition = listAgentDefinitions().find((agent) => agent.kind === kind);
  if (!definition) throw new Error(`Unknown agent kind: ${kind}`);
  return definition;
}

export async function syncAgentDefinitions() {
  if (!hasDatabaseUrl()) return { synced: 0, mode: "demo" as const };

  const prisma = getPrisma();
  let synced = 0;
  for (const definition of listAgentDefinitions()) {
    await prisma.agentDefinition.upsert({
      where: { id: definition.id },
      update: {
        kind: definition.kind,
        name: definition.name,
        description: definition.description,
        version: definition.version,
        enabled: definition.enabled,
        schedule: definition.schedule,
        capabilities: definition.capabilities,
        llmPolicy: definition.llmPolicy,
        maxRuntimeSeconds: definition.maxRuntimeSeconds,
        maxCostCents: definition.maxCostCents,
      },
      create: {
        id: definition.id,
        kind: definition.kind,
        name: definition.name,
        description: definition.description,
        version: definition.version,
        enabled: definition.enabled,
        schedule: definition.schedule,
        capabilities: definition.capabilities,
        llmPolicy: definition.llmPolicy,
        maxRuntimeSeconds: definition.maxRuntimeSeconds,
        maxCostCents: definition.maxCostCents,
      },
    });

    for (const capability of definition.capabilities) {
      await prisma.agentToolPermission.upsert({
        where: {
          agentDefinitionId_capability: {
            agentDefinitionId: definition.id,
            capability,
          },
        },
        update: { isEnabled: true },
        create: {
          agentDefinitionId: definition.id,
          capability,
          isEnabled: true,
        },
      });
    }
    await prisma.agentToolPermission.updateMany({
      where: {
        agentDefinitionId: definition.id,
        capability: { notIn: definition.capabilities },
      },
      data: { isEnabled: false },
    });
    synced += 1;
  }

  return { synced, mode: "database" as const };
}
