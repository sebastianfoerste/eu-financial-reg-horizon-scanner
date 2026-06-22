import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw, Save, TriangleAlert } from "lucide-react";

import { decideReviewAction, reclassifyPublicationAction } from "@/app/review/actions";
import { AppShell } from "@/components/app-shell";
import { ImpactExplanationPanel } from "@/components/impact-explanation-panel";
import { StatusBadge } from "@/components/status-badge";
import { listLatestAgentArtifacts } from "@/lib/agents/runner";
import { requireInternalOperator } from "@/lib/authz";
import { getPublicationParagraphDiffs } from "@/lib/publications";
import { getReviewItem } from "@/lib/review";
import { buildRegulatoryActionPacket } from "@/lib/regulatory-action-packet";
import { summarizeReviewReadiness, type ReviewReadinessStatus } from "@/lib/review-readiness";
import { listSourceDiligence } from "@/lib/source-diligence";
import { cn, compactDateTime } from "@/lib/utils";

type ReviewDetailProps = {
  params: Promise<{ publicationId: string }>;
};

const statuses = ["PENDING", "IN_REVIEW", "APPROVED", "NEEDS_CHANGES", "FALSE_POSITIVE", "ARCHIVED"];

export default async function ReviewDetailPage({ params }: ReviewDetailProps) {
  const operator = await requireInternalOperator();
  const { publicationId } = await params;
  const organisationId = operator.mode === "clerk" ? (operator.organisationId ?? undefined) : undefined;
  const item = await getReviewItem(publicationId, organisationId);
  if (!item) notFound();
  const publication = item.publication;
  const [agentArtifacts, diligence, paragraphDiffs] = await Promise.all([
    listLatestAgentArtifacts({
      organisationId,
      publicationId: publication.id,
      take: 6,
    }),
    listSourceDiligence(),
    getPublicationParagraphDiffs(publication.id),
  ]);
  const readiness = summarizeReviewReadiness(item);
  const actionPacket = buildRegulatoryActionPacket({
    reviewItem: item,
    sourceDiligence: diligence.find((record) => record.sourceCode === publication.sourceCode),
    paragraphDiffs,
  });

  return (
    <AppShell active="/review">
      <div className="space-y-6">
        <Link href="/review" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Review queue
        </Link>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">{item.status}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{publication.title}</h1>
              <p className="mt-2 text-sm text-zinc-600">
                {publication.sourceName}, {publication.publicationType}, fetched {compactDateTime(publication.fetchedAt)}
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                Classification {publication.classifierStatus}: {publication.classifierModel} / {publication.classifierVersion}
                {" "}({publication.taxonomyVersion})
              </p>
              {publication.classifierError ? (
                <p className="mt-2 text-sm leading-6 text-amber-700">{publication.classifierError}</p>
              ) : null}
              <form action={reclassifyPublicationAction} className="mt-4">
                <input type="hidden" name="publicationId" value={publication.id} />
                <input type="hidden" name="reviewerName" value={item.reviewerName ?? "Sebastian"} />
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Reclassify public text
                </button>
              </form>
            </div>
            <StatusBadge bucket={publication.impactBucket} score={publication.impactScore} />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.8fr]">
          <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Classification correction</h2>
            <form action={decideReviewAction} className="mt-4 space-y-4">
              <input type="hidden" name="publicationId" value={publication.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Select name="status" label="Decision" options={statuses} defaultValue={item.status} />
                <Input name="reviewerName" label="Reviewer" defaultValue={item.reviewerName ?? "Sebastian"} />
              </div>
              <Textarea name="reason" label="Reason" defaultValue={item.decisionReason ?? "Pilot review decision."} />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  name="confidence"
                  label="Confidence (0 to 1)"
                  defaultValue={publication.confidence.toString()}
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                />
                <Input
                  name="deadline"
                  label="Deadline"
                  defaultValue={publication.deadline?.slice(0, 10) ?? ""}
                  type="date"
                />
              </div>
              <Textarea
                name="regulationFamilies"
                label="Regulation family tags"
                defaultValue={publication.tags.regulationFamilies.join(", ")}
              />
              <Textarea name="activities" label="Activity tags" defaultValue={publication.tags.activities.join(", ")} />
              <Textarea
                name="licenceTypes"
                label="Licence type tags"
                defaultValue={publication.tags.licenceTypes.join(", ")}
              />
              <Textarea name="topicPaths" label="Topic tags" defaultValue={publication.tags.topicPaths.join(", ")} />
              <Textarea
                name="jurisdictions"
                label="Jurisdiction tags"
                defaultValue={publication.tags.jurisdictions.join(", ")}
              />
              <Textarea name="summary" label="Summary" defaultValue={publication.summary} />
              <Textarea name="whatChanged" label="What changed" defaultValue={publication.whatChanged} />
              <Textarea name="whoIsAffected" label="Who is affected" defaultValue={publication.whoIsAffected} />
              <Textarea name="recommendedAction" label="Recommended action" defaultValue={publication.recommendedAction} />
              <Textarea
                name="serviceOfferingIds"
                label="Service offering IDs"
                defaultValue={publication.serviceOfferingIds.join(", ")}
              />
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save review decision
              </button>
            </form>
          </section>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Review readiness</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {readiness.readyForAlertDraft
                      ? "Eligible for reviewed alert draft generation."
                      : `${readiness.blockingCount} blocking item${readiness.blockingCount === 1 ? "" : "s"} before alert drafting.`}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-2 text-xs font-semibold",
                    readiness.readyForAlertDraft
                      ? "border-teal-200 bg-teal-50 text-teal-800"
                      : "border-red-200 bg-red-50 text-red-800",
                  )}
                >
                  {readiness.readyForAlertDraft ? "Ready" : "Blocked"}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {readiness.checks.map((check) => (
                  <ReadinessCheckRow key={check.key} status={check.status} label={check.label} detail={check.detail} />
                ))}
              </div>
            </section>

            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Regulatory action packet</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {actionPacket.review_notice}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-2 text-xs font-semibold",
                    actionPacket.blockers.length
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-teal-200 bg-teal-50 text-teal-800",
                  )}
                >
                  {actionPacket.blockers.length ? "Blocked" : "Ready"}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Source</dt>
                  <dd className="text-right font-medium text-zinc-950">{actionPacket.source_status.authority_level}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Review gate</dt>
                  <dd className="text-right font-medium text-zinc-950">{actionPacket.review_gate.status}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Alert eligible</dt>
                  <dd className="text-right font-medium text-zinc-950">{actionPacket.alert_eligibility.eligible ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Paragraph changes</dt>
                  <dd className="text-right font-medium text-zinc-950">
                    {actionPacket.change_proof.paragraph_diff_count}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Text retention</dt>
                  <dd className="text-right font-medium text-zinc-950">Hashes only</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Digest</dt>
                  <dd className="text-right font-mono text-xs text-teal-800">{actionPacket.digest.slice(0, 16)}</dd>
                </div>
              </dl>
              {item.status === "APPROVED" ? (
                <Link
                  href={`/api/review/${publication.id}/action-packet`}
                  className="mt-4 inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Open packet JSON
                </Link>
              ) : (
                <p className="mt-4 text-xs text-zinc-500">Packet JSON is exposed after approval.</p>
              )}
            </section>

            <ImpactExplanationPanel publication={publication} />

            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Agent suggestions</h2>
              <div className="mt-4 space-y-3">
                {agentArtifacts.length ? (
                  agentArtifacts.map((artifact) => (
                    <Link
                      key={artifact.id}
                      href={`/agents/${artifact.agentRunId}`}
                      className="block rounded-md border border-zinc-200 bg-zinc-50 p-3 hover:border-zinc-400"
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
                  <p className="text-sm text-zinc-500">Run the review QA or classification triage agent to attach suggestions.</p>
                )}
              </div>
            </section>

            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Correction history</h2>
              <div className="mt-4 space-y-3">
                {item.revisions.length ? (
                  item.revisions.map((revision) => (
                    <div key={revision.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-sm font-semibold text-zinc-950">{revision.reviewerName}</p>
                      <p className="mt-1 text-xs text-zinc-500">{compactDateTime(revision.createdAt)}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">{revision.reason}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-zinc-600">Before and after</summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-50">
                          {JSON.stringify(
                            { before: revision.beforeJson, after: revision.afterJson },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No corrections have been recorded yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
  step,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="h-10 min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 min-w-0 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={4}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-950"
      />
    </label>
  );
}

const readinessStatusClasses: Record<ReviewReadinessStatus, string> = {
  PASS: "border-teal-200 bg-teal-50 text-teal-800",
  WARN: "border-amber-200 bg-amber-50 text-amber-900",
  BLOCK: "border-red-200 bg-red-50 text-red-800",
};

function ReadinessIcon({ status }: { status: ReviewReadinessStatus }) {
  if (status === "PASS") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === "WARN") return <TriangleAlert className="h-4 w-4" aria-hidden="true" />;
  return <CircleAlert className="h-4 w-4" aria-hidden="true" />;
}

function ReadinessCheckRow({
  status,
  label,
  detail,
}: {
  status: ReviewReadinessStatus;
  label: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border",
          readinessStatusClasses[status],
        )}
      >
        <ReadinessIcon status={status} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-950">{label}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}
