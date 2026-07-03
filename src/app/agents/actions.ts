"use server";

import type { AgentArtifactStatus, AgentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listAgentDefinitions } from "@/lib/agents/config";
import { isAgentKind } from "@/lib/agents/policy";
import { applyAgentArtifact, runAgent, updateAgentArtifactStatus } from "@/lib/agents/runner";
import { getActiveOrganisationId, requireInternalOperator } from "@/lib/authz";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readKind(value: string): AgentKind {
  if (!isAgentKind(value)) throw new Error(`Unknown agent kind: ${value}`);
  return value;
}

export async function runAgentAction(formData: FormData) {
  const operator = await requireInternalOperator();
  const organisationId = await getActiveOrganisationId();
  const kind = readKind(readText(formData, "kind"));
  const publicationId = readText(formData, "publicationId") || null;
  const result = await runAgent({
    kind,
    trigger: "manual",
    organisationId,
    triggeredByUserId: operator.userId,
    publicationId,
  });
  revalidatePath("/agents");
  if (publicationId) revalidatePath(`/publications/${publicationId}`);
  redirect(`/agents/${result.id}`);
}

export async function runEnabledAgentsAction() {
  const operator = await requireInternalOperator();
  const organisationId = await getActiveOrganisationId();
  const definitions = listAgentDefinitions().filter((definition) => definition.enabled);
  for (const definition of definitions) {
    await runAgent({
      kind: definition.kind,
      trigger: "manual",
      organisationId,
      triggeredByUserId: operator.userId,
    });
  }
  revalidatePath("/agents");
  revalidatePath("/briefing");
  redirect("/agents?suite=1");
}

async function updateArtifact(formData: FormData, status: Extract<AgentArtifactStatus, "APPROVED" | "DISMISSED" | "APPLIED">) {
  const operator = await requireInternalOperator();
  const organisationId = await getActiveOrganisationId();
  const artifactId = readText(formData, "artifactId");
  await updateAgentArtifactStatus({
    artifactId,
    status,
    reviewedById: operator.userId,
    organisationId,
  });
  revalidatePath("/agents");
}

export async function approveAgentArtifactAction(formData: FormData) {
  await updateArtifact(formData, "APPROVED");
}

export async function dismissAgentArtifactAction(formData: FormData) {
  await updateArtifact(formData, "DISMISSED");
}

export async function applyAgentArtifactAction(formData: FormData) {
  const operator = await requireInternalOperator();
  const organisationId = await getActiveOrganisationId();
  const artifactId = readText(formData, "artifactId");
  await applyAgentArtifact({
    artifactId,
    reviewedById: operator.userId,
    organisationId,
  });
  revalidatePath("/agents");
  revalidatePath("/alerts");
}
