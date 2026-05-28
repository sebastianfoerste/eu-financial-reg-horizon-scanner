import type { ImpactBucket } from "@prisma/client";

import { loadScoringRules } from "@/lib/scoring-rules";
import type { ClassificationVector } from "@/lib/service-offerings";

export type ProductMapFootprint = {
  id: string;
  organisationId: string;
  name: string;
  licences: Array<{
    id?: string;
    licenceType: string;
    issuingAuthority: string;
    licenceReference?: string | null;
    status: string;
  }>;
  productLines: Array<{
    id?: string;
    name: string;
    activities: string[];
    customerSegment?: string[];
    isCritical: boolean;
  }>;
  jurisdictions: Array<{
    id?: string;
    jurisdictionCode: string;
    authority?: string | null;
    isHomeMember: boolean;
    isPassportedInto: boolean;
  }>;
  topicWatchlist: string[];
};

export type ImpactScoringInput = {
  publicationType: string;
  classification: ClassificationVector;
  productMap: ProductMapFootprint;
};

export type ImpactScoringResult = {
  score: number;
  bucket: ImpactBucket;
  rationale: string;
  matchedLicences: string[];
  matchedActivities: string[];
  matchedJurisdictions: string[];
  matchedHomeJurisdictions: string[];
  matchedPassportJurisdictions: string[];
  matchedTopics: string[];
  criticalProductLineMatched: boolean;
  rawScore: number;
  floorAdjustment: number;
  ruleVersion: string;
};

function intersect(left: string[], right: string[]) {
  return [...new Set(left.filter((value) => right.includes(value)))];
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function bucketForScore(score: number): ImpactBucket {
  const rules = loadScoringRules();
  if (score >= rules.buckets.critical) return "CRITICAL";
  if (score >= rules.buckets.high) return "HIGH";
  if (score >= rules.buckets.medium) return "MEDIUM";
  if (score >= rules.buckets.low) return "LOW";
  return "NONE";
}

export function scorePublicationForProductMap(input: ImpactScoringInput): ImpactScoringResult {
  const rules = loadScoringRules();
  const productLicenceTypes = input.productMap.licences
    .filter((licence) => licence.status !== "WITHDRAWN" && licence.status !== "LAPSED")
    .map((licence) => licence.licenceType);
  const productActivities = input.productMap.productLines.flatMap((line) => line.activities);
  const homeJurisdictions = input.productMap.jurisdictions
    .filter((jurisdiction) => jurisdiction.isHomeMember)
    .flatMap((jurisdiction) => [jurisdiction.jurisdictionCode, jurisdiction.authority].filter(Boolean) as string[]);
  const passportJurisdictions = input.productMap.jurisdictions
    .filter((jurisdiction) => jurisdiction.isPassportedInto)
    .flatMap((jurisdiction) => [jurisdiction.jurisdictionCode, jurisdiction.authority].filter(Boolean) as string[]);
  const criticalActivities = input.productMap.productLines
    .filter((line) => line.isCritical)
    .flatMap((line) => line.activities);
  const matchedLicences = intersect(input.classification.licenceTypes, productLicenceTypes);
  const matchedActivities = intersect(input.classification.activities, productActivities);
  const matchedHomeJurisdictions = intersect(input.classification.jurisdictions, homeJurisdictions);
  const matchedPassportJurisdictions = intersect(input.classification.jurisdictions, passportJurisdictions);
  const matchedJurisdictions = [...new Set([...matchedHomeJurisdictions, ...matchedPassportJurisdictions])];
  const matchedTopics = intersect(input.classification.topicPaths, input.productMap.topicWatchlist);
  const matchedCriticalActivities = intersect(input.classification.activities, criticalActivities);

  let rawScore = 0;
  if (matchedLicences.length) rawScore += rules.weights.licence_match;
  if (matchedActivities.length) rawScore += rules.weights.activity_overlap;
  if (matchedHomeJurisdictions.length) rawScore += rules.weights.jurisdiction_home_match;
  if (matchedPassportJurisdictions.length) rawScore += rules.weights.jurisdiction_passported_match;
  if (matchedTopics.length) rawScore += rules.weights.topic_watchlist_match;
  if (matchedCriticalActivities.length) rawScore += rules.weights.critical_product_line_bonus;

  const floor = rules.publication_type_floor[input.publicationType] ?? 0;
  const floorAdjustment =
    (matchedLicences.length || matchedActivities.length) && rawScore < floor ? floor - rawScore : 0;

  const clamped = clampScore(rawScore + floorAdjustment);
  const reasons = [
    matchedLicences.length ? `licence match: ${matchedLicences.join(", ")}` : null,
    matchedActivities.length ? `activity overlap: ${matchedActivities.join(", ")}` : null,
    matchedJurisdictions.length ? `jurisdiction overlap: ${matchedJurisdictions.join(", ")}` : null,
    matchedTopics.length ? `watchlist topic: ${matchedTopics.join(", ")}` : null,
    matchedCriticalActivities.length ? "critical product line affected" : null,
  ].filter(Boolean);

  return {
    score: clamped,
    bucket: bucketForScore(clamped),
    rationale: reasons.length
      ? reasons.join("; ")
      : "No direct licence, activity, jurisdiction, or watchlist topic match.",
    matchedLicences,
    matchedActivities,
    matchedJurisdictions,
    matchedHomeJurisdictions,
    matchedPassportJurisdictions,
    matchedTopics,
    criticalProductLineMatched: matchedCriticalActivities.length > 0,
    rawScore,
    floorAdjustment,
    ruleVersion: rules.version,
  };
}
