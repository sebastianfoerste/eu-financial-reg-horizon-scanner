import type { AgentKind } from "@prisma/client";

import { listAlerts } from "@/lib/alerts";
import { classifyPublication, classifyPublicationStub } from "@/lib/ai/classification";
import { listAuditLogs } from "@/lib/audit";
import { assertAgentCapability, assertAgentLlmPolicy } from "@/lib/agents/policy";
import type {
  AgentArtifactDraft,
  AgentDefinitionConfig,
  AgentExecutionResult,
  AgentRunInput,
  AgentRunStepDraft,
} from "@/lib/agents/types";
import { getEnv } from "@/lib/env";
import { buildPilotBriefing } from "@/lib/pilot-briefing";
import { getProductMapDeliveryReadiness, listProductMaps } from "@/lib/product-maps";
import { getPublicationParagraphDiffs, listPublications } from "@/lib/publications";
import { listReviewQueue } from "@/lib/review";
import { summarizeReviewReadiness } from "@/lib/review-readiness";
import { listServiceCatalogue } from "@/lib/service-offerings";
import { listSourceDiligence } from "@/lib/source-diligence";
import { assessSourceFreshness, summarizeSourceFreshness } from "@/lib/source-health";

type AgentImplementation = (input: {
  definition: AgentDefinitionConfig;
  run: AgentRunInput;
}) => Promise<AgentExecutionResult>;

function step(stepKey: string, input: unknown, output: unknown): AgentRunStepDraft {
  return {
    stepKey,
    input,
    output,
    status: "SUCCEEDED",
  };
}

function artifact(input: AgentArtifactDraft): AgentArtifactDraft {
  return {
    status: "DRAFT",
    ...input,
  };
}

function limitCount(input: AgentRunInput, fallback = 10) {
  return Math.max(1, Math.min(input.limit ?? fallback, 50));
}

async function executeSourceMonitor({ definition }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "source:read");
  assertAgentCapability(definition, "source_diligence:read");
  assertAgentCapability(definition, "source_finding:create");

  const sources = await listSourceDiligence();
  const assessments = sources.map((source) => ({
    source,
    freshness: assessSourceFreshness(source),
  }));
  const artifacts = assessments
    .filter(({ freshness }) => freshness.blocksSla || freshness.needsPoll)
    .map(({ source, freshness }) =>
      artifact({
        type: freshness.blocksSla ? "FINDING" : "SOURCE_DILIGENCE_NOTE",
        title: `${source.sourceName}: ${freshness.label}`,
        summary: freshness.detail,
        payload: {
          sourceCode: source.sourceCode,
          status: freshness.status,
          blocksSla: freshness.blocksSla,
          needsPoll: freshness.needsPoll,
          nextDueAt: freshness.nextDueAt,
          reuseStatus: source.reuseStatus,
        },
        provenance: {
          sourceId: source.sourceId,
          lastFetchedAt: source.lastFetchedAt,
          lastRun: source.lastRun,
          agent: definition.id,
        },
      }),
    );

  return {
    steps: [
      step("load-source-diligence", { count: sources.length }, { count: sources.length }),
      step("assess-source-freshness", { count: assessments.length }, { artifacts: artifacts.length }),
    ],
    artifacts,
  };
}

async function executeReviewQa({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "review_queue:read");
  assertAgentCapability(definition, "review_suggestion:create");

  const reviewItems = await listReviewQueue(run.organisationId ?? undefined);
  const analyzed = reviewItems.map((item) => ({
    item,
    readiness: summarizeReviewReadiness(item),
  }));
  const artifacts = analyzed
    .filter(({ readiness }) => !readiness.readyForAlertDraft || readiness.warningCount > 0)
    .slice(0, limitCount(run))
    .map(({ item, readiness }) =>
      artifact({
        type: "REVIEW_SUGGESTION",
        title: `${item.publication.sourceCode.toUpperCase()}: review readiness for ${item.publication.title}`,
        summary: readiness.readyForAlertDraft
          ? `${readiness.warningCount} warning item needs reviewer attention before relying on alert content.`
          : `${readiness.blockingCount} blocking item prevents alert draft generation.`,
        organisationId: run.organisationId ?? null,
        publicationId: item.publicationId,
        payload: {
          reviewStatus: item.status,
          readyForAlertDraft: readiness.readyForAlertDraft,
          checks: readiness.checks,
        },
        provenance: {
          reviewQueueItemId: item.id,
          taxonomyVersion: item.publication.taxonomyVersion,
          agent: definition.id,
        },
      }),
    );

  return {
    steps: [
      step("load-review-queue", { organisationId: run.organisationId ?? null }, { count: reviewItems.length }),
      step("summarize-review-readiness", { count: analyzed.length }, { artifacts: artifacts.length }),
    ],
    artifacts,
  };
}

async function executeBriefing({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "briefing_artifact:create");
  assertAgentCapability(definition, "product_map:read_local");

  const [publications, reviewItems, alerts, sourceDiligence, productMapReadiness, productMaps] = await Promise.all([
    listPublications({}, run.organisationId ?? undefined),
    listReviewQueue(run.organisationId ?? undefined),
    listAlerts(run.organisationId ?? undefined),
    listSourceDiligence(),
    getProductMapDeliveryReadiness(run.organisationId ?? undefined),
    listProductMaps(run.organisationId ?? undefined),
  ]);
  const briefing = buildPilotBriefing({
    publications,
    reviewItems,
    alerts,
    sourceFreshness: summarizeSourceFreshness(sourceDiligence),
    productMapReadiness,
    productMaps,
  });

  return {
    steps: [
      step(
        "load-briefing-snapshot",
        { organisationId: run.organisationId ?? null },
        {
          publications: publications.length,
          reviewItems: reviewItems.length,
          alerts: alerts.length,
          productMaps: productMaps.length,
        },
      ),
      step("build-briefing", { status: briefing.status }, { actions: briefing.actions.length }),
    ],
    artifacts: [
      artifact({
        type: "BRIEFING_DRAFT",
        title: `Pilot briefing: ${briefing.status.toLowerCase().replaceAll("_", " ")}`,
        summary: briefing.executiveSummary,
        organisationId: run.organisationId ?? null,
        payload: briefing,
        provenance: {
          agent: definition.id,
          source: "buildPilotBriefing",
          delivery: "internal-only",
        },
      }),
    ],
  };
}

async function executeClassificationTriage({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "publication:read");
  assertAgentCapability(definition, "taxonomy:read");
  assertAgentCapability(definition, "review_suggestion:create");

  const env = getEnv();
  const publications = await listPublications({}, run.organisationId ?? undefined);
  const candidates = publications
    .filter((publication) =>
      run.publicationId
        ? publication.id === run.publicationId
        : publication.confidence < 0.76 || publication.classifierStatus !== "GENERATED",
    )
    .slice(0, limitCount(run, 8));

  const artifacts: AgentArtifactDraft[] = [];
  for (const publication of candidates) {
    const generated =
      env.HORIZON_AGENT_LLM_ENABLED && definition.llmPolicy === "PUBLICATION_ONLY"
        ? (assertAgentLlmPolicy(definition, { containsClientFacts: false }),
          await classifyPublication({
            title: publication.title,
            bodyText: publication.bodyText,
            sourceCode: publication.sourceCode,
            language: publication.language,
            publicationType: publication.publicationType,
          }))
        : classifyPublicationStub({
            title: publication.title,
            bodyText: publication.bodyText,
            sourceCode: publication.sourceCode,
            language: publication.language,
            publicationType: publication.publicationType,
          });

    artifacts.push(
      artifact({
        type: "REVIEW_SUGGESTION",
        title: `Classification triage: ${publication.title}`,
        summary: `Suggested ${generated.regulationFamilies.join(", ") || "no"} regulation family tags with confidence ${generated.confidence.toFixed(2)}.`,
        organisationId: run.organisationId ?? null,
        publicationId: publication.id,
        payload: {
          current: {
            regulationFamilies: publication.tags.regulationFamilies,
            activities: publication.tags.activities,
            licenceTypes: publication.tags.licenceTypes,
            topicPaths: publication.tags.topicPaths,
            jurisdictions: publication.tags.jurisdictions,
            confidence: publication.confidence,
          },
          suggested: generated,
        },
        provenance: {
          agent: definition.id,
          classifierModel: generated.classifierModel,
          classifierVersion: generated.classifierVersion,
          llmPolicy: definition.llmPolicy,
          publicTextOnly: true,
        },
      }),
    );
  }

  return {
    steps: [
      step("load-publications", { organisationId: run.organisationId ?? null }, { count: publications.length }),
      step("classify-public-text", { candidates: candidates.length }, { artifacts: artifacts.length }),
    ],
    artifacts,
    model: env.HORIZON_AGENT_LLM_ENABLED ? env.HORIZON_AI_MODEL : "deterministic-classification-stub",
    promptVersion: "classification-triage-v1",
    costCents: 0,
  };
}

async function executeDiffExplainer({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "publication:read");
  assertAgentCapability(definition, "paragraph_diff:read");
  assertAgentCapability(definition, "review_suggestion:create");

  const publications = await listPublications({}, run.organisationId ?? undefined);
  const candidates = publications
    .filter((publication) => (run.publicationId ? publication.id === run.publicationId : true))
    .slice(0, limitCount(run, 8));
  const artifacts: AgentArtifactDraft[] = [];

  for (const publication of candidates) {
    const diffs = await getPublicationParagraphDiffs(publication.id);
    const changed = diffs.filter((diff) => diff.changeType !== "UNCHANGED");
    if (!changed.length) continue;

    artifacts.push(
      artifact({
        type: "REVIEW_SUGGESTION",
        title: `Diff explanation: ${publication.title}`,
        summary: `${changed.length} changed paragraph${changed.length === 1 ? "" : "s"} need reviewer attention.`,
        organisationId: run.organisationId ?? null,
        publicationId: publication.id,
        payload: {
          changedParagraphs: changed.map((diff) => ({
            paragraphIndex: diff.paragraphIndex,
            changeType: diff.changeType,
            summary:
              diff.semanticSummary ??
              diff.afterText?.slice(0, 240) ??
              diff.beforeText?.slice(0, 240) ??
              "Textual change captured without semantic summary.",
          })),
        },
        provenance: {
          agent: definition.id,
          publicTextOnly: true,
          diffCount: changed.length,
        },
      }),
    );
  }

  return {
    steps: [
      step("load-publication-diffs", { candidates: candidates.length }, { artifacts: artifacts.length }),
    ],
    artifacts,
    model: "deterministic-paragraph-diff-summary",
    promptVersion: "diff-explainer-v1",
  };
}

async function executeImpactExplanation({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "impact_score:read");
  assertAgentCapability(definition, "impact_explanation:create");

  const publications = await listPublications({}, run.organisationId ?? undefined);
  const artifacts = publications
    .filter((publication) =>
      run.publicationId
        ? publication.id === run.publicationId
        : ["CRITICAL", "HIGH", "MEDIUM"].includes(publication.impactBucket),
    )
    .slice(0, limitCount(run, 10))
    .map((publication) =>
      artifact({
        type: "IMPACT_EXPLANATION",
        title: `Impact explanation: ${publication.title}`,
        summary: `${publication.impactBucket} impact at ${publication.impactScore}/100 under ${publication.scoringRuleVersion}.`,
        organisationId: run.organisationId ?? null,
        publicationId: publication.id,
        payload: {
          bucket: publication.impactBucket,
          score: publication.impactScore,
          rawScore: publication.rawImpactScore,
          floorAdjustment: publication.impactFloorAdjustment,
          ruleVersion: publication.scoringRuleVersion,
          matchedLicences: publication.matchedLicences,
          matchedActivities: publication.matchedActivities,
          matchedJurisdictions: publication.matchedJurisdictions,
          matchedTopics: publication.matchedTopics,
          criticalProductLineMatched: publication.criticalProductLineMatched,
          rationale: publication.scoreRationale,
        },
        provenance: {
          agent: definition.id,
          scoring: "deterministic-local",
          productMapFactsSentToLlm: false,
        },
      }),
    );

  return {
    steps: [
      step("load-impact-scores", { organisationId: run.organisationId ?? null }, { publications: publications.length }),
      step("draft-impact-explanations", { limit: limitCount(run, 10) }, { artifacts: artifacts.length }),
    ],
    artifacts,
  };
}

async function executeAlertDraft({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "review_queue:read");
  assertAgentCapability(definition, "alert_draft:create");
  assertAgentCapability(definition, "delivery:send_blocked");

  const reviewItems = await listReviewQueue(run.organisationId ?? undefined);
  const readyItems = reviewItems
    .filter((item) => summarizeReviewReadiness(item).readyForAlertDraft)
    .slice(0, limitCount(run, 10));
  const artifacts = readyItems.map((item) =>
    artifact({
      type: "ALERT_DRAFT",
      title: `Alert draft preview: ${item.publication.title}`,
      summary: `${item.publication.impactBucket} alert preview prepared. Approval and explicit send remain separate actions.`,
      organisationId: run.organisationId ?? null,
      publicationId: item.publicationId,
        payload: {
          subject: `${item.publication.impactBucket} regulatory alert: ${item.publication.title}`,
          title: item.publication.title,
          sourceUrl: item.publication.sourceUrl,
          publicationUrl: `/publications/${item.publication.id}`,
          impactBucket: item.publication.impactBucket,
          impactScore: item.publication.impactScore,
          rawImpactScore: item.publication.rawImpactScore,
          floorAdjustment: item.publication.impactFloorAdjustment,
          scoringRuleVersion: item.publication.scoringRuleVersion,
          serviceOfferingIds: item.publication.serviceOfferingIds,
          to: null,
          text: [
            item.publication.summary,
            `Impact: ${item.publication.impactBucket} (${item.publication.impactScore}/100)`,
          `Affected: ${item.publication.whoIsAffected}`,
          `Action: ${item.publication.recommendedAction}`,
          `Source: ${item.publication.sourceUrl}`,
        ].join("\n\n"),
        channelAuthority: "draft-only",
        externalDeliveryPermitted: false,
      },
      provenance: {
        agent: definition.id,
        reviewQueueItemId: item.id,
        reviewStatus: item.status,
        delivery: "blocked-until-alert-approval-and-explicit-send",
      },
    }),
  );

  return {
    steps: [
      step("load-approved-review-items", { organisationId: run.organisationId ?? null }, { ready: readyItems.length }),
      step("prepare-alert-draft-artifacts", { ready: readyItems.length }, { artifacts: artifacts.length }),
    ],
    artifacts,
  };
}

async function executeServiceRouting({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "service_catalogue:read");
  assertAgentCapability(definition, "service_rule_suggestion:create");

  const [publications, services] = await Promise.all([
    listPublications({}, run.organisationId ?? undefined),
    listServiceCatalogue(),
  ]);
  const artifacts = publications
    .filter((publication) => publication.serviceOfferingIds.length === 0 || publication.confidence < 0.5)
    .slice(0, limitCount(run, 10))
    .map((publication) =>
      artifact({
        type: "SERVICE_RULE_SUGGESTION",
        title: `Service routing review: ${publication.title}`,
        summary: publication.serviceOfferingIds.length
          ? "Low-confidence classification should be checked before relying on service routing."
          : "No active service package is attached to this publication.",
        organisationId: run.organisationId ?? null,
        publicationId: publication.id,
        payload: {
          currentServiceOfferingIds: publication.serviceOfferingIds,
          candidateRuleAxes: {
            regulationFamilies: publication.tags.regulationFamilies,
            topicPaths: publication.tags.topicPaths,
            licenceTypes: publication.tags.licenceTypes,
          },
          availableServices: services.map((service) => ({
            id: service.id,
            name: service.name,
            active: service.isActive,
          })),
        },
        provenance: {
          agent: definition.id,
          source: "service catalogue governance",
        },
      }),
    );

  return {
    steps: [
      step("load-service-catalogue", {}, { services: services.length }),
      step("detect-routing-gaps", { publications: publications.length }, { artifacts: artifacts.length }),
    ],
    artifacts,
  };
}

async function executeAuditQa({ definition, run }: { definition: AgentDefinitionConfig; run: AgentRunInput }) {
  assertAgentCapability(definition, "audit:read");
  assertAgentCapability(definition, "alert:read");

  const [auditLogs, alerts, reviewItems] = await Promise.all([
    listAuditLogs(run.organisationId ?? undefined),
    listAlerts(run.organisationId ?? undefined),
    listReviewQueue(run.organisationId ?? undefined),
  ]);
  const failedAlerts = alerts.filter((alert) => ["FAILED", "BLOCKED_BY_CONFIG"].includes(alert.status));
  const staleReviewItems = reviewItems.filter((item) => {
    const updatedAt = new Date(item.updatedAt).getTime();
    return ["PENDING", "IN_REVIEW", "NEEDS_CHANGES"].includes(item.status) && Date.now() - updatedAt > 7 * 24 * 60 * 60 * 1000;
  });
  const blockedEvents = auditLogs.filter((log) => log.action.includes("blocked"));
  const artifacts: AgentArtifactDraft[] = [];

  if (failedAlerts.length) {
    artifacts.push(
      artifact({
        type: "FINDING",
        title: "Delivery failures need operator review",
        summary: `${failedAlerts.length} alert${failedAlerts.length === 1 ? "" : "s"} are failed or blocked by configuration.`,
        organisationId: run.organisationId ?? null,
        payload: {
          alerts: failedAlerts.map((alert) => ({
            id: alert.id,
            channel: alert.channel,
            status: alert.status,
            errorMessage: alert.errorMessage,
          })),
        },
        provenance: { agent: definition.id, source: "alerts" },
      }),
    );
  }

  if (staleReviewItems.length) {
    artifacts.push(
      artifact({
        type: "FINDING",
        title: "Review items are older than seven days",
        summary: `${staleReviewItems.length} review item${staleReviewItems.length === 1 ? "" : "s"} have stayed open for more than seven days.`,
        organisationId: run.organisationId ?? null,
        payload: {
          reviewItems: staleReviewItems.map((item) => ({
            id: item.id,
            publicationId: item.publicationId,
            status: item.status,
            updatedAt: item.updatedAt,
          })),
        },
        provenance: { agent: definition.id, source: "review queue" },
      }),
    );
  }

  if (blockedEvents.length) {
    artifacts.push(
      artifact({
        type: "FINDING",
        title: "Blocked workflow events detected",
        summary: `${blockedEvents.length} blocked event${blockedEvents.length === 1 ? "" : "s"} appear in the audit log.`,
        organisationId: run.organisationId ?? null,
        payload: {
          events: blockedEvents.slice(0, 10).map((log) => ({
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            createdAt: log.createdAt,
          })),
        },
        provenance: { agent: definition.id, source: "audit log" },
      }),
    );
  }

  return {
    steps: [
      step("load-audit-snapshot", {}, { auditLogs: auditLogs.length, alerts: alerts.length, reviewItems: reviewItems.length }),
      step("detect-qa-findings", {}, { artifacts: artifacts.length }),
    ],
    artifacts,
  };
}

export const agentImplementations: Record<AgentKind, AgentImplementation> = {
  SOURCE_MONITOR: executeSourceMonitor,
  REVIEW_QA: executeReviewQa,
  BRIEFING: executeBriefing,
  CLASSIFICATION_TRIAGE: executeClassificationTriage,
  DIFF_EXPLAINER: executeDiffExplainer,
  IMPACT_EXPLANATION: executeImpactExplanation,
  ALERT_DRAFT: executeAlertDraft,
  SERVICE_ROUTING: executeServiceRouting,
  AUDIT_QA: executeAuditQa,
};
