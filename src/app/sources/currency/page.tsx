import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireOperator } from "@/lib/authz";
import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { buildSourceCurrencyQueue } from "@/lib/source-currency-queue";
import { listSourceDiligence } from "@/lib/source-diligence";
import { compactDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SourceCurrencyQueuePage() {
  await requireOperator();
  const [diligence, blockers] = await Promise.all([listSourceDiligence(), listActiveAlertBlockers()]);
  const queue = buildSourceCurrencyQueue(diligence, blockers);
  const top = queue[0];

  return (
    <AppShell active="/sources">
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">Source currency queue</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Review stale, restricted, failed, and alert-blocking sources first.
            </h1>
          </div>
          <Link
            href="/sources/diligence"
            className="inline-flex h-10 w-fit items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Open diligence records
          </Link>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-zinc-500">Top queue item</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950">{top ? top.sourceName : "No source records"}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {top ? top.nextAction : "Source diligence will appear here after source records are configured."}
          </p>
        </section>

        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_1.4fr] gap-3 border-b border-zinc-200 p-3 text-xs font-semibold uppercase tracking-normal text-zinc-500">
            <span>Source</span>
            <span>Score</span>
            <span>State</span>
            <span>Next action</span>
          </div>
          <div className="divide-y divide-zinc-200">
            {queue.map((item) => (
              <article key={item.sourceId} className="grid gap-3 p-3 text-sm md:grid-cols-[1.2fr_0.8fr_0.8fr_1.4fr]">
                <div>
                  <p className="font-semibold text-zinc-950">{item.sourceName}</p>
                  <p className="break-all text-xs text-zinc-500">{item.baseUrl}</p>
                  <p className="mt-1 text-xs uppercase text-zinc-500">{item.authorityLevel}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-950">{item.score}</p>
                  <p className="text-xs text-zinc-500">{item.activeAlertBlockers} alert blockers</p>
                </div>
                <div className="space-y-1 text-xs text-zinc-600">
                  <p>Reuse {item.reuseStatus}</p>
                  <p>Reviewed {compactDateTime(item.lastReviewedAt)}</p>
                  <p>Next {compactDateTime(item.nextReviewAt)}</p>
                  <p>Run {item.lastRunStatus ?? "none"}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-700">{item.nextAction}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...item.blockers, ...item.warnings].map((reason) => (
                      <span key={reason} className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

async function listActiveAlertBlockers(): Promise<Record<string, number>> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return {};
  }

  const packets = await getPrisma().alertProofPacket.findMany({
    where: { gateStatus: "blocked" },
    select: {
      alert: {
        select: {
          publication: {
            select: {
              source: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return packets.reduce<Record<string, number>>((counts, packet) => {
    const code = packet.alert.publication.source.code;
    counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, {});
}
