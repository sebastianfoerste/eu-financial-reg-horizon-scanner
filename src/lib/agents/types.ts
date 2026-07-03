import type { AgentArtifactStatus, AgentArtifactType, AgentKind, AgentLlmPolicy } from "@prisma/client";

export const agentKinds = [
  "SOURCE_MONITOR",
  "REVIEW_QA",
  "BRIEFING",
  "CLASSIFICATION_TRIAGE",
  "DIFF_EXPLAINER",
  "IMPACT_EXPLANATION",
  "ALERT_DRAFT",
  "SERVICE_ROUTING",
  "AUDIT_QA",
] as const satisfies readonly AgentKind[];

export const agentLlmPolicies = ["NONE", "PUBLICATION_ONLY", "REDACTED_LOCAL_FACTS"] as const satisfies readonly AgentLlmPolicy[];

export const agentCapabilities = [
  "publication:read",
  "taxonomy:read",
  "source:read",
  "source_diligence:read",
  "review_queue:read",
  "alert:read",
  "audit:read",
  "service_catalogue:read",
  "impact_score:read",
  "paragraph_diff:read",
  "product_map:read_local",
  "review_suggestion:create",
  "alert_draft:create",
  "briefing_artifact:create",
  "source_finding:create",
  "source_diligence_note:create",
  "impact_explanation:create",
  "service_rule_suggestion:create",
  "ai:publication_only",
  "delivery:send_blocked",
  "audit:write",
] as const;

export type AgentCapability = (typeof agentCapabilities)[number];

export type AgentDefinitionConfig = {
  id: string;
  kind: AgentKind;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  schedule: string | null;
  llmPolicy: AgentLlmPolicy;
  maxRuntimeSeconds: number;
  maxCostCents: number;
  capabilities: AgentCapability[];
};

export type AgentRunTrigger = "manual" | "scheduled" | "api" | "inngest";

export type AgentRunInput = {
  kind: AgentKind;
  trigger: AgentRunTrigger;
  organisationId?: string | null;
  triggeredByUserId?: string | null;
  publicationId?: string | null;
  limit?: number;
};

export type AgentRunStepDraft = {
  stepKey: string;
  input: unknown;
  output?: unknown;
  status?: "SUCCEEDED" | "FAILED" | "BLOCKED_BY_POLICY";
  errorMessage?: string | null;
};

export type AgentArtifactDraft = {
  type: AgentArtifactType;
  status?: AgentArtifactStatus;
  title: string;
  summary: string;
  organisationId?: string | null;
  publicationId?: string | null;
  productMapId?: string | null;
  payload: unknown;
  provenance: unknown;
};

export type AgentExecutionResult = {
  steps: AgentRunStepDraft[];
  artifacts: AgentArtifactDraft[];
  model?: string | null;
  promptVersion?: string | null;
  costCents?: number | null;
};

export type AgentRunSummary = {
  id: string;
  kind: AgentKind;
  name: string;
  description: string;
  status: string;
  enabled: boolean;
  trigger: string;
  agentVersion: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  artifactCount: number;
  latestArtifactTitle: string | null;
};

export type AgentArtifactView = {
  id: string;
  agentRunId: string;
  kind: AgentKind;
  agentName: string;
  type: AgentArtifactType;
  status: AgentArtifactStatus;
  title: string;
  summary: string;
  organisationId: string | null;
  publicationId: string | null;
  productMapId: string | null;
  payloadJson: unknown;
  provenanceJson: unknown;
  createdAt: string;
  reviewedAt: string | null;
  reviewedById: string | null;
};

export type AgentRunDetail = AgentRunSummary & {
  inputHash: string;
  outputHash: string | null;
  model: string | null;
  promptVersion: string | null;
  costCents: number | null;
  steps: Array<{
    id: string;
    stepKey: string;
    status: string;
    inputJson: unknown;
    outputJson: unknown;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
  artifacts: AgentArtifactView[];
};
