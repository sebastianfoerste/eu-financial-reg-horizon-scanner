import { loadScoringRules } from "@/lib/scoring-rules";
import type { ClassificationVector } from "@/lib/service-offerings";

export type ScoreExplanationItem = {
  label: string;
  value: string;
  points: number;
  matched: boolean;
};

export function buildScoreExplanation(input: {
  publicationType: string;
  classification: ClassificationVector;
  matchedLicences?: string[];
  matchedActivities?: string[];
  matchedJurisdictions?: string[];
  matchedHomeJurisdictions?: string[];
  matchedPassportJurisdictions?: string[];
  matchedTopics?: string[];
  criticalProductLineMatched?: boolean;
  floorAdjustment?: number;
}) {
  const rules = loadScoringRules();
  const floor = rules.publication_type_floor[input.publicationType] ?? 0;
  const matchedLicences = input.matchedLicences ?? [];
  const matchedActivities = input.matchedActivities ?? [];
  const matchedJurisdictions = input.matchedJurisdictions ?? [];
  const matchedHomeJurisdictions = input.matchedHomeJurisdictions ?? [];
  const matchedPassportJurisdictions = input.matchedPassportJurisdictions ?? [];
  const matchedTopics = input.matchedTopics ?? [];
  const floorAdjustment = input.floorAdjustment ?? 0;
  const jurisdictionPoints =
    (matchedHomeJurisdictions.length ? rules.weights.jurisdiction_home_match : 0) +
    (matchedPassportJurisdictions.length ? rules.weights.jurisdiction_passported_match : 0);

  const items: ScoreExplanationItem[] = [
    {
      label: "Licence match",
      value: matchedLicences.join(", ") || "No direct licence match",
      points: matchedLicences.length ? rules.weights.licence_match : 0,
      matched: matchedLicences.length > 0,
    },
    {
      label: "Activity overlap",
      value: matchedActivities.join(", ") || "No activity overlap",
      points: matchedActivities.length ? rules.weights.activity_overlap : 0,
      matched: matchedActivities.length > 0,
    },
    {
      label: "Jurisdiction match",
      value: matchedJurisdictions.join(", ") || "No jurisdiction overlap",
      points: jurisdictionPoints,
      matched: matchedJurisdictions.length > 0,
    },
    {
      label: "Watchlist topic",
      value: matchedTopics.join(", ") || "No watchlist topic",
      points: matchedTopics.length ? rules.weights.topic_watchlist_match : 0,
      matched: matchedTopics.length > 0,
    },
    {
      label: "Critical product line",
      value: input.criticalProductLineMatched ? "Critical line affected" : "No critical line match",
      points: input.criticalProductLineMatched ? rules.weights.critical_product_line_bonus : 0,
      matched: Boolean(input.criticalProductLineMatched),
    },
    {
      label: "Publication-type floor",
      value: floorAdjustment ? `${input.publicationType} floor ${floor} applied` : `No uplift for ${input.publicationType}`,
      points: floorAdjustment,
      matched: floorAdjustment > 0,
    },
  ];

  return {
    ruleVersion: rules.version,
    items,
  };
}
