import Link from "next/link";
import { Check, CircleAlert, Send, ShieldCheck } from "lucide-react";

import { approveAlertAction, generateAlertDraftsAction, sendAlertAction } from "@/app/alerts/actions";
import { ActionNotice } from "@/components/action-notice";
import { AppShell } from "@/components/app-shell";
import { ProductMapConfirmationBadge } from "@/components/product-map-confirmation-badge";
import { StatusBadge } from "@/components/status-badge";
import { listLatestAgentArtifacts } from "@/lib/agents/runner";
import { canApproveAlertStatus, listAlerts } from "@/lib/alerts";
import { getActiveOrganisationId } from "@/lib/authz";
import { listIntegrationDiagnostics } from "@/lib/delivery";
import { getProductMapDeliveryReadiness } from "@/lib/product-maps";
import { compactDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type AlertsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const impactBuckets = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const;

function readImpactBucket(value: string) {
  return impactBuckets.includes(value as (typeof impactBuckets)[number])
    ? (value as (typeof impactBuckets)[number])
    : "NONE";
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAlertNotice(params: Record<string, string | string[] | undefined>) {
  if (readParam(params.blocked) === "footprint") {
    return { tone: "warning" as const, message: "Alert delivery is suspended until active product-map facts are confirmed." };
  }
  if (readParam(params.delivery) === "blocked") {
    return { tone: "warning" as const, message: "Reviewed delivery could not proceed. Review integration status and alert errors." };
  }
  if (readParam(params.generated) === "1") return { tone: "success" as const, message: "Alert drafts generated for eligible reviewed publications." };
  if (readParam(params.approved) === "1") return { tone: "success" as const, message: "Alert draft approved. Explicit send remains required." };
  if (readParam(params.sent) === "1") return { tone: "success" as const, message: "Reviewed alert delivery attempt recorded." };
  return null;
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const notice = getAlertNotice(await searchParams);
  const organisationId = await getActiveOrganisationId();
  const [alerts, integrations, footprintReadiness, agentArtifacts] = await Promise.all([
    listAlerts(organisationId),
    listIntegrationDiagnostics(organisationId),
    getProductMapDeliveryReadiness(organisationId),
    listLatestAgentArtifacts({ organisationId, take: 8 }),
  ]);
  const openDrafts = alerts.filter((alert) => alert.status === "DRAFT").length;
  const alertDraftArtifacts = agentArtifacts.filter((artifact) => artifact.type === "ALERT_DRAFT").slice(0, 3);

  return (
    <AppShell active="/alerts">
      <div className="space-y-6">
        {notice ? <ActionNotice tone={notice.tone}>{notice.message}</ActionNotice> : null}
        <section className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Approved delivery</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Alert drafts stay gated until review and explicit send.
            </h1>
          </div>
          <form action={generateAlertDraftsAction}>
            <button
              disabled={!footprintReadiness.ready}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
              Generate drafts
            </button>
          </form>
        </section>

        {!footprintReadiness.ready ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">{footprintReadiness.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {footprintReadiness.blockingMaps.map(({ productMap, assessment }) => (
                <Link
                  key={productMap.id}
                  href={`/product-maps/${productMap.id}`}
                  className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:border-amber-300"
                >
                  {productMap.name}
                  <ProductMapConfirmationBadge assessment={assessment} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-5">
          <Metric label="Drafts" value={openDrafts.toString()} />
          <div className="rounded-md border border-zinc-200 bg-white p-3">
            <p className="text-sm font-semibold text-zinc-950">Footprints</p>
            <p className={footprintReadiness.ready ? "mt-1 text-xs text-teal-700" : "mt-1 text-xs text-amber-700"}>
              {footprintReadiness.ready ? "Confirmed" : "Action needed"}
            </p>
          </div>
          {integrations.slice(0, 3).map((integration) => (
            <div key={integration.provider} className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-sm font-semibold text-zinc-950">{integration.label}</p>
              <p className={integration.configured && integration.databaseStatus === "ENABLED" ? "mt-1 text-xs text-teal-700" : "mt-1 text-xs text-amber-700"}>
                {integration.configured && integration.databaseStatus === "ENABLED" ? "Ready" : "Action needed"}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Agent alert previews</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Agent artifacts remain draft previews. The reviewed alert workflow below controls approval and delivery.
              </p>
            </div>
            <Link
              href="/agents"
              className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Open agents
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {alertDraftArtifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/agents/${artifact.agentRunId}`}
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3 hover:border-zinc-400"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{artifact.status}</span>
                  <span>{artifact.agentName}</span>
                </div>
                <p className="text-sm font-semibold text-zinc-950">{artifact.title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">{artifact.summary}</p>
              </Link>
            ))}
            {alertDraftArtifacts.length === 0 ? (
              <p className="text-sm text-zinc-500">No agent alert previews have been created yet.</p>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-zinc-500">Alert drafts and sends</h2>
          </div>
          <div className="divide-y divide-zinc-200">
            {alerts.map((alert) => (
              <article key={alert.id} className="grid gap-4 p-4 xl:grid-cols-[1fr_260px]">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold uppercase text-zinc-700">{alert.channel}</span>
                    <span>{alert.status}</span>
                    <span>{alert.publicationSource}</span>
                    <span>Scheduled {compactDate(alert.scheduledFor)}</span>
                  </div>
                  <Link href={`/publications/${alert.publicationId}`} className="text-sm font-semibold text-zinc-950">
                    {alert.publicationTitle}
                  </Link>
                  <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                    {alert.payload.text}
                  </p>
                  {alert.errorMessage ? (
                    <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      {alert.errorMessage}
                    </p>
                  ) : null}
                  {alert.deliveryAttempts.length ? (
                    <div className="mt-3 space-y-1 text-xs text-zinc-500">
                      {alert.deliveryAttempts.map((attempt) => (
                        <p key={attempt.id}>
                          {attempt.provider} {attempt.status}, {compactDate(attempt.attemptedAt)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {alert.proofPackets.length ? (
                    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Proof history</p>
                        <Link href={`/api/alerts/${alert.id}/proof`} className="text-xs font-semibold text-teal-800 hover:text-teal-950">
                          Open JSON
                        </Link>
                      </div>
                      <div className="mt-2 space-y-2">
                        {alert.proofPackets.slice(0, 2).map((packet) => (
                          <div key={packet.id} className="grid gap-2 text-xs text-zinc-600 md:grid-cols-[1fr_auto]">
                            <div>
                              <span className="font-semibold text-zinc-800">{packet.gateStatus}</span>
                              <span> source {packet.sourceReviewState}</span>
                              <span> reviewer {packet.reviewerState}</span>
                              <span> recipient {packet.recipientState}</span>
                              <span> HTTPS {packet.httpsSourceCheck ? "passed" : "failed"}</span>
                            </div>
                            <code className="text-teal-800">{packet.payloadDigest.slice(0, 16)}</code>
                            {packet.reasons.length ? (
                              <p className="md:col-span-2 text-amber-800">{packet.reasons.join(" ")}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <StatusBadge bucket={readImpactBucket(alert.payload.impactBucket)} score={alert.payload.impactScore} />
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Impact explanation</p>
                    <p className="mt-2 text-sm text-zinc-700">
                      Bucket {alert.payload.impactBucket}. Weighted subtotal{" "}
                      {alert.payload.rawImpactScore ?? alert.payload.impactScore}. Floor uplift{" "}
                      {alert.payload.floorAdjustment ?? 0}. Final score {alert.payload.impactScore}. Rule{" "}
                      {alert.payload.scoringRuleVersion ?? "unscored"}. Services:{" "}
                      {alert.payload.serviceOfferingIds.join(", ") || "none"}
                    </p>
                  </div>
                  <form action={approveAlertAction} className="flex gap-2">
                    <input type="hidden" name="alertId" value={alert.id} />
                    <input type="hidden" name="reviewerName" value="Sebastian" />
                    <button
                      disabled={!canApproveAlertStatus(alert.status) || !footprintReadiness.ready}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {!footprintReadiness.ready
                        ? "Confirmation required"
                        : alert.status === "DRAFT"
                          ? "Approve"
                          : canApproveAlertStatus(alert.status)
                            ? "Reapprove"
                            : "Approval closed"}
                    </button>
                  </form>
                  <form action={sendAlertAction}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <button
                      disabled={alert.status !== "APPROVED" || !footprintReadiness.ready}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {footprintReadiness.ready ? "Send reviewed alert" : "Confirmation required"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No alert drafts yet. Approve review items, then generate drafts. Send reviewed alert becomes available
                only after explicit approval.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <ShieldCheck className="mb-2 h-4 w-4 text-teal-700" aria-hidden="true" />
      <p className="text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
