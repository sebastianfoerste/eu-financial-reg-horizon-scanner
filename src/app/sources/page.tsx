import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Rss, ShieldCheck } from "lucide-react";

import { pollApprovedSourcesAction } from "@/app/sources/actions";
import { AppShell } from "@/components/app-shell";
import { requireOperator } from "@/lib/authz";
import { getTierOneAdapters } from "@/lib/ingestion/adapters";
import { listSourceDiligence } from "@/lib/source-diligence";
import { assessSourceFreshness, summarizeSourceFreshness, type SourceFreshnessStatus } from "@/lib/source-health";
import { cn, compactDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SourcesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readableStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const adapters = getTierOneAdapters();
  const params = await searchParams;
  const [operator, diligence] = await Promise.all([requireOperator(), listSourceDiligence()]);
  const byCode = new Map(diligence.map((record) => [record.sourceCode, record]));
  const freshnessSummary = summarizeSourceFreshness(diligence);
  const mayPoll = operator.mode === "demo" || operator.isInternalOperator;

  return (
    <AppShell active="/sources">
      <div className="space-y-6">
        <section className="border-b border-zinc-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Tier 1 source estate</p>
          <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h1 className="text-3xl font-semibold tracking-normal text-zinc-950">
              Live adapters with fixture-backed parsing.
            </h1>
            <div className="flex flex-wrap gap-2">
              {mayPoll ? (
                <form action={pollApprovedSourcesAction}>
                  <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Poll approved sources
                  </button>
                </form>
              ) : null}
              {mayPoll ? (
                <Link
                  href="/sources/diligence"
                  className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Source diligence
                </Link>
              ) : null}
              <Link
                href="/sources/currency"
                className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                Currency queue
              </Link>
            </div>
          </div>
        </section>

        {readParam(params.polled) ? (
          <p className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
            Poll run completed. Skipped by policy or cadence: {readParam(params.skipped) ?? "0"}. Failed:
            {" "}
            {readParam(params.failed) ?? "0"}.
          </p>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={CheckCircle2} label="Fresh" value={freshnessSummary.current.toString()} tone="success" />
          <MetricCard icon={Clock} label="Poll due" value={freshnessSummary.due.toString()} tone="warning" />
          <MetricCard icon={AlertTriangle} label="SLA blockers" value={freshnessSummary.stale.toString()} tone="danger" />
          <MetricCard icon={Rss} label="Pollable now" value={freshnessSummary.pollable.toString()} tone="neutral" />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adapters.map((adapter) => {
            const policy = byCode.get(adapter.source.code);
            const freshness = policy ? assessSourceFreshness(policy) : null;
            return (
              <article key={adapter.source.code} className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{adapter.source.displayName}</p>
                    <p className="mt-1 text-xs uppercase text-zinc-500">{adapter.source.feedType}</p>
                  </div>
                  {freshness ? <FreshnessBadge status={freshness.status} label={freshness.label} /> : null}
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <dt className="text-zinc-500">Jurisdiction</dt>
                    <dd className="min-w-0 text-right font-medium uppercase text-zinc-950">
                      {adapter.source.jurisdictionCode}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <dt className="text-zinc-500">Cadence</dt>
                    <dd className="min-w-0 text-right font-medium text-zinc-950">
                      {policy?.allowedCadenceMin ?? adapter.source.pollIntervalMin} min
                    </dd>
                  </div>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <dt className="text-zinc-500">Reuse</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-zinc-950">
                      {readableStatus(policy?.reuseStatus ?? "UNKNOWN")}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <dt className="text-zinc-500">Last fetched</dt>
                    <dd className="min-w-0 text-right font-medium text-zinc-950">
                      {compactDateTime(policy?.lastFetchedAt)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <dt className="text-zinc-500">Next due</dt>
                    <dd className="min-w-0 text-right font-medium text-zinc-950">
                      {compactDateTime(freshness?.nextDueAt)}
                    </dd>
                  </div>
                </dl>
                {freshness ? (
                  <p
                    className={cn(
                      "mt-4 rounded-md border p-2 text-xs leading-5",
                      freshnessDetailClasses[freshness.status],
                    )}
                  >
                    {freshness.detail}
                  </p>
                ) : null}
                {policy?.lastRun ? (
                  <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs leading-5 text-zinc-600">
                    Last run {policy.lastRun.status}, {compactDateTime(policy.lastRun.finishedAt)}
                    {policy.lastRun.message ? `: ${policy.lastRun.message}` : ""}
                  </p>
                ) : null}
                {adapter.source.feedUrl ? (
                  <a
                    href={adapter.source.feedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block break-all text-xs font-medium text-teal-800 hover:text-teal-950"
                  >
                    {adapter.source.feedUrl}
                  </a>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

const freshnessBadgeClasses: Record<SourceFreshnessStatus, string> = {
  CURRENT: "border-teal-200 bg-teal-50 text-teal-800",
  DUE: "border-amber-200 bg-amber-50 text-amber-900",
  STALE: "border-red-200 bg-red-50 text-red-800",
  BLOCKED: "border-red-200 bg-red-50 text-red-800",
  FAILED: "border-red-200 bg-red-50 text-red-800",
  NEVER_FETCHED: "border-amber-200 bg-amber-50 text-amber-900",
};

const freshnessDetailClasses: Record<SourceFreshnessStatus, string> = {
  CURRENT: "border-teal-200 bg-teal-50 text-teal-800",
  DUE: "border-amber-200 bg-amber-50 text-amber-900",
  STALE: "border-red-200 bg-red-50 text-red-800",
  BLOCKED: "border-red-200 bg-red-50 text-red-800",
  FAILED: "border-red-200 bg-red-50 text-red-800",
  NEVER_FETCHED: "border-amber-200 bg-amber-50 text-amber-900",
};

function FreshnessBadge({ status, label }: { status: SourceFreshnessStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold",
        freshnessBadgeClasses[status],
      )}
    >
      {label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-teal-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-zinc-700";

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <Icon className={cn("mb-2 h-4 w-4", toneClass)} aria-hidden="true" />
      <p className="text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
