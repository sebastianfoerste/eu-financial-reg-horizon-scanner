export type SourceAuthorityLevel =
  | "binding_law"
  | "delegated_or_implementing_act"
  | "supervisory_material"
  | "court_decision"
  | "legal_commentary"
  | "industry_material"
  | "internal_policy";

export type SourceVerificationStatus =
  | "unverified"
  | "requires_review"
  | "verified_current"
  | "stale"
  | "context_only"
  | "market_context";

export type SourceHierarchyInput = {
  authorityLevel: SourceAuthorityLevel;
  retrievedAt?: string | null;
  reviewedAt?: string | null;
  superseded?: boolean;
};

export type SourceHierarchyAssessment = {
  status: SourceVerificationStatus;
  blocksExternalAlert: boolean;
  requiresPrimarySource: boolean;
  detail: string;
};

const PRIMARY_LEVELS: SourceAuthorityLevel[] = [
  "binding_law",
  "delegated_or_implementing_act",
  "supervisory_material",
  "court_decision",
];

const STALE_AFTER_DAYS = 45;

const OFFICIAL_SOURCE_AUTHORITY: Record<string, SourceAuthorityLevel> = {
  eurlex: "binding_law",
  esma: "supervisory_material",
  esma_qna: "supervisory_material",
  eba: "supervisory_material",
  eba_qna: "supervisory_material",
  bafin: "supervisory_material",
  bundesbank: "supervisory_material",
  ecb: "supervisory_material",
};

export function inferSourceAuthorityLevel(sourceCode: string): SourceAuthorityLevel {
  return OFFICIAL_SOURCE_AUTHORITY[sourceCode.toLowerCase()] ?? "legal_commentary";
}

export function assessSourceHierarchy(
  source: SourceHierarchyInput,
  now = new Date(),
): SourceHierarchyAssessment {
  if (source.superseded) {
    return {
      status: "stale",
      blocksExternalAlert: true,
      requiresPrimarySource: isPrimaryLevel(source.authorityLevel),
      detail: "Source is marked superseded and requires reviewer refresh.",
    };
  }

  if (source.authorityLevel === "legal_commentary") {
    return {
      status: "context_only",
      blocksExternalAlert: true,
      requiresPrimarySource: true,
      detail: "Legal commentary can support context but cannot carry an external alert alone.",
    };
  }

  if (source.authorityLevel === "industry_material") {
    return {
      status: "market_context",
      blocksExternalAlert: true,
      requiresPrimarySource: true,
      detail: "Industry material is market context and needs a primary or supervisory source.",
    };
  }

  if (!source.reviewedAt) {
    return {
      status: "requires_review",
      blocksExternalAlert: true,
      requiresPrimarySource: isPrimaryLevel(source.authorityLevel),
      detail: "Source has not been reviewed by an operator.",
    };
  }

  const reviewedAt = new Date(source.reviewedAt);
  const ageMs = Math.max(0, now.getTime() - reviewedAt.getTime());
  if (ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) {
    return {
      status: "stale",
      blocksExternalAlert: true,
      requiresPrimarySource: isPrimaryLevel(source.authorityLevel),
      detail: `Source review is older than ${STALE_AFTER_DAYS} days.`,
    };
  }

  return {
    status: "verified_current",
    blocksExternalAlert: false,
    requiresPrimarySource: false,
    detail: "Source is reviewed and current for scanner drafting.",
  };
}

function isPrimaryLevel(level: SourceAuthorityLevel) {
  return PRIMARY_LEVELS.includes(level);
}
