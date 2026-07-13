export type AuthorityTier = "eu_legislation" | "delegated_act" | "eu_authority" | "national_authority" | "commentary";

export interface ResearchPlan {
  schema: "research.plan.v1";
  id: string;
  organisationId: string | null;
  publicationId: string;
  publicationVersionId: string;
  taxonomyVersion: string;
  jurisdictions: string[];
  questions: string[];
  passages: Array<{ id: string; authorityTier: AuthorityTier; text: string; sourceRef: string; retrievalOrigin: string; verification: "verified" | "review_required" }>;
  unresolvedQuestions: string[];
}

export interface PublicationCollaboration {
  schema: "review.collaboration.v1";
  reviewItemId: string;
  revision: number;
  reviewer: string | null;
  lock: { actor: string; expiresAt: string } | null;
  comments: Array<{ id: string; targetId: string; body: string; actor: string; status: "open" | "resolved" }>;
  activity: Array<{ event: string; actor: string; targetId: string; occurredAt: string }>;
}

export interface BriefChangeSet {
  schema: "document.change-set.v1";
  publicationId: string;
  sourceVersionId: string;
  changes: Array<{ id: string; paragraphIndex: number; originalText: string; proposedText: string; evidenceRefs: string[]; decision: "pending" | "accepted" | "rejected" }>;
  evidenceGatePassed: boolean;
  reviewerApproved: boolean;
  exportFormats: Array<"markdown" | "docx">;
  externalDeliveryAllowed: false;
}

const AUTHORITY_ORDER: AuthorityTier[] = ["eu_legislation", "delegated_act", "eu_authority", "national_authority", "commentary"];

export function buildResearchPlan(input: Omit<ResearchPlan, "schema" | "unresolvedQuestions">): ResearchPlan {
  if (!input.taxonomyVersion || !input.publicationVersionId) throw new Error("Research plans require taxonomy and publication versions.");
  const passages = [...input.passages].sort((a, b) => AUTHORITY_ORDER.indexOf(a.authorityTier) - AUTHORITY_ORDER.indexOf(b.authorityTier));
  const unresolvedQuestions = input.questions.filter((question) => {
    const terms = question.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    return !passages.some((passage) => {
      const text = passage.text.normalize("NFKC").toLowerCase();
      return passage.verification === "verified" && terms.some((term) => text.includes(term));
    });
  });
  return { ...input, schema: "research.plan.v1", passages, unresolvedQuestions };
}

export function lockPublicationReview(input: { collaboration: PublicationCollaboration; actor: string; expectedRevision: number; now: Date }): PublicationCollaboration {
  if (input.collaboration.revision !== input.expectedRevision) throw new Error("409 Conflict: stale publication review revision.");
  if (input.collaboration.lock && new Date(input.collaboration.lock.expiresAt) > input.now && input.collaboration.lock.actor !== input.actor) throw new Error(`409 Conflict: review is locked by ${input.collaboration.lock.actor}.`);
  const occurredAt = input.now.toISOString();
  return { ...input.collaboration, revision: input.collaboration.revision + 1, lock: { actor: input.actor, expiresAt: new Date(input.now.getTime() + 15 * 60_000).toISOString() }, activity: [...input.collaboration.activity, { event: "locked", actor: input.actor, targetId: input.collaboration.reviewItemId, occurredAt }] };
}

export function decideBriefChange(changeSet: BriefChangeSet, id: string, decision: "accepted" | "rejected") {
  if (!changeSet.changes.some((change) => change.id === id)) throw new Error(`Unknown brief change: ${id}`);
  return { ...changeSet, changes: changeSet.changes.map((change) => change.id === id ? { ...change, decision } : change) };
}

export function canExportBrief(changeSet: BriefChangeSet) {
  return changeSet.evidenceGatePassed && changeSet.reviewerApproved && changeSet.changes.every((change) => change.decision !== "pending");
}

export function buildDemoLegoraWorkspace() {
  const researchPlan = buildResearchPlan({ id: "research:synthetic-micar-update", organisationId: null, publicationId: "publication:synthetic", publicationVersionId: "version:1", taxonomyVersion: "2026.07.13", jurisdictions: ["EU", "DE"], questions: ["What changes the authorisation timetable?"], passages: [{ id: "passage:1", authorityTier: "eu_legislation", text: "The authorisation timetable begins when the application is complete.", sourceRef: "fixture://eur-lex/micar/authorisation", retrievalOrigin: "fixture", verification: "verified" }, { id: "passage:2", authorityTier: "national_authority", text: "The national authority contact route requires current verification.", sourceRef: "fixture://bafin/micar", retrievalOrigin: "fixture", verification: "review_required" }] });
  const collaboration: PublicationCollaboration = { schema: "review.collaboration.v1", reviewItemId: "review:synthetic", revision: 1, reviewer: null, lock: null, comments: [{ id: "comment:1", targetId: "paragraph:0", body: "Verify the exact timetable against the official text.", actor: "Regulatory reviewer", status: "open" }], activity: [] };
  const editor: BriefChangeSet = { schema: "document.change-set.v1", publicationId: researchPlan.publicationId, sourceVersionId: researchPlan.publicationVersionId, changes: [{ id: "change:1", paragraphIndex: 0, originalText: "The timetable starts immediately.", proposedText: "The timetable begins when the application is complete.", evidenceRefs: [researchPlan.passages[0].sourceRef], decision: "pending" }], evidenceGatePassed: true, reviewerApproved: false, exportFormats: ["markdown", "docx"], externalDeliveryAllowed: false };
  return { researchPlan, collaboration, editor, exportAllowed: canExportBrief(editor) };
}
