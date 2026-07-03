import type { AgentArtifactStatus, AgentKind, Prisma } from "@prisma/client";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { syncAgentDefinitions, getAgentDefinition, listAgentDefinitions } from "@/lib/agents/config";
import { agentImplementations } from "@/lib/agents/implementations";
import { assertAgentCostBudget, assertAgentsEnabled } from "@/lib/agents/policy";
import type {
  AgentArtifactDraft,
  AgentArtifactView,
  AgentExecutionResult,
  AgentRunDetail,
  AgentRunInput,
  AgentRunSummary,
} from "@/lib/agents/types";
import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import { mockPublications } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";

const AgentAlertDraftPayloadSchema = z.object({
  subject: z.string().min(1),
  text: z.string().min(1),
  title: z.string().min(1),
  sourceUrl: z.string().min(1),
  publicationUrl: z.string().min(1),
  impactBucket: z.string().min(1),
  impactScore: z.number(),
  rawImpactScore: z.number().optional(),
  floorAdjustment: z.number().optional(),
  scoringRuleVersion: z.string().optional(),
  serviceOfferingIds: z.array(z.string()).default([]),
  to: z.string().nullable().optional(),
  externalDeliveryPermitted: z.literal(false),
});

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function definitionName(kind: AgentKind) {
  return getAgentDefinition(kind).name;
}

function demoRunId(kind: AgentKind) {
  return `agent-demo-${kind.toLowerCase().replaceAll("_", "-")}`;
}

function toDemoArtifactView(
  runId: string,
  kind: AgentKind,
  draft: AgentArtifactDraft,
  index: number,
): AgentArtifactView {
  return {
    id: `${runId}-artifact-${index}`,
    agentRunId: runId,
    kind,
    agentName: definitionName(kind),
    type: draft.type,
    status: draft.status ?? "DRAFT",
    title: draft.title,
    summary: draft.summary,
    organisationId: draft.organisationId ?? null,
    publicationId: draft.publicationId ?? null,
    productMapId: draft.productMapId ?? null,
    payloadJson: draft.payload,
    provenanceJson: draft.provenance,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedById: null,
  };
}

async function executeAgent(definitionKind: AgentKind, input: AgentRunInput): Promise<AgentExecutionResult> {
  const definition = getAgentDefinition(definitionKind);
  const implementation = agentImplementations[definitionKind];
  return implementation({ definition, run: input });
}

function mapDbArtifact(artifact: {
  id: string;
  agentRunId: string;
  type: AgentArtifactView["type"];
  status: AgentArtifactView["status"];
  title: string;
  summary: string;
  organisationId: string | null;
  publicationId: string | null;
  productMapId: string | null;
  payloadJson: Prisma.JsonValue;
  provenanceJson: Prisma.JsonValue;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedById: string | null;
  agentRun: {
    kind: AgentKind;
    definition: { name: string } | null;
  };
}): AgentArtifactView {
  return {
    id: artifact.id,
    agentRunId: artifact.agentRunId,
    kind: artifact.agentRun.kind,
    agentName: artifact.agentRun.definition?.name ?? definitionName(artifact.agentRun.kind),
    type: artifact.type,
    status: artifact.status,
    title: artifact.title,
    summary: artifact.summary,
    organisationId: artifact.organisationId,
    publicationId: artifact.publicationId,
    productMapId: artifact.productMapId,
    payloadJson: artifact.payloadJson,
    provenanceJson: artifact.provenanceJson,
    createdAt: artifact.createdAt.toISOString(),
    reviewedAt: artifact.reviewedAt?.toISOString() ?? null,
    reviewedById: artifact.reviewedById,
  };
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunDetail> {
  const definition = getAgentDefinition(input.kind);
  assertAgentsEnabled(input.kind, input.trigger);
  assertAgentCostBudget(definition);
  if (!definition.enabled) throw new Error(`${definition.name} is disabled in config/agents.yaml.`);

  const runInput = {
    ...input,
    organisationId: input.organisationId ?? null,
    triggeredByUserId: input.triggeredByUserId ?? null,
  };
  const inputHash = sha256(stableJson(runInput));

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    const result = await executeAgent(input.kind, runInput);
    const runId = demoRunId(input.kind);
    const outputHash = sha256(stableJson(result));
    return {
      id: runId,
      kind: input.kind,
      name: definition.name,
      description: definition.description,
      status: "SUCCEEDED",
      enabled: definition.enabled,
      trigger: input.trigger,
      agentVersion: definition.version,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      errorMessage: null,
      artifactCount: result.artifacts.length,
      latestArtifactTitle: result.artifacts[0]?.title ?? null,
      inputHash,
      outputHash,
      model: result.model ?? null,
      promptVersion: result.promptVersion ?? null,
      costCents: result.costCents ?? null,
      steps: result.steps.map((item, index) => ({
        id: `${runId}-step-${index}`,
        stepKey: item.stepKey,
        status: item.status ?? "SUCCEEDED",
        inputJson: item.input,
        outputJson: item.output ?? null,
        errorMessage: item.errorMessage ?? null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      })),
      artifacts: result.artifacts.map((artifact, index) => toDemoArtifactView(runId, input.kind, artifact, index)),
    };
  }

  await syncAgentDefinitions();
  const prisma = getPrisma();
  const definitionRow = await prisma.agentDefinition.findUniqueOrThrow({
    where: { id: definition.id },
  });
  const run = await prisma.agentRun.create({
    data: {
      agentDefinitionId: definitionRow.id,
      kind: input.kind,
      status: "RUNNING",
      organisationId: input.organisationId ?? null,
      triggeredByUserId: input.triggeredByUserId ?? null,
      trigger: input.trigger,
      agentVersion: definition.version,
      inputHash,
    },
  });

  try {
    const result = await executeAgent(input.kind, runInput);
    const outputHash = sha256(stableJson(result));

    await prisma.agentRunStep.createMany({
      data: result.steps.map((item) => ({
        agentRunId: run.id,
        stepKey: item.stepKey,
        status: item.status ?? "SUCCEEDED",
        inputJson: jsonValue(item.input),
        outputJson: jsonValue(item.output ?? null),
        errorMessage: item.errorMessage ?? null,
        finishedAt: new Date(),
      })),
    });

    for (const draft of result.artifacts) {
      await prisma.agentArtifact.create({
        data: {
          agentRunId: run.id,
          organisationId: draft.organisationId ?? input.organisationId ?? null,
          publicationId: draft.publicationId ?? null,
          productMapId: draft.productMapId ?? null,
          type: draft.type,
          status: draft.status ?? "DRAFT",
          title: draft.title,
          summary: draft.summary,
          payloadJson: jsonValue(draft.payload),
          provenanceJson: jsonValue(draft.provenance),
        },
      });
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outputHash,
        model: result.model ?? null,
        promptVersion: result.promptVersion ?? null,
        costCents: result.costCents ?? null,
      },
    });

    await writeAuditLog({
      action: "agent.run",
      entityType: "agent_run",
      entityId: run.id,
      actorUserId: input.triggeredByUserId ?? null,
      organisationId: input.organisationId ?? null,
      payloadJson: {
        kind: input.kind,
        artifacts: result.artifacts.length,
        trigger: input.trigger,
      },
    });

    const detail = await getAgentRun(run.id);
    if (!detail) throw new Error("Agent run completed but could not be reloaded.");
    return detail;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent failure";
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    await writeAuditLog({
      action: "agent.run.failed",
      entityType: "agent_run",
      entityId: run.id,
      actorUserId: input.triggeredByUserId ?? null,
      organisationId: input.organisationId ?? null,
      payloadJson: { kind: input.kind, errorMessage: message },
    });
    throw error;
  }
}

export async function listAgentRuns(organisationId?: string | null): Promise<AgentRunSummary[]> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return listAgentDefinitions().map((definition) => ({
      id: demoRunId(definition.kind),
      kind: definition.kind,
      name: definition.name,
      description: definition.description,
      status: definition.enabled ? "READY" : "DISABLED",
      enabled: definition.enabled,
      trigger: definition.schedule ? "scheduled" : "manual",
      agentVersion: definition.version,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      errorMessage: null,
      artifactCount: 0,
      latestArtifactTitle: null,
    }));
  }

  await syncAgentDefinitions();
  const runs = await getPrisma().agentRun.findMany({
    where: organisationId ? { organisationId } : undefined,
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      definition: true,
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { artifacts: true },
      },
    },
  });

  return runs.map((run) => ({
    id: run.id,
    kind: run.kind,
    name: run.definition?.name ?? definitionName(run.kind),
    description: run.definition?.description ?? getAgentDefinition(run.kind).description,
    status: run.status,
    enabled: run.definition?.enabled ?? true,
    trigger: run.trigger,
    agentVersion: run.agentVersion,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    artifactCount: run._count.artifacts,
    latestArtifactTitle: run.artifacts[0]?.title ?? null,
  }));
}

export async function getAgentRun(id: string): Promise<AgentRunDetail | null> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    const definition = listAgentDefinitions().find((agent) => demoRunId(agent.kind) === id);
    if (!definition) return null;
    return runAgent({ kind: definition.kind, trigger: "manual" });
  }

  const run = await getPrisma().agentRun.findUnique({
    where: { id },
    include: {
      definition: true,
      steps: { orderBy: { startedAt: "asc" } },
      artifacts: {
        orderBy: { createdAt: "desc" },
        include: {
          agentRun: {
            include: { definition: true },
          },
        },
      },
    },
  });
  if (!run) return null;

  return {
    id: run.id,
    kind: run.kind,
    name: run.definition?.name ?? definitionName(run.kind),
    description: run.definition?.description ?? getAgentDefinition(run.kind).description,
    status: run.status,
    enabled: run.definition?.enabled ?? true,
    trigger: run.trigger,
    agentVersion: run.agentVersion,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage,
    artifactCount: run.artifacts.length,
    latestArtifactTitle: run.artifacts[0]?.title ?? null,
    inputHash: run.inputHash,
    outputHash: run.outputHash,
    model: run.model,
    promptVersion: run.promptVersion,
    costCents: run.costCents,
    steps: run.steps.map((item) => ({
      id: item.id,
      stepKey: item.stepKey,
      status: item.status,
      inputJson: item.inputJson,
      outputJson: item.outputJson,
      errorMessage: item.errorMessage,
      startedAt: item.startedAt.toISOString(),
      finishedAt: item.finishedAt?.toISOString() ?? null,
    })),
    artifacts: run.artifacts.map(mapDbArtifact),
  };
}

export async function listLatestAgentArtifacts(input: {
  organisationId?: string | null;
  publicationId?: string | null;
  take?: number;
} = {}): Promise<AgentArtifactView[]> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    const publication = input.publicationId
      ? mockPublications.find((item) => item.id === input.publicationId)
      : mockPublications[0];
    if (!publication) return [];
    const runId = demoRunId("IMPACT_EXPLANATION");
    return [
      toDemoArtifactView(
        runId,
        "IMPACT_EXPLANATION",
        {
          type: "IMPACT_EXPLANATION",
          title: `Impact explanation: ${publication.title}`,
          summary: `${publication.impactBucket} impact at ${publication.impactScore}/100 under ${publication.scoringRuleVersion}.`,
          publicationId: publication.id,
          payload: {
            bucket: publication.impactBucket,
            score: publication.impactScore,
            rationale: publication.scoreRationale,
          },
          provenance: { mode: "demo" },
        },
        0,
      ),
    ];
  }

  const artifacts = await getPrisma().agentArtifact.findMany({
    where: {
      organisationId: input.organisationId ?? undefined,
      publicationId: input.publicationId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 20,
    include: {
      agentRun: {
        include: { definition: true },
      },
    },
  });

  return artifacts.map(mapDbArtifact);
}

export async function updateAgentArtifactStatus(input: {
  artifactId: string;
  status: Extract<AgentArtifactStatus, "APPROVED" | "DISMISSED" | "APPLIED">;
  reviewedById?: string | null;
  organisationId?: string | null;
}) {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return { ok: true, mode: "demo" as const, status: input.status };
  }

  const artifact = await getPrisma().agentArtifact.update({
    where: { id: input.artifactId },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedById: input.reviewedById ?? null,
    },
  });
  await writeAuditLog({
    action: `agent.artifact.${input.status.toLowerCase()}`,
    entityType: "agent_artifact",
    entityId: artifact.id,
    actorUserId: input.reviewedById ?? null,
    organisationId: input.organisationId ?? artifact.organisationId,
    payloadJson: { type: artifact.type, publicationId: artifact.publicationId },
  });
  return { ok: true, mode: "database" as const, status: artifact.status };
}

export async function applyAgentArtifact(input: {
  artifactId: string;
  reviewedById?: string | null;
  organisationId?: string | null;
}) {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return { ok: true, mode: "demo" as const, applied: false, reason: "Demo mode records no database mutations." };
  }

  const prisma = getPrisma();
  const artifact = await prisma.agentArtifact.findUniqueOrThrow({
    where: { id: input.artifactId },
    include: {
      agentRun: {
        include: { definition: true },
      },
    },
  });

  if (artifact.status !== "APPROVED") {
    throw new Error("Only approved agent artifacts can be applied.");
  }
  if (artifact.type !== "ALERT_DRAFT") {
    throw new Error("Only alert draft artifacts have an automatic apply action in this pass.");
  }
  if (!artifact.organisationId || !artifact.publicationId) {
    throw new Error("Alert draft artifacts require organisation and publication IDs before application.");
  }

  const payload = AgentAlertDraftPayloadSchema.parse(artifact.payloadJson);
  const existing = await prisma.alert.findFirst({
    where: {
      organisationId: artifact.organisationId,
      publicationId: artifact.publicationId,
      channel: "IN_APP",
      status: { in: ["DRAFT", "APPROVED", "SENDING", "SENT"] },
      targetMetadataJson: {
        path: ["agentArtifactId"],
        equals: artifact.id,
      },
    },
  });

  const alert =
    existing ??
    (await prisma.alert.create({
      data: {
        organisationId: artifact.organisationId,
        publicationId: artifact.publicationId,
        channel: "IN_APP",
        status: "DRAFT",
        scheduledFor: new Date(),
        payloadJson: jsonValue({
          ...payload,
          subject: `[Agent preview] ${payload.subject}`,
        }),
        targetMetadataJson: {
          provider: "IN_APP",
          agentArtifactId: artifact.id,
          agentRunId: artifact.agentRunId,
          externalDeliveryPermitted: false,
        },
      },
    }));

  await prisma.agentArtifact.update({
    where: { id: artifact.id },
    data: {
      status: "APPLIED",
      reviewedAt: new Date(),
      reviewedById: input.reviewedById ?? null,
    },
  });

  await writeAuditLog({
    action: "agent.artifact.apply",
    entityType: "agent_artifact",
    entityId: artifact.id,
    actorUserId: input.reviewedById ?? null,
    organisationId: input.organisationId ?? artifact.organisationId,
    payloadJson: {
      type: artifact.type,
      createdAlertId: alert.id,
      channel: "IN_APP",
      externalDeliveryPermitted: false,
    },
  });

  return { ok: true, mode: "database" as const, applied: true, alertId: alert.id };
}
