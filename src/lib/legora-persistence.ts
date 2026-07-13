import { getPrisma } from "@/lib/prisma";
import { buildDemoLegoraWorkspace, canExportBrief, type BriefChangeSet, type ResearchPlan } from "@/lib/legora-workspace";
import { assertOrganisationAccess, type OperatorContext } from "@/lib/authz";

export class ReviewConflictError extends Error {}

export function workspaceIds(operator: OperatorContext) {
  const organisationId = operator.organisationId ?? "local-demo";
  return {
    reviewId: `review:${organisationId}:synthetic-publication-impact`,
    planId: `research:${organisationId}:synthetic-micar-update`,
    briefId: `brief:${organisationId}:synthetic-micar-update:v1`,
  };
}

export async function ensurePersistedResearchWorkspace(operator: OperatorContext) {
  const prisma = getPrisma();
  const demo = buildDemoLegoraWorkspace();
  const { reviewId, planId, briefId } = workspaceIds(operator);
  await prisma.$transaction(async (tx) => {
    await tx.researchPlan.upsert({
      where: { id: planId },
      create: {
        id: planId,
        organisationId: operator.organisationId,
        publicationId: demo.researchPlan.publicationId,
        publicationVersionId: demo.researchPlan.publicationVersionId,
        taxonomyVersion: demo.researchPlan.taxonomyVersion,
        jurisdictions: demo.researchPlan.jurisdictions,
        questions: demo.researchPlan.questions,
        passagesJson: demo.researchPlan.passages,
        unresolvedQuestions: demo.researchPlan.unresolvedQuestions,
        createdById: operator.userId,
      },
      update: {},
    });
    await tx.publicationReviewLock.upsert({
      where: { reviewItemId: reviewId },
      create: {
        id: `lock:${operator.organisationId ?? "local-demo"}:synthetic-publication-impact`,
        reviewItemId: reviewId,
        lockedById: operator.userId ?? "demo-reviewer",
        expiresAt: new Date("2026-07-13T00:00:00Z"),
      },
      update: {},
    });
    await tx.publicationReviewComment.upsert({
      where: { id: `comment:${operator.organisationId ?? "local-demo"}:synthetic-timetable` },
      create: {
        id: `comment:${operator.organisationId ?? "local-demo"}:synthetic-timetable`,
        reviewItemId: reviewId,
        targetId: "paragraph:0",
        body: demo.collaboration.comments[0].body,
        actorId: operator.userId,
        actorName: operator.displayName ?? "Demo reviewer",
      },
      update: {},
    });
    await tx.briefRevision.upsert({
      where: { id: briefId },
      create: {
        id: briefId,
        publicationId: demo.editor.publicationId,
        publicationVersionId: demo.editor.sourceVersionId,
        contentMarkdown: demo.editor.changes.map((change) => change.proposedText).join("\n\n"),
        changesJson: demo.editor.changes,
        evidenceRefs: demo.editor.changes.flatMap((change) => change.evidenceRefs),
      },
      update: {},
    });
  });
}

export async function loadPersistedResearchWorkspace(operator: OperatorContext) {
  const prisma = getPrisma();
  await ensurePersistedResearchWorkspace(operator);
  const { reviewId, planId, briefId } = workspaceIds(operator);
  const [plan, lock, comments, brief, activity] = await Promise.all([
    prisma.researchPlan.findFirst({ where: { id: planId, organisationId: operator.organisationId } }),
    prisma.publicationReviewLock.findUnique({ where: { reviewItemId: reviewId } }),
    prisma.publicationReviewComment.findMany({ where: { reviewItemId: reviewId }, orderBy: { createdAt: "asc" } }),
    prisma.briefRevision.findUnique({ where: { id: briefId } }),
    prisma.auditLog.findMany({
      where: { organisationId: operator.organisationId, entityType: "LEGORA_PUBLICATION_REVIEW", entityId: reviewId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!plan || !lock || !brief) throw new Error("Persisted research workspace is incomplete.");
  if (plan.organisationId && operator.organisationId) assertOrganisationAccess(operator, plan.organisationId);
  const changes = brief.changesJson as unknown as BriefChangeSet["changes"];
  const editor: BriefChangeSet = {
    schema: "document.change-set.v1",
    publicationId: brief.publicationId,
    sourceVersionId: brief.publicationVersionId,
    changes,
    evidenceGatePassed: brief.evidenceRefs.length > 0 && changes.every((change) => change.evidenceRefs.length > 0),
    reviewerApproved: brief.status === "APPROVED",
    exportFormats: ["markdown", "docx"],
    externalDeliveryAllowed: false,
  };
  return {
    researchPlan: {
      schema: "research.plan.v1",
      id: plan.id,
      organisationId: plan.organisationId,
      publicationId: plan.publicationId,
      publicationVersionId: plan.publicationVersionId,
      taxonomyVersion: plan.taxonomyVersion,
      jurisdictions: plan.jurisdictions,
      questions: plan.questions,
      passages: plan.passagesJson,
      unresolvedQuestions: plan.unresolvedQuestions,
    } as ResearchPlan,
    collaboration: {
      schema: "review.collaboration.v1",
      reviewItemId: reviewId,
      revision: lock.revision,
      reviewer: lock.lockedById,
      lock: lock.expiresAt > new Date() ? { actor: lock.lockedById, expiresAt: lock.expiresAt.toISOString() } : null,
      comments: comments.map((comment) => ({
        id: comment.id,
        targetId: comment.targetId,
        body: comment.body,
        actor: comment.actorName,
        status: comment.status.toLowerCase(),
      })),
      activity: activity.map((event) => ({
        event: event.action,
        actor: event.actorUserId ?? "system",
        targetId: String((event.payloadJson as { targetId?: string } | null)?.targetId ?? reviewId),
        occurredAt: event.createdAt.toISOString(),
      })),
    },
    editor,
    exportAllowed: canExportBrief(editor),
  };
}

export async function mutateResearchWorkspace(input: {
  operator: OperatorContext;
  action: "lock" | "comment" | "resolve_comment" | "decide_change" | "approve_brief" | "verify_passage";
  expectedRevision: number;
  value?: string;
  targetId?: string;
}) {
  const prisma = getPrisma();
  await ensurePersistedResearchWorkspace(input.operator);
  const { reviewId, planId, briefId } = workspaceIds(input.operator);
  const current = await prisma.publicationReviewLock.findUnique({ where: { reviewItemId: reviewId } });
  if (!current || current.revision !== input.expectedRevision) {
    throw new ReviewConflictError("409 Conflict: stale publication review revision");
  }
  const actor = input.operator.userId ?? "demo-reviewer";
  const now = new Date();
  if (current.expiresAt > now && current.lockedById !== actor) {
    throw new ReviewConflictError(`409 Conflict: review is locked by ${current.lockedById}`);
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.publicationReviewLock.updateMany({
      where: { reviewItemId: reviewId, revision: input.expectedRevision },
      data: {
        revision: { increment: 1 },
        lockedById: actor,
        expiresAt: input.action === "lock" ? new Date(now.getTime() + 15 * 60_000) : current.expiresAt,
      },
    });
    if (updated.count !== 1) throw new ReviewConflictError("409 Conflict: stale publication review revision");
    if (input.action === "comment") {
      if (!input.value?.trim()) throw new Error("Comment body is required.");
      await tx.publicationReviewComment.create({
        data: {
          reviewItemId: reviewId,
          targetId: input.targetId ?? "brief:0",
          body: input.value.trim(),
          actorId: input.operator.userId,
          actorName: input.operator.displayName ?? "Demo reviewer",
        },
      });
    }
    if (input.action === "resolve_comment") {
      const resolved = await tx.publicationReviewComment.updateMany({
        where: { id: input.targetId, reviewItemId: reviewId },
        data: { status: "RESOLVED", resolvedAt: now },
      });
      if (resolved.count !== 1) throw new Error("Review comment not found in active organisation.");
    }
    if (input.action === "decide_change") {
      const brief = await tx.briefRevision.findUniqueOrThrow({ where: { id: briefId } });
      const changes = brief.changesJson as unknown as BriefChangeSet["changes"];
      const next = changes.map((change) => change.id === input.targetId
        ? { ...change, decision: input.value === "accepted" ? "accepted" as const : "rejected" as const }
        : change);
      if (next.every((change) => change.id !== input.targetId)) throw new Error("Brief change not found.");
      await tx.briefRevision.update({ where: { id: briefId }, data: { changesJson: next } });
    }
    if (input.action === "verify_passage") {
      const plan = await tx.researchPlan.findUniqueOrThrow({ where: { id: planId } });
      if (plan.organisationId && input.operator.organisationId) {
        assertOrganisationAccess(input.operator, plan.organisationId);
      }
      const passages = plan.passagesJson as unknown as ResearchPlan["passages"];
      const passage = passages.find((candidate) => candidate.id === input.targetId);
      if (!passage) throw new Error("Research passage not found.");
      passage.verification = "verified";
      const questions = plan.questions;
      const unresolvedQuestions = questions.filter((question) => !passages.some((candidate) => candidate.verification === "verified" && question.toLowerCase().split(/\W+/).filter((term) => term.length > 4).some((term) => candidate.text.toLowerCase().includes(term))));
      await tx.researchPlan.update({ where: { id: plan.id }, data: { passagesJson: passages, unresolvedQuestions } });
    }
    if (input.action === "approve_brief") {
      const brief = await tx.briefRevision.findUniqueOrThrow({ where: { id: briefId } });
      const changes = brief.changesJson as unknown as BriefChangeSet["changes"];
      if (changes.some((change) => change.decision === "pending") || brief.evidenceRefs.length === 0) {
        throw new Error("Brief approval requires decided changes and evidence references.");
      }
      await tx.briefRevision.update({
        where: { id: briefId },
        data: { status: "APPROVED", reviewerId: actor, reviewedAt: now },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: input.operator.userId,
        organisationId: input.operator.organisationId,
        action: input.action.toUpperCase(),
        entityType: "LEGORA_PUBLICATION_REVIEW",
        entityId: reviewId,
        payloadJson: { targetId: input.targetId, revision: input.expectedRevision + 1 },
      },
    });
  });
  return loadPersistedResearchWorkspace(input.operator);
}

export async function loadApprovedBriefExport(operator: OperatorContext, format: "markdown" | "docx") {
  const workspace = await loadPersistedResearchWorkspace(operator);
  if (!workspace.exportAllowed) throw new Error("Brief export requires evidence and reviewer approval.");
  const accepted = workspace.editor.changes.filter((change) => change.decision === "accepted");
  const markdown = accepted.map((change) => `${change.proposedText}\n\nSources: ${change.evidenceRefs.join(", ")}`).join("\n\n");
  if (format === "markdown") return { body: markdown, contentType: "text/markdown; charset=utf-8" };
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const xml = markdown.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  zip.file("[Content_Types].xml", "<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Default Extension='xml' ContentType='application/xml'/><Override PartName='/word/document.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'/></Types>");
  zip.file("word/document.xml", `<?xml version='1.0'?><w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body><w:p><w:r><w:t>${xml}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
  return { body: await zip.generateAsync({ type: "uint8array" }), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}
