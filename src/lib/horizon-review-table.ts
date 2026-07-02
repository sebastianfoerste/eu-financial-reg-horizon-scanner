import type { AlertStatus } from "@prisma/client";

import type { AlertView } from "@/lib/alerts";
import type { PublicationListItem } from "@/lib/mock-data";
import type { ProductMapConfirmationAssessment } from "@/lib/product-map-assurance";
import type { ReviewQueueView } from "@/lib/review";
import { assessSourceFreshness } from "@/lib/source-health";
import type { SourceDiligenceView } from "@/lib/source-diligence";

type DeliveryReadiness = {
  ready: boolean;
  message: string;
  blockingMaps: Array<{
    productMap: {
      id: string;
      name: string;
    };
    assessment: ProductMapConfirmationAssessment;
  }>;
};

export type HorizonReviewTableRow = {
  id: string;
  publicationId: string;
  title: string;
  sourceName: string;
  sourceFreshness: string;
  affectedProducts: string[];
  assignedReviewer: string;
  reviewStatus: string;
  proofPacketStatus: "ready" | "blocked" | "missing" | "draft_only";
  citationCoverage: "complete" | "partial" | "blocked";
  alertStatus: AlertStatus | "NO_DRAFT";
  deliveryStatus: "ready_for_delivery" | "draft_only" | "blocked";
  blockers: string[];
  nextAction: string;
};

export type HorizonReviewTableSummary = {
  totalRows: number;
  blockedRows: number;
  readyRows: number;
  draftOnlyRows: number;
  missingProofPackets: number;
};

export type HorizonWorkflowRoute = {
  key: string;
  label: string;
  status: "ready" | "review_required" | "blocked";
  route: "deterministic_local" | "draft_agent" | "external_delivery";
  gate: string;
};

export type HorizonSourceConnector = {
  key: string;
  label: string;
  status: "enabled" | "review_required" | "blocked";
  scope: string;
  gate: string;
};

export type HorizonFutureBulkExtractionPolicy = {
  schema: "horizon-scanner.future-llm-bulk-extraction.v1";
  enabled: false;
  runner: "inngest";
  concurrencyPerOrganisationOrSourceGroup: 1;
  retryStrategy: "exponential_backoff";
  idempotencyKeyParts: string[];
  deliverySideEffectsAllowed: false;
};

export type HorizonReviewControlProfile = {
  schema: "horizon-scanner.alert-review-control.v1";
  externalActionAllowed: false;
  routeSummary: string;
  contextWindowStrategy: string;
  workflowRoutes: HorizonWorkflowRoute[];
  sourceConnectors: HorizonSourceConnector[];
  futureBulkExtractionPolicy: HorizonFutureBulkExtractionPolicy;
};

export type HorizonReviewTableScale = {
  schema: "horizon-scanner.review-table-scale.v1";
  rowCount: number;
  columnCount: number;
  columnIds: string[];
  estimatedCellTasks: number;
  maxVaultDocuments: number;
  resetStrategy: string;
  needleInHaystackStrategy: string;
};

export type HorizonPromptImprovementBrief = {
  schema: "horizon-scanner.alert-prompt-brief.v1";
  objective: string;
  actor: string;
  jurisdiction: string;
  sourceHierarchy: string[];
  requiredInputs: string[];
  outputFormat: string[];
  reviewGate: string;
  failureConditions: string[];
  suggestedPrompt: string;
};

export type HorizonMonitorAOSLayer = {
  key:
    | "large_language_models"
    | "agentic_harness"
    | "data_integrations"
    | "context_knowledge"
    | "legal_capabilities"
    | "products_interfaces"
    | "security_governance";
  label: string;
  status: "implemented" | "metadata_only" | "blocked";
  evidence: string;
  gate: string;
};

export type HorizonMonitorSkill = {
  id: string;
  label: string;
  objective: string;
  outputSchema: string[];
  reviewGate: string;
  externalActionAllowed: false;
};

export type HorizonMonitorProfile = {
  schema: "horizon-scanner.monitor-review.v1";
  aosLayers: HorizonMonitorAOSLayer[];
  agentPlan: Record<"plan" | "execute" | "review" | "deliver", string>;
  skills: HorizonMonitorSkill[];
  tabularReview: {
    schema: HorizonReviewTableScale["schema"];
    rowCount: number;
    columnCount: number;
    estimatedCellTasks: number;
    reviewMode: "review_gated";
    externalActionAllowed: false;
  };
  trustedSources: {
    sourceMode: "public_regulator_sources";
    sourceConnectorCount: number;
    citationCoverage: Record<HorizonReviewTableRow["citationCoverage"], number>;
    externalActionAllowed: false;
  };
  editorDraft: {
    status: "draft_only";
    sourceTraceability: "required";
    approvalRequired: true;
  };
  wordExportPackage: {
    status: "review_gated";
    formats: string[];
    externalActionAllowed: false;
  };
  portalRoom: {
    accessMode: "operator_review";
    roleBasedAccess: true;
    auditTrailRequired: true;
    externalGuestAccessAllowed: false;
  };
  monitors: {
    status: "implemented";
    regulatoryPerimeter: string[];
    jurisdictions: string[];
    sourceControls: string[];
    deliveryStatus: "blocked_without_review" | "reviewed_local_export";
  };
  lists: {
    status: "implemented";
    items: Array<{
      key: string;
      label: string;
      owner: string;
      signOffRequired: boolean;
    }>;
  };
  securityGovernance: {
    zeroTrust: true;
    noFoundationModelTraining: true;
    dataRetention: "metadata_only";
    auditTrail: "required";
    approvalGate: "required_for_alert_delivery";
  };
  legoraIntegration: "none";
  externalActionAllowed: false;
  reviewNotice: string;
};

export type HorizonReviewTable = {
  rows: HorizonReviewTableRow[];
  summary: HorizonReviewTableSummary;
  controlProfile: HorizonReviewControlProfile;
  reviewTableScale: HorizonReviewTableScale;
  promptBrief: HorizonPromptImprovementBrief;
  monitorProfile: HorizonMonitorProfile;
};

const HORIZON_REVIEW_TABLE_COLUMN_IDS = [
  "publication",
  "source_freshness",
  "affected_products",
  "assigned_reviewer",
  "review_status",
  "proof_packet_status",
  "citation_coverage",
  "alert_status",
  "delivery_status",
  "blockers",
  "next_action",
] as const;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function statusLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function latestAlertForPublication(alerts: AlertView[], publicationId: string) {
  return alerts
    .filter((alert) => alert.publicationId === publicationId)
    .sort((left, right) => Date.parse(right.scheduledFor) - Date.parse(left.scheduledFor))[0];
}

function proofPacketStatus(alert: AlertView | undefined) {
  if (!alert) return "missing" as const;
  const latestPacket = alert.proofPackets[0];
  if (!latestPacket) return alert.status === "DRAFT" ? ("draft_only" as const) : ("missing" as const);
  return latestPacket.gateStatus === "ready_for_delivery" ? ("ready" as const) : ("blocked" as const);
}

function buildBlockers(input: {
  reviewItem?: ReviewQueueView;
  alert?: AlertView;
  sourceBlocksSla: boolean;
  deliveryReadiness: DeliveryReadiness;
}) {
  const blockers: string[] = [];
  if (!input.reviewItem || input.reviewItem.status !== "APPROVED") {
    blockers.push("Human review approval missing.");
  }
  if (input.sourceBlocksSla) {
    blockers.push("Source freshness or reuse gate is blocking.");
  }
  if (!input.deliveryReadiness.ready) {
    blockers.push(input.deliveryReadiness.message);
  }
  if (!input.alert) {
    blockers.push("Reviewed alert draft has not been generated.");
  }
  if (input.alert?.status === "BLOCKED_BY_CONFIG") {
    blockers.push("Delivery configuration blocks this alert draft.");
  }
  if (input.alert?.status === "FAILED") {
    blockers.push("Last delivery attempt failed.");
  }
  const latestPacket = input.alert?.proofPackets[0];
  if (latestPacket?.gateStatus === "blocked") {
    blockers.push(...latestPacket.reasons);
  }
  return unique(blockers);
}

function nextAction(row: Pick<HorizonReviewTableRow, "blockers" | "proofPacketStatus" | "alertStatus">) {
  if (row.blockers.length > 0) return row.blockers[0];
  if (row.proofPacketStatus === "missing") return "Generate a proof packet before delivery approval.";
  if (row.alertStatus === "DRAFT") return "Approve the draft alert after reviewer sign-off.";
  return "Ready for reviewed delivery or archive after supervisory review.";
}

export function buildHorizonReviewTable(input: {
  publications: PublicationListItem[];
  reviewItems: ReviewQueueView[];
  alerts: AlertView[];
  sourceDiligence: SourceDiligenceView[];
  deliveryReadiness: DeliveryReadiness;
  now?: Date;
}): HorizonReviewTable {
  const reviewsByPublication = new Map(input.reviewItems.map((item) => [item.publicationId, item]));
  const sourcesByCode = new Map(input.sourceDiligence.map((source) => [source.sourceCode, source]));
  const now = input.now ?? new Date();

  const rows = input.publications
    .map((publication) => {
      const reviewItem = reviewsByPublication.get(publication.id);
      const source = sourcesByCode.get(publication.sourceCode);
      const freshness = source ? assessSourceFreshness(source, now) : null;
      const alert = latestAlertForPublication(input.alerts, publication.id);
      const proofStatus = proofPacketStatus(alert);
      const blockers = buildBlockers({
        reviewItem,
        alert,
        sourceBlocksSla: freshness?.blocksSla ?? true,
        deliveryReadiness: input.deliveryReadiness,
      });
      const citationCoverage =
        freshness?.status === "BLOCKED"
          ? ("blocked" as const)
          : publication.sourceUrl && publication.rawHash && publication.scoringRuleVersion !== "unscored"
            ? ("complete" as const)
            : ("partial" as const);
      const deliveryStatus =
        blockers.length > 0
          ? ("blocked" as const)
          : proofStatus === "ready"
            ? ("ready_for_delivery" as const)
            : ("draft_only" as const);
      const row = {
        id: `horizon-review-${publication.id}`,
        publicationId: publication.id,
        title: publication.title,
        sourceName: publication.sourceName,
        sourceFreshness: freshness?.label ?? "Source review missing",
        affectedProducts: unique([
          ...publication.matchedLicences,
          ...publication.serviceOfferingIds,
          ...publication.tags.activities,
        ]).slice(0, 4),
        assignedReviewer: reviewItem?.reviewerName ?? "Unassigned",
        reviewStatus: reviewItem ? statusLabel(reviewItem.status) : "review missing",
        proofPacketStatus: proofStatus,
        citationCoverage,
        alertStatus: alert?.status ?? "NO_DRAFT",
        deliveryStatus,
        blockers,
        nextAction: "",
      } satisfies HorizonReviewTableRow;

      return { ...row, nextAction: nextAction(row) };
    })
    .sort((left, right) => {
      const deliveryDelta = Number(right.deliveryStatus === "blocked") - Number(left.deliveryStatus === "blocked");
      if (deliveryDelta !== 0) return deliveryDelta;
      return right.blockers.length - left.blockers.length;
    });

  const summary = {
    totalRows: rows.length,
    blockedRows: rows.filter((row) => row.deliveryStatus === "blocked").length,
    readyRows: rows.filter((row) => row.deliveryStatus === "ready_for_delivery").length,
    draftOnlyRows: rows.filter((row) => row.deliveryStatus === "draft_only").length,
    missingProofPackets: rows.filter((row) => row.proofPacketStatus === "missing").length,
  };

  const controlProfile = buildControlProfile({
    rows,
    summary,
    deliveryReadiness: input.deliveryReadiness,
    sourceCount: sourcesByCode.size,
  });
  const reviewTableScale = buildReviewTableScale(rows);
  const promptBrief = buildPromptBrief({ rows, summary, deliveryReadiness: input.deliveryReadiness });
  return {
    rows,
    summary,
    controlProfile,
    reviewTableScale,
    promptBrief,
    monitorProfile: buildMonitorProfile({
      rows,
      summary,
      controlProfile,
      reviewTableScale,
      promptBrief,
      sourceCount: sourcesByCode.size,
    }),
  };
}

function buildReviewTableScale(rows: HorizonReviewTableRow[]): HorizonReviewTableScale {
  const columnIds = [...HORIZON_REVIEW_TABLE_COLUMN_IDS];
  return {
    schema: "horizon-scanner.review-table-scale.v1",
    rowCount: rows.length,
    columnCount: columnIds.length,
    columnIds,
    estimatedCellTasks: rows.length * columnIds.length,
    maxVaultDocuments: 100_000,
    resetStrategy:
      "Each alert row and generated review column is evaluated as a separate cell task with isolated source context.",
    needleInHaystackStrategy:
      "Needle-in-haystack monitoring should use retrieved publication chunks. Comprehensive supervisory review runs through the alert review table.",
  };
}

function buildPromptBrief({
  rows,
  summary,
  deliveryReadiness,
}: {
  rows: HorizonReviewTableRow[];
  summary: HorizonReviewTableSummary;
  deliveryReadiness: DeliveryReadiness;
}): HorizonPromptImprovementBrief {
  const highestPriority = rows[0];
  const blockedReasons = unique(rows.flatMap((row) => row.blockers)).slice(0, 4);
  const failureConditions = [
    "Do not state that an alert is send-ready unless review approval and proof packet gates pass.",
    "Do not infer product impact when the product map is stale or unconfirmed.",
    "Do not omit source freshness, source URL, raw hash status or reviewer state.",
  ];
  if (!deliveryReadiness.ready) {
    failureConditions.push(deliveryReadiness.message);
  }
  return {
    schema: "horizon-scanner.alert-prompt-brief.v1",
    objective: "Draft a supervised alert preview from one reviewed publication row.",
    actor: "EU financial-regulation monitoring lawyer",
    jurisdiction: "EU financial regulation, with MiCAR, DORA, MiFID II and payments context where tagged",
    sourceHierarchy: [
      "Primary regulator publication metadata",
      "Source diligence and freshness record",
      "Confirmed product map",
      "Human review decision",
      "Alert proof packet",
    ],
    requiredInputs: [
      "publication title, source, source URL and raw hash status",
      "affected product map entries and service offerings",
      "reviewer name, review status and decision reason",
      "proof packet status, citation coverage and blockers",
    ],
    outputFormat: [
      "one-line alert subject",
      "short legal-impact summary",
      "affected products",
      "source and citation status",
      "review gate and next action",
    ],
    reviewGate:
      "Draft-only. A named reviewer must approve the publication row and proof packet before any delivery action.",
    failureConditions: blockedReasons.length ? unique([...failureConditions, ...blockedReasons]) : failureConditions,
    suggestedPrompt: [
      "Role: EU financial-regulation monitoring lawyer.",
      `Objective: draft a review-gated alert preview for ${highestPriority?.title ?? "the selected publication"}.`,
      "Use the regulator publication, source diligence, confirmed product map and proof packet as the source hierarchy.",
      `Current queue: ${summary.totalRows} row(s), ${summary.blockedRows} blocked, ${summary.readyRows} ready.`,
      "Output: subject, legal-impact summary, affected products, source status, proof status, blockers and next action.",
      "Review gate: draft only. Do not send, schedule or approve external delivery.",
    ].join("\n"),
  };
}

function buildControlProfile({
  rows,
  summary,
  deliveryReadiness,
  sourceCount,
}: {
  rows: HorizonReviewTableRow[];
  summary: HorizonReviewTableSummary;
  deliveryReadiness: DeliveryReadiness;
  sourceCount: number;
}): HorizonReviewControlProfile {
  const allReviewed = rows.length > 0 && rows.every((row) => row.reviewStatus === "approved");
  const allProofReady = rows.length > 0 && rows.every((row) => row.proofPacketStatus === "ready");
  const deliveryReady = summary.readyRows > 0 && summary.blockedRows === 0;

  return {
    schema: "horizon-scanner.alert-review-control.v1",
    externalActionAllowed: false,
    routeSummary: `${summary.readyRows} ready row(s), ${summary.blockedRows} blocked row(s), external delivery blocked until reviewed approval.`,
    contextWindowStrategy: `${rows.length} alert row(s) evaluated one publication and proof packet at a time.`,
    workflowRoutes: [
      {
        key: "source-ingestion",
        label: "Source ingestion",
        status: sourceCount > 0 ? "ready" : "review_required",
        route: "deterministic_local",
        gate: "Source cadence, attribution and freshness checks remain local.",
      },
      {
        key: "alert-review-table",
        label: "Alert review table",
        status: allReviewed ? "ready" : "review_required",
        route: "deterministic_local",
        gate: "Human review approval is required for every publication row.",
      },
      {
        key: "proof-packet-builder",
        label: "Proof packet builder",
        status: allProofReady ? "ready" : "review_required",
        route: "deterministic_local",
        gate: "Proof packet must include source authority, reviewer state and digest.",
      },
      {
        key: "agent-preview",
        label: "Agent alert preview",
        status: summary.draftOnlyRows > 0 || summary.blockedRows > 0 ? "review_required" : "ready",
        route: "draft_agent",
        gate: "Agents may draft findings and previews only.",
      },
      {
        key: "external-delivery",
        label: "External delivery",
        status: deliveryReady && deliveryReadiness.ready ? "review_required" : "blocked",
        route: "external_delivery",
        gate: "Delivery remains disabled until a reviewed action explicitly sends it.",
      },
    ],
    sourceConnectors: [
      {
        key: "regulator-feeds",
        label: "Regulator feeds",
        status: sourceCount > 0 ? "enabled" : "review_required",
        scope: `${sourceCount} source connector(s) represented in the current result set.`,
        gate: "Public sources only. Cadence and attribution rules apply.",
      },
      {
        key: "product-map",
        label: "Product map",
        status: deliveryReadiness.ready ? "enabled" : "blocked",
        scope: deliveryReadiness.message,
        gate: "Client product maps stay local and must be confirmed before routing.",
      },
      {
        key: "review-queue",
        label: "Review queue",
        status: allReviewed ? "enabled" : "review_required",
        scope: `${rows.filter((row) => row.reviewStatus === "approved").length}/${rows.length} row(s) approved.`,
        gate: "No alert leaves draft state without reviewer approval.",
      },
      {
        key: "delivery-channels",
        label: "Delivery channels",
        status: "blocked",
        scope: "Email, Slack, Teams and CRM delivery are treated as external side effects.",
        gate: "Draft-only unless a reviewed action explicitly sends.",
      },
    ],
    futureBulkExtractionPolicy: {
      schema: "horizon-scanner.future-llm-bulk-extraction.v1",
      enabled: false,
      runner: "inngest",
      concurrencyPerOrganisationOrSourceGroup: 1,
      retryStrategy: "exponential_backoff",
      idempotencyKeyParts: ["publication_id", "column_id", "source_hash", "prompt_version"],
      deliverySideEffectsAllowed: false,
    },
  };
}

function buildMonitorProfile({
  rows,
  summary,
  controlProfile,
  reviewTableScale,
  promptBrief,
  sourceCount,
}: {
  rows: HorizonReviewTableRow[];
  summary: HorizonReviewTableSummary;
  controlProfile: HorizonReviewControlProfile;
  reviewTableScale: HorizonReviewTableScale;
  promptBrief: HorizonPromptImprovementBrief;
  sourceCount: number;
}): HorizonMonitorProfile {
  const coverage = {
    complete: rows.filter((row) => row.citationCoverage === "complete").length,
    partial: rows.filter((row) => row.citationCoverage === "partial").length,
    blocked: rows.filter((row) => row.citationCoverage === "blocked").length,
  };
  const affectedProducts = unique(rows.flatMap((row) => row.affectedProducts));
  const reviewerItems = unique(
    rows.map((row) => (row.assignedReviewer === "Unassigned" ? "Assign reviewer" : row.assignedReviewer)),
  );
  return {
    schema: "horizon-scanner.monitor-review.v1",
    aosLayers: [
      {
        key: "large_language_models",
        label: "Large language model routing",
        status: "metadata_only",
        evidence: "Future LLM bulk extraction policy is disabled and draft-only.",
        gate: "If enabled later, Inngest concurrency, retry and idempotency gates apply.",
      },
      {
        key: "agentic_harness",
        label: "Agentic harness",
        status: "implemented",
        evidence: `${controlProfile.workflowRoutes.length} workflow route(s) are review-gated.`,
        gate: "Agents may draft findings and previews only.",
      },
      {
        key: "data_integrations",
        label: "Data and integrations",
        status: "metadata_only",
        evidence: `${sourceCount} regulator source connector(s) represented.`,
        gate: "Delivery channels remain blocked external side effects.",
      },
      {
        key: "context_knowledge",
        label: "Context and knowledge",
        status: "implemented",
        evidence: `${coverage.complete} complete citation row(s), ${coverage.partial} partial.`,
        gate: "Source URL, raw hash and freshness state stay visible per row.",
      },
      {
        key: "legal_capabilities",
        label: "Legal capabilities",
        status: "implemented",
        evidence: "Publication review, product impact and proof packet gates are linked.",
        gate: "Alert previews are workflow inputs, not legal assessments.",
      },
      {
        key: "products_interfaces",
        label: "Products and interfaces",
        status: "implemented",
        evidence: "Monitor table, prompt brief, route policy and source connector gates are visible.",
        gate: "Export and delivery remain review-gated.",
      },
      {
        key: "security_governance",
        label: "Security and governance",
        status: "implemented",
        evidence: "External action is false and delivery side effects are disabled.",
        gate: "Reviewed action required before any external channel is used.",
      },
    ],
    agentPlan: {
      plan: "Select source perimeter, jurisdiction, topic tags, products and reviewer.",
      execute: "Generate deterministic review rows and draft-only alert previews.",
      review: "Check source freshness, citation coverage, proof packet and reviewer approval.",
      deliver: "Prepare reviewed local export metadata while external delivery remains blocked.",
    },
    skills: [
      {
        id: "regulatory-monitor-triage",
        label: "Regulatory monitor triage",
        objective: promptBrief.objective,
        outputSchema: promptBrief.outputFormat,
        reviewGate: promptBrief.reviewGate,
        externalActionAllowed: false,
      },
      {
        id: "proof-packet-check",
        label: "Proof packet check",
        objective: "Check source authority, reviewer state and alert payload digest.",
        outputSchema: ["proof packet status", "citation coverage", "blockers", "next action"],
        reviewGate: "Proof packet must pass before delivery approval.",
        externalActionAllowed: false,
      },
      {
        id: "product-impact-list",
        label: "Product impact list",
        objective: "Convert affected product matches into reviewer-owned list items.",
        outputSchema: ["affected product", "reviewer", "status", "next action"],
        reviewGate: "Product maps must be confirmed locally before alert routing.",
        externalActionAllowed: false,
      },
    ],
    tabularReview: {
      schema: reviewTableScale.schema,
      rowCount: reviewTableScale.rowCount,
      columnCount: reviewTableScale.columnCount,
      estimatedCellTasks: reviewTableScale.estimatedCellTasks,
      reviewMode: "review_gated",
      externalActionAllowed: false,
    },
    trustedSources: {
      sourceMode: "public_regulator_sources",
      sourceConnectorCount: sourceCount,
      citationCoverage: coverage,
      externalActionAllowed: false,
    },
    editorDraft: {
      status: "draft_only",
      sourceTraceability: "required",
      approvalRequired: true,
    },
    wordExportPackage: {
      status: "review_gated",
      formats: ["xlsx", "pdf", "markdown-report", "artifact-manifest"],
      externalActionAllowed: false,
    },
    portalRoom: {
      accessMode: "operator_review",
      roleBasedAccess: true,
      auditTrailRequired: true,
      externalGuestAccessAllowed: false,
    },
    monitors: {
      status: "implemented",
      regulatoryPerimeter: ["MiCAR", "DORA", "MiFID II", "payments"],
      jurisdictions: ["EU"],
      sourceControls: controlProfile.sourceConnectors.map((connector) => connector.key),
      deliveryStatus: summary.readyRows > 0 && summary.blockedRows === 0
        ? "reviewed_local_export"
        : "blocked_without_review",
    },
    lists: {
      status: "implemented",
      items: [
        ...affectedProducts.slice(0, 5).map((product) => ({
          key: `product-${product}`,
          label: `Review impact for ${product}`,
          owner: reviewerItems[0] ?? "Reviewer",
          signOffRequired: true,
        })),
        {
          key: "delivery-preflight",
          label: "Confirm proof packet before alert delivery",
          owner: "Responsible reviewer",
          signOffRequired: true,
        },
      ],
    },
    securityGovernance: {
      zeroTrust: true,
      noFoundationModelTraining: true,
      dataRetention: "metadata_only",
      auditTrail: "required",
      approvalGate: "required_for_alert_delivery",
    },
    legoraIntegration: "none",
    externalActionAllowed: false,
    reviewNotice:
      "Legora-inspired product pattern, no Legora integration or dependency. Alerts remain draft-only until reviewed delivery approval.",
  };
}
