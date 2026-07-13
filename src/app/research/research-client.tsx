"use client";

import { useState } from "react";

type Workspace = Awaited<ReturnType<typeof import("@/lib/legora-persistence").loadPersistedResearchWorkspace>>;

export function ResearchClient({ initial }: { initial: Workspace }) {
  const [workspace, setWorkspace] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch("/api/research/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: workspace.collaboration.revision, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Research mutation failed");
      return;
    }
    setError(null);
    setWorkspace(result);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold text-zinc-950">Persisted publication review</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Revision {workspace.collaboration.revision}. Comments, decisions, evidence and activity are stored in PostgreSQL.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded border px-3 py-1 text-sm" onClick={() => mutate({ action: "lock" })}>Lock review</button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => mutate({ action: "comment", targetId: "brief:0", value: "Official source checked against the pinned publication version." })}>Comment</button>
        {workspace.researchPlan.passages.filter((passage) => passage.verification === "review_required").map((passage) => (
          <button key={passage.id} className="rounded border px-3 py-1 text-sm" onClick={() => mutate({ action: "verify_passage", targetId: passage.id })}>Verify {passage.id}</button>
        ))}
        {workspace.editor.changes.map((change) => (
          <button key={change.id} className="rounded border px-3 py-1 text-sm" onClick={() => mutate({ action: "decide_change", targetId: change.id, value: "accepted" })}>
            Accept {change.id}
          </button>
        ))}
        <button className="rounded border px-3 py-1 text-sm" onClick={() => mutate({ action: "approve_brief" })}>Approve brief</button>
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        <a className="text-blue-700 underline" href="/api/research/export?format=markdown">Export Markdown</a>
        <a className="text-blue-700 underline" href="/api/research/export?format=docx">Export DOCX</a>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        External delivery remains blocked. Export requires evidence, decided changes and reviewer approval.
      </p>
    </section>
  );
}
