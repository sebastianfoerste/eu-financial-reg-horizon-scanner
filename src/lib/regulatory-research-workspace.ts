export type ResearchSourceStatus = "verified" | "review_required" | "stale";

export interface RegulatoryKnowledgeSource {
  id: string;
  authority: string;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  status: ResearchSourceStatus;
  legalStatus: "binding" | "guidance" | "consultation" | "market_context";
  topics: string[];
  text: string;
}

export interface RegulatoryKnowledgeBase {
  schema: "horizon-scanner.regulatory-knowledge-base.v1";
  sources: RegulatoryKnowledgeSource[];
  authorities: string[];
  topicIndex: Record<string, string[]>;
  verifiedCount: number;
  openReviewCount: number;
}

export interface ResearchCitation {
  sourceId: string;
  title: string;
  sourceUrl: string;
  authority: string;
  legalStatus: RegulatoryKnowledgeSource["legalStatus"];
  status: ResearchSourceStatus;
}

export interface ImpactResearchAnswer {
  schema: "horizon-scanner.impact-research-answer.v1";
  query: string;
  summary: string;
  affectedTopics: string[];
  citations: ResearchCitation[];
  status: "answered" | "review_required" | "insufficient_sources";
  reviewRequired: true;
  deliveryAllowed: false;
}

export interface SharedImpactSpace {
  schema: "horizon-scanner.shared-impact-space.v1";
  spaceId: string;
  publicationIds: string[];
  participants: {
    role: "legal_owner" | "compliance_reviewer" | "product_owner";
    access: "manage" | "review" | "comment";
  }[];
  decisionState: "draft" | "approved_for_internal_use";
  openQuestions: string[];
  auditEvents: string[];
  externalDeliveryAllowed: false;
}

export function buildRegulatoryKnowledgeBase(
  sources: RegulatoryKnowledgeSource[],
): RegulatoryKnowledgeBase {
  const ids = new Set<string>();
  const topicIndex: Record<string, string[]> = {};
  for (const source of sources) {
    if (ids.has(source.id)) throw new Error(`Duplicate regulatory source id: ${source.id}`);
    if (!source.sourceUrl.startsWith("https://")) throw new Error(`Source ${source.id} requires an HTTPS provenance URL.`);
    ids.add(source.id);
    for (const topic of source.topics) {
      (topicIndex[topic] ??= []).push(source.id);
    }
  }
  return {
    schema: "horizon-scanner.regulatory-knowledge-base.v1",
    sources,
    authorities: [...new Set(sources.map((source) => source.authority))],
    topicIndex,
    verifiedCount: sources.filter((source) => source.status === "verified").length,
    openReviewCount: sources.filter((source) => source.status !== "verified").length,
  };
}

export function researchRegulatoryImpact(
  knowledgeBase: RegulatoryKnowledgeBase,
  query: string,
): ImpactResearchAnswer {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9äöüß]{4,}/g) ?? [])];
  const selected = knowledgeBase.sources
    .map((source) => {
      const searchable = `${source.title} ${source.text} ${source.topics.join(" ")}`.toLowerCase();
      return { source, score: terms.filter((term) => searchable.includes(term)).length };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.source.publishedAt.localeCompare(left.source.publishedAt))
    .slice(0, 5)
    .map((item) => item.source);
  const status: ImpactResearchAnswer["status"] =
    selected.length === 0
      ? "insufficient_sources"
      : selected.every((source) => source.status === "verified")
        ? "answered"
        : "review_required";
  return {
    schema: "horizon-scanner.impact-research-answer.v1",
    query,
    summary:
      selected.length === 0
        ? "No indexed publication supports this query. Add a source and complete source review."
        : `The indexed publications connect the query to ${[...new Set(selected.flatMap((source) => source.topics))].join(", ")}. Confirm actor, product scope, application date and implementation status before drafting an alert.`,
    affectedTopics: [...new Set(selected.flatMap((source) => source.topics))],
    citations: selected.map((source) => ({
      sourceId: source.id,
      title: source.title,
      sourceUrl: source.sourceUrl,
      authority: source.authority,
      legalStatus: source.legalStatus,
      status: source.status,
    })),
    status,
    reviewRequired: true,
    deliveryAllowed: false,
  };
}

export function buildSharedImpactSpace(input: {
  spaceId: string;
  publicationIds: string[];
  openQuestions: string[];
  approvedForInternalUse?: boolean;
}): SharedImpactSpace {
  return {
    schema: "horizon-scanner.shared-impact-space.v1",
    spaceId: input.spaceId,
    publicationIds: input.publicationIds,
    participants: [
      { role: "legal_owner", access: "manage" },
      { role: "compliance_reviewer", access: "review" },
      { role: "product_owner", access: "comment" },
    ],
    decisionState: input.approvedForInternalUse ? "approved_for_internal_use" : "draft",
    openQuestions: input.openQuestions,
    auditEvents: ["source_added", "comment_recorded", "impact_decision_recorded", "alert_draft_created"],
    externalDeliveryAllowed: false,
  };
}

export function buildDemoResearchWorkspace() {
  const knowledgeBase = buildRegulatoryKnowledgeBase([
    {
      id: "pub-esma-micar",
      authority: "ESMA",
      title: "Synthetic MiCAR implementation publication",
      sourceUrl: "https://www.esma.europa.eu/",
      publishedAt: "2026-06-30",
      status: "verified",
      legalStatus: "guidance",
      topics: ["MiCAR", "CASP authorization", "crypto-asset services"],
      text: "The publication concerns authorization evidence and supervisory expectations for crypto-asset service providers.",
    },
    {
      id: "pub-eba-dora",
      authority: "EBA",
      title: "Synthetic DORA outsourcing publication",
      sourceUrl: "https://www.eba.europa.eu/",
      publishedAt: "2026-06-24",
      status: "review_required",
      legalStatus: "consultation",
      topics: ["DORA", "ICT third-party risk", "outsourcing"],
      text: "The consultation covers ICT third-party risk controls and contractual exit readiness.",
    },
  ]);
  const answer = researchRegulatoryImpact(
    knowledgeBase,
    "How could MiCAR authorization and DORA outsourcing developments affect a crypto-asset service provider?",
  );
  return {
    knowledgeBase,
    answer,
    sharedSpace: buildSharedImpactSpace({
      spaceId: "impact-space-synthetic-casp",
      publicationIds: answer.citations.map((citation) => citation.sourceId),
      openQuestions: [
        "Which regulated entity and product map are affected?",
        "Does the source change an existing obligation or clarify implementation?",
        "Which evidence owner must review the draft impact assessment?",
      ],
    }),
  };
}
