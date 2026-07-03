import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, CircleAlert, Clock, Database, FileCheck2 } from "lucide-react";

import { createSavedViewAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PublicationFilters } from "@/components/publication-filters";
import { PublicationTable } from "@/components/publication-table";
import { listLatestAgentArtifacts } from "@/lib/agents/runner";
import { listAlerts } from "@/lib/alerts";
import { getActiveOrganisationId } from "@/lib/authz";
import { buildOperatorActions, type OperatorActionTone } from "@/lib/operator-cockpit";
import { getProductMapDeliveryReadiness } from "@/lib/product-maps";
import { buildHorizonReviewTable, type HorizonReviewTableRow } from "@/lib/horizon-review-table";
import { getAvailableFilters, listPublications } from "@/lib/publications";
import { listReviewQueue } from "@/lib/review";
import { getRuntimeChecksWithDatabaseProbe } from "@/lib/runtime-hardening";
import { listSavedViews, savedViewToSearchParams } from "@/lib/saved-views";
import { summarizeSourceFreshness } from "@/lib/source-health";
import { listSourceDiligence } from "@/lib/source-diligence";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: PageProps) {
  try {
    return await LoadedHome({ searchParams });
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    return <DashboardUnavailable />;
  }
}

function isDatabaseUnavailable(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["P1001", "P1002", "P1017"].includes(String(error.code));
}

async function LoadedHome({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    source: readParam(params.source),
    type: readParam(params.type),
    tag: readParam(params.tag),
    query: readParam(params.query),
    bucket: readParam(params.bucket),
    from: readParam(params.from),
    to: readParam(params.to),
  };
  const organisationId = await getActiveOrganisationId();
  const [
    publications,
    filterData,
    savedViews,
    reviewItems,
    alerts,
    footprintReadiness,
    runtimeChecks,
    sourceDiligence,
    agentArtifacts,
  ] = await Promise.all([
    listPublications(filters, organisationId),
    getAvailableFilters(organisationId),
    listSavedViews(organisationId),
    listReviewQueue(organisationId),
    listAlerts(organisationId),
    getProductMapDeliveryReadiness(organisationId),
    getRuntimeChecksWithDatabaseProbe(),
    listSourceDiligence(),
    listLatestAgentArtifacts({ organisationId, take: 6 }),
  ]);
  const highImpactCount = publications.filter((publication) =>
    ["CRITICAL", "HIGH"].includes(publication.impactBucket),
  ).length;
  const sourceCount = new Set(publications.map((publication) => publication.sourceCode)).size;
  const operatorActions = buildOperatorActions({
    highImpactCount,
    reviewItems,
    alerts,
    sourceFreshness: summarizeSourceFreshness(sourceDiligence),
    footprintReadiness,
    runtimeChecks,
  });
  const alertReviewTable = buildHorizonReviewTable({
    publications,
    reviewItems,
    alerts,
    sourceDiligence,
    deliveryReadiness: footprintReadiness,
  });

  return (
    <AppShell active="/">
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Review-gated scanner cockpit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Regulatory publications that need source-aware review.
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <Database className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
              <p className="text-2xl font-semibold text-zinc-950">{sourceCount}</p>
              <p className="text-xs text-zinc-500">Sources</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <Activity className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
              <p className="text-2xl font-semibold text-zinc-950">{publications.length}</p>
              <p className="text-xs text-zinc-500">Items</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <AlertTriangle className="mb-2 h-4 w-4 text-red-700" aria-hidden="true" />
              <p className="text-2xl font-semibold text-zinc-950">{highImpactCount}</p>
              <p className="text-xs text-zinc-500">High impact</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <Clock className="mb-2 h-4 w-4 text-zinc-700" aria-hidden="true" />
              <p className="text-2xl font-semibold text-zinc-950">24h</p>
              <p className="text-xs text-zinc-500">SLA target</p>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Review queue</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">What must be checked before delivery</h2>
            </div>
            <Link
              href="/review"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Review queue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {operatorActions.slice(0, 3).map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className={`rounded-md border p-3 hover:border-zinc-400 ${actionToneClasses[action.tone]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{action.title}</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">{action.detail}</p>
                  </div>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-white/80 px-2 text-sm font-semibold text-zinc-950">
                    {action.metric}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Agent handoff</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">Draft findings held for human review</h2>
            </div>
            <Link
              href="/agents"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Agent control room
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {agentArtifacts.slice(0, 3).map((artifact) => (
              <Link
                key={artifact.id}
                href={`/agents/${artifact.agentRunId}`}
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 hover:border-zinc-400"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-semibold uppercase text-zinc-700">{artifact.type}</span>
                  <span>{artifact.status}</span>
                </div>
                <p className="text-sm font-semibold text-zinc-950">{artifact.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">{artifact.summary}</p>
              </Link>
            ))}
            {agentArtifacts.length === 0 ? (
              <p className="text-sm text-zinc-500">Run enabled agents to generate draft findings for review.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Alert Review Table</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">Source, proof and delivery gates</h2>
            </div>
            <Link
              href="/alerts"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Alert drafts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <ReviewMetric label="Rows" value={alertReviewTable.summary.totalRows} />
            <ReviewMetric label="Blocked" value={alertReviewTable.summary.blockedRows} tone="blocked" />
            <ReviewMetric label="Draft only" value={alertReviewTable.summary.draftOnlyRows} />
            <ReviewMetric label="Ready" value={alertReviewTable.summary.readyRows} tone="ready" />
            <ReviewMetric label="Cell tasks" value={alertReviewTable.reviewTableScale.estimatedCellTasks} />
            <ReviewMetric label="Columns" value={alertReviewTable.reviewTableScale.columnCount} />
            <ReviewMetric label="Vault docs" value={alertReviewTable.reviewTableScale.maxVaultDocuments} />
          </div>
          <p className="mb-4 text-xs leading-5 text-zinc-600">
            {alertReviewTable.reviewTableScale.resetStrategy}{" "}
            {alertReviewTable.reviewTableScale.needleInHaystackStrategy} Columns:{" "}
            {alertReviewTable.reviewTableScale.columnIds.join(", ")}.
          </p>
          <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-teal-700">
                  {alertReviewTable.monitorProfile.schema}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-zinc-950">Monitor controls</h3>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-600">
                  {alertReviewTable.monitorProfile.reviewNotice}
                </p>
              </div>
              <ReviewPill
                label={alertReviewTable.monitorProfile.externalActionAllowed ? "external allowed" : "external blocked"}
                tone="blocked"
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
              <ReviewMetric label="Skills" value={alertReviewTable.monitorProfile.skills.length} />
              <ReviewMetric label="Review layers" value={alertReviewTable.monitorProfile.reviewLayers.length} />
              <ReviewMetric label="Lists" value={alertReviewTable.monitorProfile.lists.items.length} />
              <ReviewMetric
                label="Sources"
                value={alertReviewTable.monitorProfile.trustedSources.sourceConnectorCount}
              />
              <ReviewMetric
                label="Complete cites"
                value={alertReviewTable.monitorProfile.trustedSources.citationCoverage.complete}
              />
              <ReviewMetric
                label="Jurisdictions"
                value={alertReviewTable.monitorProfile.monitors.jurisdictions.length}
              />
              <ReviewMetric
                label="Portal"
                value={alertReviewTable.monitorProfile.portalRoom.externalGuestAccessAllowed ? 1 : 0}
              />
              <ReviewMetric
                label="Exports"
                value={alertReviewTable.monitorProfile.wordExportPackage.formats.length}
              />
            </div>
            <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-white">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Layer</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Evidence</th>
                    <th className="px-3 py-2 font-semibold">Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {alertReviewTable.monitorProfile.reviewLayers.map((layer) => (
                    <tr key={layer.key}>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-zinc-950">{layer.label}</p>
                        <p className="mt-1 font-mono text-[11px] text-zinc-500">{layer.key}</p>
                      </td>
                      <td className="px-3 py-3">
                        <ReviewPill label={layer.status} tone={layer.status === "blocked" ? "blocked" : "ready"} />
                      </td>
                      <td className="px-3 py-3 leading-5 text-zinc-600">{layer.evidence}</td>
                      <td className="px-3 py-3 leading-5 text-zinc-600">{layer.gate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mb-4 grid gap-3 xl:grid-cols-3">
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-teal-700">
                  {alertReviewTable.controlProfile.schema}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-zinc-950">Route policy</h3>
                <p className="mt-1 text-xs text-zinc-600">{alertReviewTable.controlProfile.routeSummary}</p>
              </div>
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Route</th>
                    <th className="px-3 py-2 font-semibold">Mode</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {alertReviewTable.controlProfile.workflowRoutes.map((route) => (
                    <tr key={route.key}>
                      <td className="px-3 py-3 font-semibold text-zinc-950">{route.label}</td>
                      <td className="px-3 py-3 font-mono text-zinc-600">{route.route}</td>
                      <td className="px-3 py-3">
                        <ReviewPill label={route.status.replaceAll("_", " ")} tone={controlTone(route.status)} />
                      </td>
                      <td className="px-3 py-3 leading-5 text-zinc-600">{route.gate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                {alertReviewTable.controlProfile.contextWindowStrategy}
              </p>
              <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                Future LLM bulk extraction is disabled. If enabled later,{" "}
                {alertReviewTable.controlProfile.futureBulkExtractionPolicy.runner} runs with concurrency{" "}
                {alertReviewTable.controlProfile.futureBulkExtractionPolicy.concurrencyPerOrganisationOrSourceGroup},
                exponential backoff, idempotency keys from{" "}
                {alertReviewTable.controlProfile.futureBulkExtractionPolicy.idempotencyKeyParts.join(", ")}, and no
                delivery side effects.
              </p>
            </div>

            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <h3 className="text-sm font-semibold text-zinc-950">Source connector gates</h3>
                <p className="mt-1 text-xs text-zinc-600">
                  External action allowed: {alertReviewTable.controlProfile.externalActionAllowed ? "yes" : "blocked"}
                </p>
              </div>
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Connector</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Scope</th>
                    <th className="px-3 py-2 font-semibold">Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {alertReviewTable.controlProfile.sourceConnectors.map((connector) => (
                    <tr key={connector.key}>
                      <td className="px-3 py-3 font-semibold text-zinc-950">{connector.label}</td>
                      <td className="px-3 py-3">
                        <ReviewPill label={connector.status.replaceAll("_", " ")} tone={controlTone(connector.status)} />
                      </td>
                      <td className="px-3 py-3 leading-5 text-zinc-600">{connector.scope}</td>
                      <td className="px-3 py-3 leading-5 text-zinc-600">{connector.gate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-teal-700">
                {alertReviewTable.promptBrief.schema}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-zinc-950">Prompt improvement brief</h3>
              <p className="mt-2 text-xs leading-5 text-zinc-600">{alertReviewTable.promptBrief.objective}</p>
              <dl className="mt-3 grid gap-2 text-xs">
                <div>
                  <dt className="font-semibold text-zinc-700">Actor</dt>
                  <dd className="mt-1 text-zinc-600">{alertReviewTable.promptBrief.actor}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-zinc-700">Source hierarchy</dt>
                  <dd className="mt-1 text-zinc-600">{alertReviewTable.promptBrief.sourceHierarchy.join(" · ")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-zinc-700">Review gate</dt>
                  <dd className="mt-1 text-zinc-600">{alertReviewTable.promptBrief.reviewGate}</dd>
                </div>
              </dl>
              <pre className="mt-3 max-h-44 overflow-auto rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-700">
                {alertReviewTable.promptBrief.suggestedPrompt}
              </pre>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-normal text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Publication</th>
                  <th className="px-3 py-2 font-semibold">Reviewer</th>
                  <th className="px-3 py-2 font-semibold">Products</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Proof</th>
                  <th className="px-3 py-2 font-semibold">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {alertReviewTable.rows.slice(0, 6).map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-xs px-3 py-3">
                      <Link href={`/publications/${row.publicationId}`} className="font-semibold text-zinc-950 hover:underline">
                        {row.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <ReviewPill label={row.reviewStatus} tone={row.deliveryStatus === "blocked" ? "blocked" : "default"} />
                        <ReviewPill label={row.alertStatus.toLowerCase().replaceAll("_", " ")} tone="default" />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{row.assignedReviewer}</td>
                    <td className="max-w-xs px-3 py-3 text-xs leading-5 text-zinc-600">
                      {row.affectedProducts.length ? row.affectedProducts.join(", ") : "No routed product impact"}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-zinc-950">{row.sourceName}</p>
                      <p className="mt-1 text-xs text-zinc-500">{row.sourceFreshness}</p>
                      <ReviewPill label={`${row.citationCoverage} citations`} tone={row.citationCoverage === "blocked" ? "blocked" : "ready"} />
                    </td>
                    <td className="px-3 py-3">
                      <ReviewPill label={row.proofPacketStatus.replaceAll("_", " ")} tone={proofTone(row)} />
                    </td>
                    <td className="max-w-xs px-3 py-3 text-xs leading-5 text-zinc-600">{row.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {savedViews.map((view) => (
            <Link
              key={view.id}
              href={`/?${savedViewToSearchParams(view.filters)}`}
              className="rounded-md border border-zinc-200 bg-white p-3 hover:border-zinc-400"
            >
              <p className="text-sm font-semibold text-zinc-950">{view.name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{view.description}</p>
            </Link>
          ))}
        </section>

        <PublicationFilters filters={filters} filterData={filterData} />
        <form action={createSavedViewAction} className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="query" value={filters.query ?? ""} />
          <input type="hidden" name="source" value={filters.source ?? ""} />
          <input type="hidden" name="type" value={filters.type ?? ""} />
          <input type="hidden" name="tag" value={filters.tag ?? ""} />
          <input type="hidden" name="bucket" value={filters.bucket ?? ""} />
          <input type="hidden" name="from" value={filters.from ?? ""} />
          <input type="hidden" name="to" value={filters.to ?? ""} />
          <label>
            <span className="sr-only">Saved view name</span>
            <input
              name="name"
              placeholder="Saved view name"
              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
            />
          </label>
          <label>
            <span className="sr-only">Saved view description</span>
            <input
              name="description"
              placeholder="Description"
              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
            />
          </label>
          <button className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
            Save current view
          </button>
        </form>
        <PublicationTable publications={publications} />
      </div>
    </AppShell>
  );
}

const actionToneClasses: Record<OperatorActionTone, string> = {
  urgent: "border-red-200 bg-red-50 text-red-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  normal: "border-zinc-200 bg-zinc-50 text-zinc-950",
  success: "border-teal-200 bg-teal-50 text-teal-950",
};

function ReviewMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "blocked" | "ready";
}) {
  const toneClasses = {
    default: "border-zinc-200 bg-zinc-50 text-zinc-950",
    blocked: "border-red-200 bg-red-50 text-red-950",
    ready: "border-teal-200 bg-teal-50 text-teal-950",
  };

  return (
    <div className={`rounded-md border p-3 ${toneClasses[tone]}`}>
      <FileCheck2 className="mb-2 h-4 w-4" aria-hidden="true" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}

function ReviewPill({
  label,
  tone,
}: {
  label: string;
  tone: "default" | "blocked" | "ready";
}) {
  const toneClasses = {
    default: "border-zinc-200 bg-zinc-50 text-zinc-700",
    blocked: "border-red-200 bg-red-50 text-red-800",
    ready: "border-teal-200 bg-teal-50 text-teal-800",
  };

  return (
    <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}

function controlTone(status: string): "default" | "blocked" | "ready" {
  if (status === "ready" || status === "enabled") return "ready";
  if (status === "blocked") return "blocked";
  return "default";
}

function proofTone(row: HorizonReviewTableRow) {
  if (row.proofPacketStatus === "ready") return "ready";
  if (row.proofPacketStatus === "blocked" || row.deliveryStatus === "blocked") return "blocked";
  return "default";
}

function DashboardUnavailable() {
  return (
    <AppShell active="/">
      <section className="mx-auto max-w-xl rounded-md border border-amber-200 bg-white p-6">
        <CircleAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-normal text-amber-800">Data unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">
          Current publication data could not be loaded.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Review runtime diagnostics before relying on alerts or publication status.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/integrations"
            className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Open diagnostics
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Retry
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
