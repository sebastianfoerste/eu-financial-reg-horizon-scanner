import { AppShell } from "@/components/app-shell";
import { buildDemoResearchWorkspace } from "@/lib/regulatory-research-workspace";
import { buildDemoCollaborationWorkspace } from "@/lib/collaboration-workspace";
import { hasDatabaseUrl } from "@/lib/env";
import { loadPersistedResearchWorkspace } from "@/lib/collaboration-persistence";
import { requireOperator } from "@/lib/authz";

import { ResearchClient } from "./research-client";

export default async function ResearchWorkspacePage() {
  const { knowledgeBase, answer, sharedSpace } = buildDemoResearchWorkspace();
  const persistedCollaboration = hasDatabaseUrl()
    ? await loadPersistedResearchWorkspace(await requireOperator())
    : null;
  const collaboration = persistedCollaboration ?? buildDemoCollaborationWorkspace();
  return (
    <AppShell active="/research">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Regulatory research</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-950">Knowledge base and impact workspace</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            Query reviewed public-source publications, inspect citations and coordinate a draft impact decision across legal, compliance and product owners.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Sources", knowledgeBase.sources.length],
            ["Authorities", knowledgeBase.authorities.length],
            ["Verified", knowledgeBase.verifiedCount],
            ["Open review", knowledgeBase.openReviewCount],
          ].map(([label, value]) => (
            <article key={String(label)} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-950">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-zinc-950">Impact research assistant</h2>
              <p className="mt-1 text-sm text-zinc-600">{answer.query}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{answer.status.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-700">{answer.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {answer.citations.map((citation) => (
              <article key={citation.sourceId} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <h3 className="text-sm font-medium text-zinc-950">{citation.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{citation.authority} · {citation.legalStatus} · {citation.status}</p>
                <a href={citation.sourceUrl} className="mt-2 block text-xs text-blue-700 underline">Open official source domain</a>
              </article>
            ))}
          </div>
        </section>
        {persistedCollaboration && <ResearchClient initial={persistedCollaboration} />}

        <section className="grid gap-3 md:grid-cols-3">
          {[
            ["Research plan", `${collaboration.researchPlan.jurisdictions.length} jurisdictions`, `${collaboration.researchPlan.passages.length} ranked source passages`],
            ["Publication review", `${collaboration.collaboration.comments.length} open thread`, `Revision ${collaboration.collaboration.revision} with optimistic locking`],
            ["Evidence editor", `${collaboration.editor.changes.length} proposed change`, `DOCX and Markdown export remain review-gated`],
          ].map(([label, value, detail]) => <article key={label} className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs uppercase text-zinc-500">{label}</p><strong className="mt-1 block">{value}</strong><p className="mt-1 text-xs text-zinc-500">{detail}</p></article>)}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-950">Shared impact space</h2>
          <p className="mt-1 text-sm text-zinc-600">Decision state: {sharedSpace.decisionState.replaceAll("_", " ")}. External delivery remains blocked.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {sharedSpace.participants.map((participant) => (
              <article key={participant.role} className="rounded-md border border-zinc-200 p-3">
                <h3 className="text-sm font-medium">{participant.role.replaceAll("_", " ")}</h3>
                <p className="mt-1 text-xs text-zinc-500">{participant.access}</p>
              </article>
            ))}
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {sharedSpace.openQuestions.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
