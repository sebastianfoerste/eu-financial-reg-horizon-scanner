import type {
  AccessPolicy,
  ClientBriefStatus,
  ConfidentialityLevel,
  FirmMatterStatus,
  FirmMatterType,
  FirmProfile,
  ImpactBucket,
  KnowledgeAssetKind,
  KnowledgeAssetStatus,
  MatterSignalStatus,
  OpportunityStage,
  Prisma,
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { getReviewerName, requireInternalOperator } from "@/lib/authz";
import { assertDemoModeAllowed, hasDatabaseUrl } from "@/lib/env";
import { mockPublications, type PublicationListItem } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";

export type LawFirmClientView = {
  id: string;
  displayName: string;
  legalName: string | null;
  sector: string | null;
  relationshipPartnerName: string;
  responsibleAssociateName: string | null;
  confidentialityLevel: ConfidentialityLevel;
  defaultAccessPolicy: AccessPolicy;
  matterCount: number;
};

export type PracticeGroupView = {
  id: string;
  name: string;
  slug: string;
  focusDescription: string;
  leadPartnerName: string;
};

export type MatterSignalView = {
  id: string;
  publicationId: string;
  publicationTitle: string;
  sourceCode: string;
  publicationType: string;
  relevanceScore: number;
  relevanceBucket: ImpactBucket;
  rationale: string;
  suggestedAction: string;
  status: MatterSignalStatus;
  sourceUrl: string;
};

export type ClientBriefView = {
  id: string;
  matterId: string;
  publicationId: string | null;
  status: ClientBriefStatus;
  title: string;
  audience: string;
  disclaimerProfile: string;
  body: string;
  reviewerName: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type KnowledgeAssetView = {
  id: string;
  matterId: string | null;
  publicationId: string | null;
  kind: KnowledgeAssetKind;
  status: KnowledgeAssetStatus;
  visibility: AccessPolicy;
  title: string;
  summary: string;
  regulationFamilies: string[];
  topicPaths: string[];
};

export type RegulatoryPlaybookView = {
  id: string;
  practiceGroupId: string | null;
  firmProfile: FirmProfile;
  name: string;
  description: string;
  triggerRegulationFamilies: string[];
  triggerTopics: string[];
  triggerLicenceTypes: string[];
  workflowSteps: string[];
  outputTemplates: string[];
  isActive: boolean;
};

export type EthicalWallView = {
  id: string;
  matterId: string;
  name: string;
  accessPolicy: AccessPolicy;
  allowedUserIds: string[];
  restrictedUserIds: string[];
  notes: string | null;
};

export type CommercialOpportunityView = {
  id: string;
  clientId: string | null;
  matterId: string | null;
  publicationId: string | null;
  serviceOfferingId: string | null;
  stage: OpportunityStage;
  title: string;
  rationale: string;
  nextAction: string;
  ownerName: string;
  estimatedValueEur: string | null;
};

export type FirmMatterView = {
  id: string;
  firmOrganisationId: string;
  clientId: string;
  clientName: string;
  practiceGroupId: string | null;
  practiceGroupName: string | null;
  matterCode: string | null;
  title: string;
  matterType: FirmMatterType;
  status: FirmMatterStatus;
  sensitivity: ConfidentialityLevel;
  accessPolicy: AccessPolicy;
  relationshipPartnerName: string;
  responsibleAssociateName: string;
  jurisdictionTags: string[];
  regulationFamilies: string[];
  activities: string[];
  licenceTypes: string[];
  topicPaths: string[];
  openedAt: string;
  notes: string | null;
  signals: MatterSignalView[];
  clientBriefs: ClientBriefView[];
  knowledgeAssets: KnowledgeAssetView[];
  ethicalWalls: EthicalWallView[];
  opportunities: CommercialOpportunityView[];
};

export type LawFirmWorkbenchView = {
  firmOrganisationId: string;
  firmName: string;
  generatedAt: string;
  metrics: {
    clients: number;
    openMatters: number;
    highRelevanceSignals: number;
    draftBriefs: number;
    clientReadyBriefs: number;
    activePlaybooks: number;
    identifiedOpportunities: number;
    estimatedPipelineEur: number;
  };
  clients: LawFirmClientView[];
  practiceGroups: PracticeGroupView[];
  matters: FirmMatterView[];
  playbooks: RegulatoryPlaybookView[];
  opportunities: CommercialOpportunityView[];
  knowledgeAssets: KnowledgeAssetView[];
  plan: LawFirmImplementationPlan[];
};

export type LawFirmImplementationPlan = {
  profile: FirmProfile;
  firmExample: string;
  objective: string;
  workflow: string[];
  productChanges: string[];
  reviewGate: string;
};

export type MatterProfile = {
  id: string;
  firmOrganisationId: string;
  clientId: string;
  clientName: string;
  practiceGroupId: string;
  practiceGroupName: string;
  matterCode: string;
  title: string;
  matterType: FirmMatterType;
  status: FirmMatterStatus;
  sensitivity: ConfidentialityLevel;
  accessPolicy: AccessPolicy;
  relationshipPartnerName: string;
  responsibleAssociateName: string;
  jurisdictionTags: string[];
  regulationFamilies: string[];
  activities: string[];
  licenceTypes: string[];
  topicPaths: string[];
  openedAt: string;
  notes: string;
};

export const DEMO_FIRM_ORG_ID = "org_law_firm_pilot";

export const demoClients: LawFirmClientView[] = [
  {
    id: "lf-client-global-sponsor",
    displayName: "Global sponsor digital assets portfolio",
    legalName: "Global Sponsor Portfolio",
    sector: "Private equity, funds and digital assets",
    relationshipPartnerName: "Kirkland-style regulatory partner",
    responsibleAssociateName: "Financial services senior associate",
    confidentialityLevel: "PRIVILEGED",
    defaultAccessPolicy: "MATTER_TEAM",
    matterCount: 1,
  },
  {
    id: "lf-client-casp-scaleup",
    displayName: "European CASP scale-up",
    legalName: "European CASP Scale-up GmbH",
    sector: "Crypto asset services and payments",
    relationshipPartnerName: "YPOG-style fintech partner",
    responsibleAssociateName: "DLT regulatory associate",
    confidentialityLevel: "CONFIDENTIAL",
    defaultAccessPolicy: "MATTER_TEAM",
    matterCount: 1,
  },
  {
    id: "lf-client-emi-custody",
    displayName: "German EMI and custody platform",
    legalName: "German EMI Custody Platform GmbH",
    sector: "Payments, e-money and crypto custody",
    relationshipPartnerName: "Annerton-style payments partner",
    responsibleAssociateName: "DORA implementation counsel",
    confidentialityLevel: "HIGHLY_CONFIDENTIAL",
    defaultAccessPolicy: "RESTRICTED",
    matterCount: 1,
  },
];

export const demoPracticeGroups: PracticeGroupView[] = [
  {
    id: "pg-global-transactions",
    name: "Financial services transactions",
    slug: "financial-services-transactions",
    focusDescription: "Deal diligence, funds regulatory support, digital asset acquisitions and portfolio risk.",
    leadPartnerName: "Global regulatory transactions partner",
  },
  {
    id: "pg-fintech-dlt",
    name: "Fintech and DLT",
    slug: "fintech-dlt",
    focusDescription: "MiCAR, CASP authorisation, token offerings, crypto funds and ZAG payment overlays.",
    leadPartnerName: "Technology boutique fintech partner",
  },
  {
    id: "pg-payments-implementation",
    name: "Payments and implementation",
    slug: "payments-implementation",
    focusDescription: "BaFin implementation, payment services, e-money, outsourcing, DORA and authority dialogue.",
    leadPartnerName: "Specialist payments partner",
  },
];

export const demoMatterProfiles: MatterProfile[] = [
  {
    id: "matter-global-sponsor-diligence",
    firmOrganisationId: DEMO_FIRM_ORG_ID,
    clientId: "lf-client-global-sponsor",
    clientName: "Global sponsor digital assets portfolio",
    practiceGroupId: "pg-global-transactions",
    practiceGroupName: "Financial services transactions",
    matterCode: "KIRKLAND-DA-001",
    title: "Digital asset acquisition regulatory diligence",
    matterType: "TRANSACTION_DILIGENCE",
    status: "OPEN",
    sensitivity: "PRIVILEGED",
    accessPolicy: "MATTER_TEAM",
    relationshipPartnerName: "Kirkland-style regulatory partner",
    responsibleAssociateName: "Financial services senior associate",
    jurisdictionTags: ["eu", "de", "esma", "bafin"],
    regulationFamilies: ["micar", "dora", "psd"],
    activities: ["custody_safekeeping_crypto", "exchange_crypto_for_fiat", "payment_initiation"],
    licenceTypes: ["casp_micar", "payment_institution_psd", "emi_emd"],
    topicPaths: ["digital_assets_specific.white_paper_review", "ict_and_resilience.third_party_arrangements"],
    openedAt: "2026-05-01T08:00:00.000Z",
    notes: "Portfolio diligence watchlist for digital asset acquisition and regulated fintech exposure.",
  },
  {
    id: "matter-casp-zag-authorisation",
    firmOrganisationId: DEMO_FIRM_ORG_ID,
    clientId: "lf-client-casp-scaleup",
    clientName: "European CASP scale-up",
    practiceGroupId: "pg-fintech-dlt",
    practiceGroupName: "Fintech and DLT",
    matterCode: "YPOG-MICAR-001",
    title: "MiCAR CASP authorisation and ZAG payment overlay",
    matterType: "AUTHORISATION",
    status: "OPEN",
    sensitivity: "CONFIDENTIAL",
    accessPolicy: "MATTER_TEAM",
    relationshipPartnerName: "YPOG-style fintech partner",
    responsibleAssociateName: "DLT regulatory associate",
    jurisdictionTags: ["eu", "de", "esma", "bafin"],
    regulationFamilies: ["micar", "psd"],
    activities: ["exchange_crypto_for_fiat", "custody_safekeeping_crypto", "issuance_of_other_crypto_assets"],
    licenceTypes: ["casp_micar", "payment_institution_psd"],
    topicPaths: ["authorisation_and_passporting.initial_authorisation", "digital_assets_specific.white_paper_review"],
    openedAt: "2026-04-15T08:00:00.000Z",
    notes: "Authorisation tracker for combined crypto asset service and payment services perimeter work.",
  },
  {
    id: "matter-emi-dora-outsourcing",
    firmOrganisationId: DEMO_FIRM_ORG_ID,
    clientId: "lf-client-emi-custody",
    clientName: "German EMI and custody platform",
    practiceGroupId: "pg-payments-implementation",
    practiceGroupName: "Payments and implementation",
    matterCode: "ANNERTON-DORA-001",
    title: "DORA outsourcing and BaFin implementation tracker",
    matterType: "IMPLEMENTATION",
    status: "MONITORING",
    sensitivity: "HIGHLY_CONFIDENTIAL",
    accessPolicy: "RESTRICTED",
    relationshipPartnerName: "Annerton-style payments partner",
    responsibleAssociateName: "DORA implementation counsel",
    jurisdictionTags: ["de", "eu", "bafin", "eba"],
    regulationFamilies: ["dora", "psd", "aml"],
    activities: ["payment_initiation", "account_information", "custody_safekeeping_crypto"],
    licenceTypes: ["emi_emd", "payment_institution_psd", "casp_micar"],
    topicPaths: ["ict_and_resilience.ict_risk_management", "ict_and_resilience.third_party_arrangements"],
    openedAt: "2026-03-20T08:00:00.000Z",
    notes: "Implementation matter for DORA register, outsourcing controls and BaFin supervisory readiness.",
  },
];

export const implementationPlan: LawFirmImplementationPlan[] = [
  {
    profile: "GLOBAL_ELITE",
    firmExample: "Kirkland & Ellis",
    objective: "Turn regulator changes into transaction, funds and portfolio risk work product.",
    workflow: [
      "Map each publication to open matters and deal teams.",
      "Create diligence insert drafts with source provenance.",
      "Route high-value issues to partner review.",
      "Convert approved analysis into client-ready matter updates.",
    ],
    productChanges: [
      "Matter-centric watchlists.",
      "Private funds and transaction diligence playbooks.",
      "Portfolio company exposure dashboard.",
      "Commercial opportunity queue for follow-on fixed-fee work.",
    ],
    reviewGate: "Partner approval before any client-facing note leaves the platform.",
  },
  {
    profile: "TECH_BOUTIQUE",
    firmExample: "YPOG",
    objective: "Support MiCAR, DLT, token, fund and payment authorisation mandates from one regulatory feed.",
    workflow: [
      "Classify MiCAR, CASP, ZAG and token publications against active client matters.",
      "Draft founder-facing action notes and filing checklist updates.",
      "Attach outputs to reusable playbooks.",
      "Promote approved notes into the client portal.",
    ],
    productChanges: [
      "CASP and ZAG matrix.",
      "Token offering checklist.",
      "Crypto fund structuring watchlist.",
      "Matter-specific authorisation tracker.",
    ],
    reviewGate: "Senior associate review followed by partner approval for client-ready notes.",
  },
  {
    profile: "FINTECH_SPECIALIST",
    firmExample: "Annerton",
    objective: "Turn BaFin, EBA, DORA, payments and crypto-custody updates into implementation tasks.",
    workflow: [
      "Route source changes to implementation matters.",
      "Draft client action registers and authority-dialogue notes.",
      "Track DORA and outsourcing changes as operational tasks.",
      "Preserve internal knowledge assets for repeat matters.",
    ],
    productChanges: [
      "BaFin implementation register.",
      "DORA outsourcing control tracker.",
      "Payment and e-money licensing matter board.",
      "Authority-dialogue note library.",
    ],
    reviewGate: "Matter-team approval before a note becomes client visible.",
  },
];

function overlap(left: string[], right: string[]) {
  return left.filter((value) => right.includes(value));
}

function bucketFromScore(score: number): ImpactBucket {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "NONE";
}

function formatEur(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return value.toString();
}

export function scorePublicationForMatter(publication: PublicationListItem, matter: Pick<
  FirmMatterView,
  "regulationFamilies" | "activities" | "licenceTypes" | "jurisdictionTags" | "topicPaths" | "matterType"
>) {
  const matchedRegulation = overlap(publication.tags.regulationFamilies, matter.regulationFamilies);
  const matchedActivities = overlap(publication.tags.activities, matter.activities);
  const matchedLicences = overlap(publication.tags.licenceTypes, matter.licenceTypes);
  const matchedJurisdictions = overlap(publication.tags.jurisdictions, matter.jurisdictionTags);
  const matchedTopics = overlap(publication.tags.topicPaths, matter.topicPaths);
  const transactionBonus = matter.matterType === "TRANSACTION_DILIGENCE" && publication.impactBucket === "HIGH" ? 8 : 0;
  const score = Math.min(
    100,
    matchedRegulation.length * 18 +
      matchedActivities.length * 10 +
      matchedLicences.length * 14 +
      matchedJurisdictions.length * 8 +
      matchedTopics.length * 12 +
      transactionBonus,
  );

  const rationaleParts = [
    matchedRegulation.length ? `regulation ${matchedRegulation.join(", ")}` : null,
    matchedActivities.length ? `activity ${matchedActivities.join(", ")}` : null,
    matchedLicences.length ? `licence ${matchedLicences.join(", ")}` : null,
    matchedJurisdictions.length ? `jurisdiction ${matchedJurisdictions.join(", ")}` : null,
    matchedTopics.length ? `topic ${matchedTopics.join(", ")}` : null,
  ].filter(Boolean);

  return {
    score,
    bucket: bucketFromScore(score),
    matches: {
      regulationFamilies: matchedRegulation,
      activities: matchedActivities,
      licenceTypes: matchedLicences,
      jurisdictions: matchedJurisdictions,
      topicPaths: matchedTopics,
    },
    rationale: rationaleParts.length
      ? `Matched ${rationaleParts.join("; ")}.`
      : "No direct matter taxonomy overlap was found.",
  };
}

function buildSuggestedAction(matter: Pick<FirmMatterView, "matterType">, publication: PublicationListItem) {
  if (matter.matterType === "TRANSACTION_DILIGENCE") {
    return "Add a regulatory-risk insert to the diligence report and check whether the acquisition model needs a condition precedent or covenant.";
  }
  if (matter.matterType === "AUTHORISATION") {
    return "Update the authorisation tracker, filing checklist and client-facing next-step note.";
  }
  if (publication.tags.regulationFamilies.includes("dora")) {
    return "Update the implementation action register and verify outsourcing, ICT and incident response evidence.";
  }
  return "Prepare a reviewed client note and update the matter knowledge asset if the point is reusable.";
}

function createMatterSignals(matter: MatterProfile): MatterSignalView[] {
  return mockPublications
    .map((publication) => {
      const scored = scorePublicationForMatter(publication, matter);
      return {
        id: `${matter.id}-${publication.id}`,
        publicationId: publication.id,
        publicationTitle: publication.title,
        sourceCode: publication.sourceCode,
        publicationType: publication.publicationType,
        relevanceScore: scored.score,
        relevanceBucket: scored.bucket,
        rationale: scored.rationale,
        suggestedAction: buildSuggestedAction(matter, publication),
        status: scored.score >= 65 ? ("TRIAGED" as MatterSignalStatus) : ("NEW" as MatterSignalStatus),
        sourceUrl: publication.sourceUrl,
      };
    })
    .filter((signal) => signal.relevanceBucket !== "NONE")
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function demoBriefsForMatter(matter: MatterProfile): ClientBriefView[] {
  const firstSignal = createMatterSignals(matter)[0];
  if (!firstSignal) return [];
  return [
    {
      id: `brief-${matter.id}`,
      matterId: matter.id,
      publicationId: firstSignal.publicationId,
      status: "DRAFT",
      title: `Client note draft: ${firstSignal.publicationTitle}`,
      audience: "Matter team and relationship partner",
      disclaimerProfile: "internal_review",
      body: buildClientBriefBody({
        matter,
        publication: mockPublications.find((publication) => publication.id === firstSignal.publicationId) ?? mockPublications[0],
        signal: firstSignal,
      }),
      reviewerName: null,
      approvedAt: null,
      createdAt: "2026-05-29T08:00:00.000Z",
    },
  ];
}

function demoKnowledgeAssetsForMatter(matter: MatterProfile): KnowledgeAssetView[] {
  return [
    {
      id: `asset-${matter.id}`,
      matterId: matter.id,
      publicationId: null,
      kind: matter.matterType === "TRANSACTION_DILIGENCE" ? "DILIGENCE_INSERT" : "CHECKLIST",
      status: "DRAFT",
      visibility: "FIRM_INTERNAL",
      title: `${matter.title} working checklist`,
      summary: "Reusable internal checklist generated from matter taxonomy, source provenance and current regulatory signals.",
      regulationFamilies: matter.regulationFamilies,
      topicPaths: matter.topicPaths,
    },
  ];
}

function demoEthicalWallsForMatter(matter: MatterProfile): EthicalWallView[] {
  return matter.accessPolicy === "RESTRICTED"
    ? [
        {
          id: `wall-${matter.id}`,
          matterId: matter.id,
          name: "Restricted implementation matter team",
          accessPolicy: "RESTRICTED",
          allowedUserIds: [],
          restrictedUserIds: [],
          notes: "Restrict client-sensitive implementation notes to the matter team.",
        },
      ]
    : [];
}

function demoOpportunitiesForMatter(matter: MatterProfile): CommercialOpportunityView[] {
  const firstSignal = createMatterSignals(matter)[0];
  return [
    {
      id: `opp-${matter.id}`,
      clientId: matter.clientId,
      matterId: matter.id,
      publicationId: firstSignal?.publicationId ?? null,
      serviceOfferingId:
        matter.matterType === "IMPLEMENTATION"
          ? "gc_dora_register"
          : matter.matterType === "AUTHORISATION"
            ? "gc_micar_authorisation"
            : "gc_regulatory_strategy_retainer",
      stage: "IDENTIFIED",
      title: `Follow-on package: ${matter.title}`,
      rationale: "The matter has a current regulatory signal and a mapped fixed-fee service route.",
      nextAction: "Relationship partner reviews the proposed package and decides whether to raise it in the next client call.",
      ownerName: matter.relationshipPartnerName,
      estimatedValueEur: matter.matterType === "TRANSACTION_DILIGENCE" ? "45000" : "18000",
    },
  ];
}

function matterProfileToView(matter: MatterProfile): FirmMatterView {
  return {
    ...matter,
    practiceGroupId: matter.practiceGroupId,
    practiceGroupName: matter.practiceGroupName,
    openedAt: matter.openedAt,
    notes: matter.notes,
    signals: createMatterSignals(matter),
    clientBriefs: demoBriefsForMatter(matter),
    knowledgeAssets: demoKnowledgeAssetsForMatter(matter),
    ethicalWalls: demoEthicalWallsForMatter(matter),
    opportunities: demoOpportunitiesForMatter(matter),
  };
}

export const demoPlaybooks: RegulatoryPlaybookView[] = [
  {
    id: "playbook-global-diligence",
    practiceGroupId: "pg-global-transactions",
    firmProfile: "GLOBAL_ELITE",
    name: "Digital asset acquisition diligence pack",
    description: "Routes high-impact crypto, payments and DORA items into diligence reports and investment committee memos.",
    triggerRegulationFamilies: ["micar", "dora", "psd"],
    triggerTopics: ["digital_assets_specific.white_paper_review", "ict_and_resilience.third_party_arrangements"],
    triggerLicenceTypes: ["casp_micar", "payment_institution_psd", "emi_emd"],
    workflowSteps: [
      "Attach publication to the transaction matter.",
      "Draft diligence insert.",
      "Flag covenant or condition precedent issue.",
      "Partner approves client-ready language.",
    ],
    outputTemplates: ["Diligence insert", "Investment committee risk note", "Portfolio company action email"],
    isActive: true,
  },
  {
    id: "playbook-casp-zag",
    practiceGroupId: "pg-fintech-dlt",
    firmProfile: "TECH_BOUTIQUE",
    name: "CASP plus payment services authorisation tracker",
    description: "Keeps MiCAR, ZAG and token offering signals aligned with startup authorisation workstreams.",
    triggerRegulationFamilies: ["micar", "psd"],
    triggerTopics: ["authorisation_and_passporting.initial_authorisation", "digital_assets_specific.white_paper_review"],
    triggerLicenceTypes: ["casp_micar", "payment_institution_psd"],
    workflowSteps: [
      "Update filing checklist.",
      "Draft founder-facing next-step note.",
      "Add authority-dialogue issue where needed.",
      "Partner approves client portal item.",
    ],
    outputTemplates: ["Founder note", "Authorisation checklist update", "Authority dialogue agenda"],
    isActive: true,
  },
  {
    id: "playbook-dora-outsourcing",
    practiceGroupId: "pg-payments-implementation",
    firmProfile: "FINTECH_SPECIALIST",
    name: "DORA and outsourcing implementation action register",
    description: "Turns DORA and BaFin implementation signals into operational action registers.",
    triggerRegulationFamilies: ["dora", "psd"],
    triggerTopics: ["ict_and_resilience.ict_risk_management", "ict_and_resilience.third_party_arrangements"],
    triggerLicenceTypes: ["emi_emd", "payment_institution_psd", "casp_micar"],
    workflowSteps: [
      "Update action register.",
      "Check outsourcing evidence.",
      "Prepare management body note.",
      "Store reusable implementation precedent.",
    ],
    outputTemplates: ["DORA action register", "Management body note", "Outsourcing evidence checklist"],
    isActive: true,
  },
];

type BriefPublication = Pick<PublicationListItem, "id" | "title" | "sourceCode" | "sourceName" | "sourceUrl" | "rawHash">;

export function buildClientBriefBody(input: {
  matter: Pick<FirmMatterView, "title" | "clientName" | "relationshipPartnerName" | "responsibleAssociateName">;
  publication: BriefPublication;
  signal: Pick<MatterSignalView, "relevanceScore" | "relevanceBucket" | "rationale" | "suggestedAction">;
}) {
  return [
    `Matter: ${input.matter.title}`,
    `Client: ${input.matter.clientName}`,
    `Publication: ${input.publication.title}`,
    `Source: ${input.publication.sourceName} (${input.publication.sourceUrl})`,
    "",
    `Why it matters: ${input.signal.rationale}`,
    `Matter relevance: ${input.signal.relevanceBucket} (${input.signal.relevanceScore}/100)`,
    "",
    `Draft action: ${input.signal.suggestedAction}`,
    "",
    `Responsible team: ${input.matter.relationshipPartnerName}; ${input.matter.responsibleAssociateName}`,
    "",
    "Status: internal draft for law-firm review. Client-facing use requires partner approval.",
  ].join("\n");
}

export function getLawFirmImplementationPlan() {
  return implementationPlan;
}

export function buildDemoLawFirmWorkbench(): LawFirmWorkbenchView {
  const matters = demoMatterProfiles.map(matterProfileToView);
  const opportunities = matters.flatMap((matter) => matter.opportunities);
  const knowledgeAssets = matters.flatMap((matter) => matter.knowledgeAssets);
  const draftBriefs = matters.flatMap((matter) => matter.clientBriefs).filter((brief) => brief.status === "DRAFT");
  const highRelevanceSignals = matters.flatMap((matter) => matter.signals).filter((signal) =>
    ["CRITICAL", "HIGH"].includes(signal.relevanceBucket),
  );
  const estimatedPipelineEur = opportunities.reduce(
    (sum, opportunity) => sum + Number(opportunity.estimatedValueEur ?? 0),
    0,
  );

  return {
    firmOrganisationId: DEMO_FIRM_ORG_ID,
    firmName: "Law firm mode pilot",
    generatedAt: new Date().toISOString(),
    metrics: {
      clients: demoClients.length,
      openMatters: matters.filter((matter) => matter.status !== "CLOSED").length,
      highRelevanceSignals: highRelevanceSignals.length,
      draftBriefs: draftBriefs.length,
      clientReadyBriefs: 0,
      activePlaybooks: demoPlaybooks.filter((playbook) => playbook.isActive).length,
      identifiedOpportunities: opportunities.filter((opportunity) => opportunity.stage === "IDENTIFIED").length,
      estimatedPipelineEur,
    },
    clients: demoClients,
    practiceGroups: demoPracticeGroups,
    matters,
    playbooks: demoPlaybooks,
    opportunities,
    knowledgeAssets,
    plan: implementationPlan,
  };
}

type DbMatter = Prisma.FirmMatterGetPayload<{
  include: {
    client: true;
    practiceGroup: true;
    publications: {
      include: {
        publication: {
          include: { source: true };
        };
      };
      orderBy: { relevanceScore: "desc" };
    };
    clientBriefs: {
      orderBy: { createdAt: "desc" };
    };
    knowledgeAssets: {
      orderBy: { createdAt: "desc" };
    };
    ethicalWalls: true;
    commercialOpportunities: {
      orderBy: { createdAt: "desc" };
    };
  };
}>;

function mapDbMatter(matter: DbMatter): FirmMatterView {
  return {
    id: matter.id,
    firmOrganisationId: matter.firmOrganisationId,
    clientId: matter.clientId,
    clientName: matter.client.displayName,
    practiceGroupId: matter.practiceGroupId,
    practiceGroupName: matter.practiceGroup?.name ?? null,
    matterCode: matter.matterCode,
    title: matter.title,
    matterType: matter.matterType,
    status: matter.status,
    sensitivity: matter.sensitivity,
    accessPolicy: matter.accessPolicy,
    relationshipPartnerName: matter.relationshipPartnerName,
    responsibleAssociateName: matter.responsibleAssociateName,
    jurisdictionTags: matter.jurisdictionTags,
    regulationFamilies: matter.regulationFamilies,
    activities: matter.activities,
    licenceTypes: matter.licenceTypes,
    topicPaths: matter.topicPaths,
    openedAt: matter.openedAt.toISOString(),
    notes: matter.notes,
    signals: matter.publications.map((signal) => ({
      id: signal.id,
      publicationId: signal.publicationId,
      publicationTitle: signal.publication.title,
      sourceCode: signal.publication.source.code,
      publicationType: signal.publication.publicationType,
      relevanceScore: signal.relevanceScore,
      relevanceBucket: signal.relevanceBucket,
      rationale: signal.rationale,
      suggestedAction: signal.suggestedAction,
      status: signal.status,
      sourceUrl: signal.publication.sourceUrl,
    })),
    clientBriefs: matter.clientBriefs.map((brief) => ({
      id: brief.id,
      matterId: brief.matterId,
      publicationId: brief.publicationId,
      status: brief.status,
      title: brief.title,
      audience: brief.audience,
      disclaimerProfile: brief.disclaimerProfile,
      body: brief.body,
      reviewerName: brief.reviewerName,
      approvedAt: brief.approvedAt?.toISOString() ?? null,
      createdAt: brief.createdAt.toISOString(),
    })),
    knowledgeAssets: matter.knowledgeAssets.map((asset) => ({
      id: asset.id,
      matterId: asset.matterId,
      publicationId: asset.publicationId,
      kind: asset.kind,
      status: asset.status,
      visibility: asset.visibility,
      title: asset.title,
      summary: asset.summary,
      regulationFamilies: asset.regulationFamilies,
      topicPaths: asset.topicPaths,
    })),
    ethicalWalls: matter.ethicalWalls.map((wall) => ({
      id: wall.id,
      matterId: wall.matterId,
      name: wall.name,
      accessPolicy: wall.accessPolicy,
      allowedUserIds: wall.allowedUserIds,
      restrictedUserIds: wall.restrictedUserIds,
      notes: wall.notes,
    })),
    opportunities: matter.commercialOpportunities.map((opportunity) => ({
      id: opportunity.id,
      clientId: opportunity.clientId,
      matterId: opportunity.matterId,
      publicationId: opportunity.publicationId,
      serviceOfferingId: opportunity.serviceOfferingId,
      stage: opportunity.stage,
      title: opportunity.title,
      rationale: opportunity.rationale,
      nextAction: opportunity.nextAction,
      ownerName: opportunity.ownerName,
      estimatedValueEur: formatEur(opportunity.estimatedValueEur),
    })),
  };
}

async function resolveLawFirmOrganisationId(preferredOrganisationId?: string | null) {
  const prisma = getPrisma();
  if (preferredOrganisationId) {
    const organisation = await prisma.organisation.findUnique({
      where: { id: preferredOrganisationId },
      select: { id: true, tenantKind: true },
    });
    if (organisation?.tenantKind === "LAW_FIRM") return organisation.id;
  }
  const firm = await prisma.organisation.findFirst({
    where: { tenantKind: "LAW_FIRM" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return firm?.id ?? preferredOrganisationId ?? null;
}

export async function listLawFirmWorkbench(organisationId?: string | null): Promise<LawFirmWorkbenchView> {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return buildDemoLawFirmWorkbench();
  }

  const firmOrganisationId = await resolveLawFirmOrganisationId(organisationId);
  if (!firmOrganisationId) return buildDemoLawFirmWorkbench();

  const prisma = getPrisma();
  const [firm, clients, practiceGroups, matters, playbooks, opportunities, knowledgeAssets] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: firmOrganisationId } }),
    prisma.lawFirmClient.findMany({
      where: { firmOrganisationId },
      include: { _count: { select: { matters: true } } },
      orderBy: { displayName: "asc" },
    }),
    prisma.practiceGroup.findMany({ where: { firmOrganisationId }, orderBy: { name: "asc" } }),
    prisma.firmMatter.findMany({
      where: { firmOrganisationId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        client: true,
        practiceGroup: true,
        publications: { include: { publication: { include: { source: true } } }, orderBy: { relevanceScore: "desc" } },
        clientBriefs: { orderBy: { createdAt: "desc" } },
        knowledgeAssets: { orderBy: { createdAt: "desc" } },
        ethicalWalls: true,
        commercialOpportunities: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.regulatoryPlaybook.findMany({ where: { firmOrganisationId }, orderBy: { name: "asc" } }),
    prisma.commercialOpportunity.findMany({ where: { firmOrganisationId }, orderBy: { createdAt: "desc" } }),
    prisma.knowledgeAsset.findMany({ where: { firmOrganisationId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const matterViews = matters.map(mapDbMatter);
  const highRelevanceSignals = matterViews.flatMap((matter) => matter.signals).filter((signal) =>
    ["CRITICAL", "HIGH"].includes(signal.relevanceBucket),
  );
  const draftBriefs = matterViews.flatMap((matter) => matter.clientBriefs).filter((brief) => brief.status === "DRAFT");
  const clientReadyBriefs = matterViews.flatMap((matter) => matter.clientBriefs).filter((brief) => brief.status === "CLIENT_READY");

  return {
    firmOrganisationId,
    firmName: firm?.name ?? "Law firm mode",
    generatedAt: new Date().toISOString(),
    metrics: {
      clients: clients.length,
      openMatters: matterViews.filter((matter) => matter.status !== "CLOSED").length,
      highRelevanceSignals: highRelevanceSignals.length,
      draftBriefs: draftBriefs.length,
      clientReadyBriefs: clientReadyBriefs.length,
      activePlaybooks: playbooks.filter((playbook) => playbook.isActive).length,
      identifiedOpportunities: opportunities.filter((opportunity) => opportunity.stage === "IDENTIFIED").length,
      estimatedPipelineEur: opportunities.reduce(
        (sum, opportunity) => sum + Number(opportunity.estimatedValueEur ?? 0),
        0,
      ),
    },
    clients: clients.map((client) => ({
      id: client.id,
      displayName: client.displayName,
      legalName: client.legalName,
      sector: client.sector,
      relationshipPartnerName: client.relationshipPartnerName,
      responsibleAssociateName: client.responsibleAssociateName,
      confidentialityLevel: client.confidentialityLevel,
      defaultAccessPolicy: client.defaultAccessPolicy,
      matterCount: client._count.matters,
    })),
    practiceGroups: practiceGroups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      focusDescription: group.focusDescription,
      leadPartnerName: group.leadPartnerName,
    })),
    matters: matterViews,
    playbooks: playbooks.map((playbook) => ({
      id: playbook.id,
      practiceGroupId: playbook.practiceGroupId,
      firmProfile: playbook.firmProfile,
      name: playbook.name,
      description: playbook.description,
      triggerRegulationFamilies: playbook.triggerRegulationFamilies,
      triggerTopics: playbook.triggerTopics,
      triggerLicenceTypes: playbook.triggerLicenceTypes,
      workflowSteps: playbook.workflowSteps,
      outputTemplates: playbook.outputTemplates,
      isActive: playbook.isActive,
    })),
    opportunities: opportunities.map((opportunity) => ({
      id: opportunity.id,
      clientId: opportunity.clientId,
      matterId: opportunity.matterId,
      publicationId: opportunity.publicationId,
      serviceOfferingId: opportunity.serviceOfferingId,
      stage: opportunity.stage,
      title: opportunity.title,
      rationale: opportunity.rationale,
      nextAction: opportunity.nextAction,
      ownerName: opportunity.ownerName,
      estimatedValueEur: formatEur(opportunity.estimatedValueEur),
    })),
    knowledgeAssets: knowledgeAssets.map((asset) => ({
      id: asset.id,
      matterId: asset.matterId,
      publicationId: asset.publicationId,
      kind: asset.kind,
      status: asset.status,
      visibility: asset.visibility,
      title: asset.title,
      summary: asset.summary,
      regulationFamilies: asset.regulationFamilies,
      topicPaths: asset.topicPaths,
    })),
    plan: implementationPlan,
  };
}

export async function getLawFirmMatter(matterId: string, organisationId?: string | null) {
  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    return buildDemoLawFirmWorkbench().matters.find((matter) => matter.id === matterId) ?? null;
  }

  const firmOrganisationId = await resolveLawFirmOrganisationId(organisationId);
  const matter = await getPrisma().firmMatter.findFirst({
    where: {
      id: matterId,
      firmOrganisationId: firmOrganisationId ?? undefined,
    },
    include: {
      client: true,
      practiceGroup: true,
      publications: { include: { publication: { include: { source: true } } }, orderBy: { relevanceScore: "desc" } },
      clientBriefs: { orderBy: { createdAt: "desc" } },
      knowledgeAssets: { orderBy: { createdAt: "desc" } },
      ethicalWalls: true,
      commercialOpportunities: { orderBy: { createdAt: "desc" } },
    },
  });

  return matter ? mapDbMatter(matter) : null;
}

function sourceProvenance(publication: BriefPublication, signal: MatterSignalView) {
  return {
    publicationId: publication.id,
    title: publication.title,
    sourceUrl: publication.sourceUrl,
    sourceCode: publication.sourceCode,
    rawHash: publication.rawHash,
    relevanceScore: signal.relevanceScore,
    relevanceBucket: signal.relevanceBucket,
    generatedFrom: "law-firm-brief-draft-v1",
  };
}

export async function createClientBriefDraft(input: {
  matterId: string;
  publicationId?: string | null;
  reviewerName?: string | null;
  organisationId?: string | null;
}) {
  const operator = await requireInternalOperator();
  const reviewerName = getReviewerName(operator, input.reviewerName ?? undefined);

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    await writeAuditLog({
      action: "law_firm.brief.generate",
      entityType: "firm_matter",
      entityId: input.matterId,
      actorUserId: operator.userId,
      organisationId: operator.organisationId,
      payloadJson: { mode: "demo", reviewerName },
    });
    return { ok: true, mode: "demo" as const, briefId: `brief-${input.matterId}` };
  }

  const matter = await getLawFirmMatter(input.matterId, input.organisationId);
  if (!matter) throw new Error("Matter was not found.");
  const signal =
    matter.signals.find((item) => item.publicationId === input.publicationId) ??
    matter.signals[0];
  if (!signal) throw new Error("Matter has no publication signal to brief.");
  const dbPublication = await getPrisma().publication.findUnique({
    where: { id: signal.publicationId },
    include: { source: true },
  });
  const publication =
    dbPublication
      ? {
          id: dbPublication.id,
          title: dbPublication.title,
          sourceCode: dbPublication.source.code,
          sourceName: dbPublication.source.displayName,
          sourceUrl: dbPublication.sourceUrl,
          rawHash: dbPublication.rawHash,
        }
      : mockPublications.find((item) => item.id === signal.publicationId);
  if (!publication) {
    throw new Error("Brief drafting requires a publication record for the selected signal.");
  }

  const brief = await getPrisma().clientBrief.create({
    data: {
      firmOrganisationId: matter.firmOrganisationId,
      matterId: matter.id,
      publicationId: signal.publicationId,
      status: "DRAFT",
      title: `Client note draft: ${publication.title}`,
      audience: "Matter team and relationship partner",
      disclaimerProfile: "internal_review",
      body: buildClientBriefBody({ matter, publication, signal }),
      sourceProvenanceJson: sourceProvenance(publication, signal) as Prisma.InputJsonValue,
      reviewerName,
    },
  });

  await writeAuditLog({
    action: "law_firm.brief.generate",
    entityType: "client_brief",
    entityId: brief.id,
    actorUserId: operator.userId,
    organisationId: matter.firmOrganisationId,
    payloadJson: { matterId: matter.id, publicationId: signal.publicationId, reviewerName },
  });

  return { ok: true, mode: "database" as const, briefId: brief.id };
}

export async function advanceClientBrief(input: {
  briefId: string;
  status: ClientBriefStatus;
  reviewerName?: string | null;
  organisationId?: string | null;
}) {
  const operator = await requireInternalOperator();
  const reviewerName = getReviewerName(operator, input.reviewerName ?? undefined);

  if (!hasDatabaseUrl()) {
    assertDemoModeAllowed();
    await writeAuditLog({
      action: "law_firm.brief.advance",
      entityType: "client_brief",
      entityId: input.briefId,
      actorUserId: operator.userId,
      organisationId: operator.organisationId,
      payloadJson: { mode: "demo", status: input.status, reviewerName },
    });
    return { ok: true, mode: "demo" as const };
  }

  const brief = await getPrisma().clientBrief.update({
    where: { id: input.briefId },
    data: {
      status: input.status,
      reviewerName,
      approvedAt: input.status === "CLIENT_READY" ? new Date() : null,
      approvedById: input.status === "CLIENT_READY" ? operator.userId : null,
    },
  });

  await writeAuditLog({
    action: "law_firm.brief.advance",
    entityType: "client_brief",
    entityId: brief.id,
    actorUserId: operator.userId,
    organisationId: brief.firmOrganisationId,
    payloadJson: { status: input.status, reviewerName },
  });

  return { ok: true, mode: "database" as const };
}
