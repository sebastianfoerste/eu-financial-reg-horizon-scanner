import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleAlert, FileText, ShieldCheck, X } from "lucide-react";

import {
  applyAgentArtifactAction,
  approveAgentArtifactAction,
  dismissAgentArtifactAction,
} from "@/app/agents/actions";
import { AppShell } from "@/components/app-shell";
import { getAgentRun } from "@/lib/agents/runner";
import { requireInternalOperator } from "@/lib/authz";
import { cn, compactDateTime } from "@/lib/utils";

type AgentRunPageProps = {
  params: Promise<{ runId: string }>;
};

export const dynamic = "force-dynamic";

export default async function AgentRunPage({ params }: AgentRunPageProps) {
  await requireInternalOperator();
  const { runId } = await params;
  const run = await getAgentRun(runId);
  if (!run) notFound();

  return (
    <AppShell active="/agents">
      <div className="space-y-6">
        <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Agents
        </Link>

        <section className="grid gap-4 rounded-md border border-zinc-200 bg-white p-5 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-semibold uppercase text-zinc-700">{run.kind}</span>
              <span>{run.agentVersion}</span>
              <span>{run.trigger}</span>
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-md border px-2 font-semibold",
                  run.status === "SUCCEEDED"
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : run.status === "FAILED"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                {run.status}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">{run.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{run.description}</p>
            {run.errorMessage ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {run.errorMessage}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            <Metric icon={FileText} label="Artifacts" value={run.artifactCount.toString()} />
            <Metric icon={ShieldCheck} label="Cost cents" value={(run.costCents ?? 0).toString()} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <RunFact label="Started" value={compactDateTime(run.startedAt)} />
          <RunFact label="Finished" value={run.finishedAt ? compactDateTime(run.finishedAt) : "Running"} />
          <RunFact label="Model" value={run.model ?? "None"} />
          <RunFact label="Prompt" value={run.promptVersion ?? "None"} />
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Run steps</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {run.steps.map((step) => (
              <article key={step.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{step.stepKey}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {step.status}, started {compactDateTime(step.startedAt)}
                    </p>
                  </div>
                  {step.errorMessage ? (
                    <span className="inline-flex h-7 items-center rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-800">
                      Failed
                    </span>
                  ) : null}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Step input and output</summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">
                    {JSON.stringify({ input: step.inputJson, output: step.outputJson }, null, 2)}
                  </pre>
                </details>
              </article>
            ))}
            {run.steps.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">No steps have been recorded for this run.</div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Artifacts</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {run.artifacts.map((artifact) => (
              <article key={artifact.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_220px]">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold uppercase text-zinc-700">{artifact.type}</span>
                    <span>{artifact.status}</span>
                    <span>{compactDateTime(artifact.createdAt)}</span>
                    {artifact.publicationId ? (
                      <Link href={`/publications/${artifact.publicationId}`} className="text-teal-700 hover:text-teal-900">
                        Publication
                      </Link>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-950">{artifact.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{artifact.summary}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Payload and provenance</summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">
                      {JSON.stringify(
                        { payload: artifact.payloadJson, provenance: artifact.provenanceJson },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
                <div className="space-y-2">
                  <form action={approveAgentArtifactAction}>
                    <input type="hidden" name="artifactId" value={artifact.id} />
                    <button
                      disabled={artifact.status !== "DRAFT"}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Approve artifact
                    </button>
                  </form>
                  <form action={dismissAgentArtifactAction}>
                    <input type="hidden" name="artifactId" value={artifact.id} />
                    <button
                      disabled={artifact.status !== "DRAFT"}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Dismiss
                    </button>
                  </form>
                  <form action={applyAgentArtifactAction}>
                    <input type="hidden" name="artifactId" value={artifact.id} />
                    <button
                      disabled={artifact.status !== "APPROVED" || artifact.type !== "ALERT_DRAFT"}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Apply as in-app draft
                    </button>
                  </form>
                </div>
              </article>
            ))}
            {run.artifacts.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                This run completed without creating artifacts.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Hashes</h2>
              <p className="mt-2 break-all font-mono text-xs leading-5 text-zinc-600">Input {run.inputHash}</p>
              <p className="mt-1 break-all font-mono text-xs leading-5 text-zinc-600">
                Output {run.outputHash ?? "pending"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <Icon className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
      <p className="text-xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function RunFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}
