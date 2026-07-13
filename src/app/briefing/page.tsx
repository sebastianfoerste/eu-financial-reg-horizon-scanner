import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, FileText, Gauge, RadioTower, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { listLatestAgentArtifacts } from "@/lib/agents/runner";
import { listAlerts } from "@/lib/alerts";
import { getActiveOrganisationId } from "@/lib/authz";
import { buildPilotBriefing, type BriefingTone } from "@/lib/pilot-briefing";
import { getProductMapDeliveryReadiness, listProductMaps } from "@/lib/product-maps";
import { listPublications } from "@/lib/publications";
import { listReviewQueue } from "@/lib/review";
import { listSourceDiligence } from "@/lib/source-diligence";
import { summarizeSourceFreshness } from "@/lib/source-health";
import { cn, compactDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const organisationId = await getActiveOrganisationId();
  const [publications, reviewItems, alerts, sourceDiligence, productMapReadiness, productMaps, agentArtifacts] =
    await Promise.all([
      listPublications({}, organisationId),
      listReviewQueue(organisationId),
      listAlerts(organisationId),
      listSourceDiligence(),
      getProductMapDeliveryReadiness(organisationId),
      listProductMaps(organisationId),
      listLatestAgentArtifacts({ organisationId, take: 5 }),
    ]);
  const sourceFreshness = summarizeSourceFreshness(sourceDiligence);
  const briefing = buildPilotBriefing({
    publications,
    reviewItems,
    alerts,
    sourceFreshness,
    productMapReadiness,
    productMaps,
  });

  return (
    <AppShell active="/briefing">
      <div className="space-y-6">
        <section className="grid gap-4 border-b border-zinc-200 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Pilot briefing room</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              One operating view for review, impact and delivery.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Internal briefing only. It turns the current publication estate into an operator decision record without
              sending email, Slack, Teams, HubSpot or public content.
            </p>
            <a
              href="/api/briefing/dossier"
              className="mt-4 inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Download decision dossier
            </a>
          </div>
          <div className={cn("rounded-md border p-4", statusClasses[briefing.status])}>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              <p className="text-sm font-semibold">{readableStatus(briefing.status)}</p>
            </div>
            <p className="mt-2 font-mono text-xs opacity-80">{compactDateTime(briefing.generatedAt)}</p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={FileText} label="Publications" value={briefing.metrics.publications.toString()} />
          <MetricCard icon={AlertTriangle} label="High impact" value={briefing.metrics.highImpact.toString()} tone="danger" />
          <MetricCard icon={ShieldCheck} label="Review ready" value={briefing.metrics.reviewReady.toString()} tone="success" />
          <MetricCard icon={Bell} label="Approved alerts" value={briefing.metrics.approvedAlerts.toString()} tone="warning" />
          <MetricCard icon={RadioTower} label="SLA blockers" value={briefing.metrics.sourceSlaBlockers.toString()} tone="danger" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Executive brief</h2>
            <p className="mt-4 text-lg font-semibold leading-7 text-zinc-950">{briefing.executiveSummary}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniFact label="Service routes" value={briefing.metrics.serviceOfferings.toString()} />
              <MiniFact label="Critical product lines" value={briefing.metrics.criticalProductLines.toString()} />
              <MiniFact label="Pollable sources" value={briefing.metrics.sourcePollable.toString()} />
            </div>
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Draft briefing text</p>
              <div className="mt-3 space-y-2">
                {briefing.narrative.map((line) => (
                  <p key={line} className="text-sm leading-6 text-zinc-700">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Next operator actions</h2>
            <div className="mt-4 space-y-3">
              {briefing.actions.map((action) => (
                <Link
                  key={action.key}
                  href={action.href}
                  className={cn("block rounded-md border p-3 hover:border-zinc-400", toneClasses[action.tone])}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{action.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">{action.detail}</p>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Latest agent artifacts</h2>
            <Link
              href="/agents"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Agent control room
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {agentArtifacts.length ? (
              agentArtifacts.slice(0, 3).map((artifact) => (
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
              ))
            ) : (
              <p className="text-sm text-zinc-500">No agent artifacts have been created yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Impact queue</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {briefing.riskQueue.map((item) => (
              <article key={item.publicationId} className="grid gap-4 p-4 lg:grid-cols-[1fr_210px_170px] lg:items-start">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold uppercase text-zinc-700">{item.sourceCode}</span>
                    <span>{item.reviewStatus}</span>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-md border px-2 font-semibold",
                        toneClasses[item.readinessTone],
                      )}
                    >
                      {item.readinessLabel}
                    </span>
                  </div>
                  <Link href={item.href} className="text-sm font-semibold text-zinc-950 hover:text-teal-800">
                    {item.title}
                  </Link>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Services: {item.serviceOfferingIds.join(", ") || "none routed"}
                  </p>
                </div>
                <StatusBadge bucket={item.impactBucket} score={item.impactScore} />
                <Link
                  href={item.href}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Open record
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const statusClasses: Record<string, string> = {
  ACTION_REQUIRED: "border-red-200 bg-red-50 text-red-900",
  READY_TO_SEND: "border-amber-200 bg-amber-50 text-amber-950",
  MONITORING: "border-teal-200 bg-teal-50 text-teal-900",
};

const toneClasses: Record<BriefingTone, string> = {
  urgent: "border-red-200 bg-red-50 text-red-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  normal: "border-zinc-200 bg-zinc-50 text-zinc-950",
  success: "border-teal-200 bg-teal-50 text-teal-950",
};

function readableStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "normal",
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: "normal" | "success" | "warning" | "danger";
}) {
  const iconClass =
    tone === "success"
      ? "text-teal-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-zinc-700";

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <Icon className={cn("mb-2 h-4 w-4", iconClass)} aria-hidden="true" />
      <p className="text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <CheckCircle2 className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
      <p className="text-xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
