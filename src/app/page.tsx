import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, CircleAlert, Clock, Database } from "lucide-react";

import { createSavedViewAction } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PublicationFilters } from "@/components/publication-filters";
import { PublicationTable } from "@/components/publication-table";
import { listLatestAgentArtifacts } from "@/lib/agents/runner";
import { listAlerts } from "@/lib/alerts";
import { getActiveOrganisationId } from "@/lib/authz";
import { buildOperatorActions, type OperatorActionTone } from "@/lib/operator-command-center";
import { getProductMapDeliveryReadiness } from "@/lib/product-maps";
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

  return (
    <AppShell active="/">
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Scanner cockpit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Regulatory publications within the 24-hour window.
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
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Action queue</p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">What needs attention first</h2>
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
              <h2 className="mt-1 text-lg font-semibold text-zinc-950">Latest draft findings and suggestions</h2>
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
