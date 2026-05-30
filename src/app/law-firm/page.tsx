import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  CircleDollarSign,
  FileCheck2,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireInternalOperator } from "@/lib/authz";
import { listLawFirmWorkbench, type LawFirmImplementationPlan, type FirmMatterView } from "@/lib/law-firm";
import { cn, compactDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LawFirmWorkbenchPage() {
  await requireInternalOperator();
  const workbench = await listLawFirmWorkbench();

  return (
    <AppShell active="/law-firm">
      <div className="space-y-6">
        <section className="grid gap-4 border-b border-zinc-200 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Law firm workbench</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Matter-led regulatory intelligence for elite financial-regulation practices.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Publications are routed to clients, practice groups, matters, draft briefs, internal knowledge assets and
              fixed-fee opportunities. Client-facing outputs stay inside review gates.
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Generated</p>
            <p className="mt-2 font-mono text-sm text-zinc-950">{compactDateTime(workbench.generatedAt)}</p>
            <p className="mt-2 text-xs text-zinc-500">{workbench.firmName}</p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Metric icon={Users} label="Clients" value={workbench.metrics.clients.toString()} />
          <Metric icon={BriefcaseBusiness} label="Open matters" value={workbench.metrics.openMatters.toString()} />
          <Metric icon={ShieldCheck} label="High signals" value={workbench.metrics.highRelevanceSignals.toString()} tone="warning" />
          <Metric icon={FileCheck2} label="Draft briefs" value={workbench.metrics.draftBriefs.toString()} />
          <Metric icon={BookOpenCheck} label="Playbooks" value={workbench.metrics.activePlaybooks.toString()} />
          <Metric icon={CircleDollarSign} label="Opportunities" value={workbench.metrics.identifiedOpportunities.toString()} />
          <Metric icon={Landmark} label="Pipeline" value={formatMoney(workbench.metrics.estimatedPipelineEur)} tone="success" />
        </section>

        <section className="rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Detailed implementation plan</h2>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-3">
            {workbench.plan.map((plan) => (
              <ImplementationPlanCard key={plan.profile} plan={plan} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-md border border-zinc-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Priority matter board</h2>
              <span className="text-xs text-zinc-500">{workbench.matters.length} active profiles</span>
            </div>
            <div className="divide-y divide-zinc-200">
              {workbench.matters.map((matter) => (
                <MatterRow key={matter.id} matter={matter} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-md border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Client brief queue</h2>
              <div className="mt-4 space-y-3">
                {workbench.matters.flatMap((matter) =>
                  matter.clientBriefs.slice(0, 1).map((brief) => (
                    <Link
                      key={brief.id}
                      href={`/law-firm/${matter.id}`}
                      className="block rounded-md border border-zinc-200 bg-zinc-50 p-3 hover:border-zinc-400"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="font-semibold uppercase text-zinc-700">{brief.status}</span>
                        <span>{matter.clientName}</span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-950">{brief.title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-600">
                        {brief.status === "CLIENT_READY"
                          ? "Partner-approved client-ready note."
                          : "Internal review draft. Partner approval is required before client use."}
                      </p>
                    </Link>
                  )),
                )}
              </div>
            </section>

            <section className="rounded-md border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Commercial opportunities</h2>
              <div className="mt-4 space-y-3">
                {workbench.opportunities.slice(0, 5).map((opportunity) => (
                  <div key={opportunity.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-zinc-700">{opportunity.stage}</span>
                      <span className="text-xs font-semibold text-teal-800">
                        {opportunity.estimatedValueEur ? formatMoney(Number(opportunity.estimatedValueEur)) : "Unpriced"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-950">{opportunity.title}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600">{opportunity.nextAction}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-3">
          <GovernanceFact
            title="Review gates"
            body="Briefs move from draft to senior review, partner review and client-ready. The UI has no external-send control."
          />
          <GovernanceFact
            title="Ethical walls"
            body="Restricted matters carry explicit access-policy and ethical-wall metadata for matter-team scoping."
          />
          <GovernanceFact
            title="Local client facts"
            body="Matter taxonomy, client names, commercial pipeline and product-map facts stay inside the local application."
          />
        </section>
      </div>
    </AppShell>
  );
}

function MatterRow({ matter }: { matter: FirmMatterView }) {
  const topSignal = matter.signals[0];

  return (
    <article className="grid gap-4 p-4 xl:grid-cols-[1fr_190px_auto] xl:items-start">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-semibold uppercase text-zinc-700">{matter.matterCode}</span>
          <span>{matter.status}</span>
          <span>{matter.sensitivity.toLowerCase().replaceAll("_", " ")}</span>
          <span>{matter.practiceGroupName}</span>
        </div>
        <Link href={`/law-firm/${matter.id}`} className="text-sm font-semibold text-zinc-950 hover:text-teal-800">
          {matter.title}
        </Link>
        <p className="mt-2 text-xs leading-5 text-zinc-600">
          {matter.clientName}. {matter.notes}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {[...matter.regulationFamilies, ...matter.licenceTypes].slice(0, 6).map((tag) => (
            <span key={tag} className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-600">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div>{topSignal ? <StatusBadge bucket={topSignal.relevanceBucket} score={topSignal.relevanceScore} /> : null}</div>
      <Link
        href={`/law-firm/${matter.id}`}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
      >
        Open matter
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

function ImplementationPlanCard({ plan }: { plan: LawFirmImplementationPlan }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700">
          {plan.firmExample}
        </span>
        <span className="text-xs text-zinc-500">{plan.profile.toLowerCase().replaceAll("_", " ")}</span>
      </div>
      <h3 className="text-sm font-semibold text-zinc-950">{plan.objective}</h3>
      <div className="mt-4 grid gap-3">
        <PlanList title="Workflow" items={plan.workflow} />
        <PlanList title="Product changes" items={plan.productChanges} />
      </div>
      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        {plan.reviewGate}
      </p>
    </article>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">{title}</p>
      <ol className="mt-2 space-y-1">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2 text-xs leading-5 text-zinc-600">
            <span className="font-mono text-zinc-400">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GovernanceFact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <ShieldCheck className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
      <p className="text-sm font-semibold text-zinc-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{body}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "normal",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "normal" | "success" | "warning";
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <Icon className={cn("mb-2 h-4 w-4", tone === "success" ? "text-teal-700" : tone === "warning" ? "text-amber-700" : "text-zinc-700")} aria-hidden="true" />
      <p className="text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
