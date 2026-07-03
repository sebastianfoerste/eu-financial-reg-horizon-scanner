import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, Play, ShieldCheck, Sparkles } from "lucide-react";

import { runAgentAction, runEnabledAgentsAction } from "@/app/agents/actions";
import { ActionNotice } from "@/components/action-notice";
import { AppShell } from "@/components/app-shell";
import { listAgentDefinitions } from "@/lib/agents/config";
import { listAgentRuns, listLatestAgentArtifacts } from "@/lib/agents/runner";
import { getActiveOrganisationId, requireInternalOperator } from "@/lib/authz";
import { cn, compactDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AgentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  await requireInternalOperator();
  const params = await searchParams;
  const organisationId = await getActiveOrganisationId();
  const [definitions, runs, artifacts] = await Promise.all([
    Promise.resolve(listAgentDefinitions()),
    listAgentRuns(organisationId),
    listLatestAgentArtifacts({ organisationId, take: 100 }),
  ]);
  const latestRunByKind = new Map(runs.map((run) => [run.kind, run]));
  const successfulRuns = runs.filter((run) => run.status === "SUCCEEDED").length;
  const failedRuns = runs.filter((run) => run.status === "FAILED").length;
  const artifactCount = runs.reduce((sum, run) => sum + run.artifactCount, 0);
  const draftArtifacts = artifacts.filter((artifact) => artifact.status === "DRAFT").length;
  const approvedArtifacts = artifacts.filter((artifact) => artifact.status === "APPROVED").length;
  const suiteNotice = readParam(params.suite) === "1";

  return (
    <AppShell active="/agents">
      <div className="space-y-6">
        {suiteNotice ? (
          <ActionNotice tone="success">Enabled agents ran successfully. Review the new artifacts before applying any workflow changes.</ActionNotice>
        ) : null}
        <section className="grid gap-4 border-b border-zinc-200 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Agent control room</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Bounded workflow agents with review gates and full audit trails.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Agents produce findings, explanations, review suggestions, and alert draft previews. External delivery
              still requires the existing approved-send workflow.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric icon={Bot} label="Agents" value={definitions.length.toString()} />
            <Metric icon={ShieldCheck} label="Drafts" value={draftArtifacts.toString()} />
            <Metric icon={CircleAlert} label="Failures" value={failedRuns.toString()} tone="warning" />
          </div>
        </section>

        <section className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Agent suite</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Runs all enabled agents and writes draft artifacts for review. Alert previews still require approval and
              an explicit apply action before they become in-app drafts.
            </p>
          </div>
          <form action={runEnabledAgentsAction}>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Run enabled agents
            </button>
          </form>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Fact
            title="Policy"
            body="Default-deny tool permissions. Product-map facts remain local. Publication-only AI is opt-in."
          />
          <Fact
            title="Outputs"
            body={`${artifactCount} recent artifacts are visible. ${approvedArtifacts} approved artifact${approvedArtifacts === 1 ? "" : "s"} can be applied where the type supports it.`}
          />
          <Fact
            title="Delivery"
            body="Agents can prepare alert previews. They cannot send email, Slack, Teams, HubSpot, or public content."
          />
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Agent registry</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {definitions.map((definition) => {
              const latestRun = latestRunByKind.get(definition.kind);
              return (
                <article key={definition.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_260px]">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold uppercase text-zinc-700">{definition.kind}</span>
                      <span>{definition.version}</span>
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-md border px-2 font-semibold",
                          definition.enabled
                            ? "border-teal-200 bg-teal-50 text-teal-800"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600",
                        )}
                      >
                        {definition.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <span>{definition.llmPolicy.toLowerCase().replaceAll("_", " ")}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-950">{definition.name}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{definition.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {definition.capabilities.slice(0, 6).map((capability) => (
                        <span
                          key={capability}
                          className="inline-flex h-6 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 font-mono text-xs text-zinc-600"
                        >
                          {capability}
                        </span>
                      ))}
                      {definition.capabilities.length > 6 ? (
                        <span className="inline-flex h-6 items-center rounded-md border border-zinc-200 px-2 text-xs text-zinc-500">
                          +{definition.capabilities.length - 6}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Latest run</p>
                      {latestRun ? (
                        <>
                          <p className="mt-2 text-sm font-semibold text-zinc-950">{latestRun.status}</p>
                          <p className="mt-1 text-xs text-zinc-500">{compactDateTime(latestRun.startedAt)}</p>
                          <p className="mt-2 text-xs leading-5 text-zinc-600">
                            {latestRun.artifactCount} artifact{latestRun.artifactCount === 1 ? "" : "s"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">No run recorded yet.</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <form action={runAgentAction}>
                        <input type="hidden" name="kind" value={definition.kind} />
                        <button
                          disabled={!definition.enabled}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Run
                        </button>
                      </form>
                      {latestRun ? (
                        <Link
                          href={`/agents/${latestRun.id}`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                        >
                          Open
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-400">
                          No run
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Recent runs</h2>
            <span className="text-xs text-zinc-500">{successfulRuns} succeeded</span>
          </div>
          <div className="divide-y divide-zinc-200">
            {runs.slice(0, 12).map((run) => (
              <Link key={run.id} href={`/agents/${run.id}`} className="grid gap-3 p-4 hover:bg-zinc-50 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold uppercase text-zinc-700">{run.kind}</span>
                    <span>{run.status}</span>
                    <span>{compactDateTime(run.startedAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-950">{run.name}</p>
                  {run.latestArtifactTitle ? (
                    <p className="mt-1 text-xs text-zinc-500">{run.latestArtifactTitle}</p>
                  ) : null}
                </div>
                <span className="inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700">
                  {run.artifactCount} artifact{run.artifactCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "normal",
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  tone?: "normal" | "warning";
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <Icon className={cn("mb-2 h-4 w-4", tone === "warning" ? "text-amber-700" : "text-teal-700")} aria-hidden="true" />
      <p className="text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <CheckCircle2 className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
      <p className="text-sm font-semibold text-zinc-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
    </div>
  );
}
