import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Send,
  ShieldCheck,
} from "lucide-react";

import { advanceClientBriefAction, createClientBriefDraftAction } from "@/app/law-firm/actions";
import { ActionNotice } from "@/components/action-notice";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireInternalOperator } from "@/lib/authz";
import { getLawFirmMatter, type ClientBriefView, type FirmMatterView } from "@/lib/law-firm";
import { cn, compactDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type MatterPageProps = {
  params: Promise<{ matterId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readNotice(params: Record<string, string | string[] | undefined>) {
  if (readParam(params.brief) === "created") {
    return { tone: "success" as const, message: "Client brief draft created. Partner approval is still required before client use." };
  }
  if (readParam(params.brief) === "advanced") {
    return { tone: "success" as const, message: "Client brief status updated and audit record written." };
  }
  return null;
}

export default async function LawFirmMatterPage({ params, searchParams }: MatterPageProps) {
  await requireInternalOperator();
  const [{ matterId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const [matter, notice] = await Promise.all([getLawFirmMatter(matterId), Promise.resolve(readNotice(resolvedSearchParams))]);

  if (!matter) notFound();

  const topSignal = matter.signals[0];

  return (
    <AppShell active="/law-firm">
      <div className="space-y-6">
        {notice ? <ActionNotice tone={notice.tone}>{notice.message}</ActionNotice> : null}

        <section className="grid gap-4 border-b border-zinc-200 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Link
              href="/law-firm"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Law firm workbench
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-normal text-teal-700">Matter cockpit</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">{matter.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              {matter.clientName}. {matter.notes}
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <MatterPill>{matter.matterCode ?? "No code"}</MatterPill>
              <MatterPill>{matter.status}</MatterPill>
              <MatterPill>{matter.accessPolicy}</MatterPill>
            </div>
            {topSignal ? <StatusBadge bucket={topSignal.relevanceBucket} score={topSignal.relevanceScore} /> : null}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric icon={BriefcaseBusiness} label="Matter type" value={readable(matter.matterType)} />
          <Metric icon={ShieldCheck} label="Sensitivity" value={readable(matter.sensitivity)} tone="warning" />
          <Metric icon={FileText} label="Signals" value={matter.signals.length.toString()} />
          <Metric icon={BookOpenCheck} label="Brief drafts" value={matter.clientBriefs.length.toString()} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 rounded-md border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Regulatory signals</h2>
            </div>
            <div className="divide-y divide-zinc-200">
              {matter.signals.map((signal) => (
                <article key={signal.id} className="grid min-w-0 gap-4 p-4 lg:grid-cols-[1fr_190px]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold uppercase text-zinc-700">{signal.sourceCode}</span>
                      <span>{signal.publicationType}</span>
                      <span>{signal.status}</span>
                    </div>
                    <Link href={`/publications/${signal.publicationId}`} className="break-words text-sm font-semibold text-zinc-950 hover:text-teal-800">
                      {signal.publicationTitle}
                    </Link>
                    <p className="mt-2 break-words text-xs leading-5 text-zinc-600">{signal.rationale}</p>
                    <p className="mt-2 break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">
                      {signal.suggestedAction}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-3">
                    <StatusBadge bucket={signal.relevanceBucket} score={signal.relevanceScore} />
                    <form action={createClientBriefDraftAction}>
                      <input type="hidden" name="matterId" value={matter.id} />
                      <input type="hidden" name="publicationId" value={signal.publicationId} />
                      <input type="hidden" name="reviewerName" value="Sebastian" />
                      <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Draft brief
                      </button>
                    </form>
                    <a
                      href={signal.sourceUrl}
                      className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      Source
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <section className="rounded-md border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Client brief drafts</h2>
              </div>
              <div className="divide-y divide-zinc-200">
                {matter.clientBriefs.map((brief) => (
                  <BriefPanel key={brief.id} brief={brief} matter={matter} />
                ))}
                {matter.clientBriefs.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500">No brief drafts yet. Use a signal to create an internal draft.</div>
                ) : null}
              </div>
            </section>

            <section className="rounded-md border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Ethical walls and controls</h2>
              <div className="mt-4 space-y-3">
                <ControlFact icon={LockKeyhole} label="Access policy" value={readable(matter.accessPolicy)} />
                <ControlFact icon={ShieldCheck} label="Relationship partner" value={matter.relationshipPartnerName} />
                <ControlFact icon={CheckCircle2} label="Responsible associate" value={matter.responsibleAssociateName} />
                {matter.ethicalWalls.map((wall) => (
                  <div key={wall.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-950">{wall.name}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">{wall.notes}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-md border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Knowledge assets</h2>
            <div className="mt-4 space-y-3">
              {matter.knowledgeAssets.map((asset) => (
                <div key={asset.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold uppercase text-zinc-700">{asset.kind}</span>
                    <span>{asset.status}</span>
                    <span>{asset.visibility}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-950">{asset.title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{asset.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Commercial routing</h2>
            <div className="mt-4 space-y-3">
              {matter.opportunities.map((opportunity) => (
                <div key={opportunity.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase text-zinc-700">{opportunity.stage}</span>
                    <span className="text-xs font-semibold text-teal-800">
                      {opportunity.estimatedValueEur ? formatMoney(Number(opportunity.estimatedValueEur)) : "Unpriced"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-950">{opportunity.title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{opportunity.rationale}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{opportunity.nextAction}</p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  );
}

function BriefPanel({ brief, matter }: { brief: ClientBriefView; matter: FirmMatterView }) {
  const nextStatuses = brief.status === "DRAFT"
    ? ["SENIOR_REVIEW", "PARTNER_REVIEW"]
    : brief.status === "SENIOR_REVIEW"
      ? ["PARTNER_REVIEW"]
      : brief.status === "PARTNER_REVIEW"
        ? ["CLIENT_READY"]
        : [];

  return (
    <article className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className={cn("inline-flex h-6 items-center rounded-md border px-2 font-semibold", briefStatusClass(brief.status))}>
          {brief.status}
        </span>
        <span>{compactDateTime(brief.createdAt)}</span>
      </div>
      <h3 className="text-sm font-semibold text-zinc-950">{brief.title}</h3>
      <pre className="mt-3 max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">
        {brief.body}
      </pre>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {nextStatuses.map((status) => (
          <form key={status} action={advanceClientBriefAction}>
            <input type="hidden" name="matterId" value={matter.id} />
            <input type="hidden" name="briefId" value={brief.id} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="reviewerName" value="Sebastian" />
            <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Move to {readable(status)}
            </button>
          </form>
        ))}
        {brief.status === "CLIENT_READY" ? (
          <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900">
            <Send className="h-4 w-4" aria-hidden="true" />
            Client-ready record
          </span>
        ) : null}
      </div>
    </article>
  );
}

function MatterPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs font-semibold text-zinc-700">
      {children}
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "normal",
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  tone?: "normal" | "warning";
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <Icon className={cn("mb-2 h-4 w-4", tone === "warning" ? "text-amber-700" : "text-teal-700")} aria-hidden="true" />
      <p className="text-lg font-semibold leading-6 text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function ControlFact({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <Icon className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function briefStatusClass(status: string) {
  if (status === "CLIENT_READY") return "border-teal-200 bg-teal-50 text-teal-900";
  if (status === "PARTNER_REVIEW") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
