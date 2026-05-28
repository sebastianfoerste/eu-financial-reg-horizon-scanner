import type { ReviewQueueView } from "@/lib/review";

export type ReviewReadinessStatus = "PASS" | "WARN" | "BLOCK";

export type ReviewReadinessCheck = {
  key: string;
  label: string;
  status: ReviewReadinessStatus;
  detail: string;
};

const approvedStatuses = new Set(["APPROVED"]);
const closedStatuses = new Set(["FALSE_POSITIVE", "ARCHIVED"]);
const placeholderSignals = [
  "pending",
  "not run",
  "not produced",
  "no change summary",
  "review the source publication",
  "affected actor mapping is pending",
  "classification has not run",
];

function hasSubstantiveText(value: string) {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !placeholderSignals.some((signal) => normalized.includes(signal));
}

function check(
  key: string,
  label: string,
  status: ReviewReadinessStatus,
  detail: string,
): ReviewReadinessCheck {
  return { key, label, status, detail };
}

export function summarizeReviewReadiness(item: Pick<ReviewQueueView, "status" | "publication">) {
  const { publication } = item;
  const taxonomyTagCount = [
    ...publication.tags.regulationFamilies,
    ...publication.tags.activities,
    ...publication.tags.licenceTypes,
    ...publication.tags.topicPaths,
    ...publication.tags.jurisdictions,
  ].length;
  const narrativeReady =
    hasSubstantiveText(publication.summary) &&
    hasSubstantiveText(publication.whatChanged) &&
    hasSubstantiveText(publication.whoIsAffected) &&
    hasSubstantiveText(publication.recommendedAction);

  const checks: ReviewReadinessCheck[] = [
    approvedStatuses.has(item.status)
      ? check("decision", "Review decision", "PASS", "Approved by human reviewer.")
      : closedStatuses.has(item.status)
        ? check("decision", "Review decision", "BLOCK", `Item is ${item.status.toLowerCase().replaceAll("_", " ")}.`)
        : check("decision", "Review decision", "BLOCK", `Current status is ${item.status.toLowerCase().replaceAll("_", " ")}.`),
    publication.classifierError
      ? check("classifier", "Classifier status", "BLOCK", publication.classifierError)
      : check("classifier", "Classifier status", "PASS", `${publication.classifierStatus} classification is available.`),
    publication.taxonomyVersion === "unclassified"
      ? check("taxonomy", "Taxonomy version", "BLOCK", "No taxonomy version is stored.")
      : check("taxonomy", "Taxonomy version", "PASS", `Taxonomy ${publication.taxonomyVersion}.`),
    publication.confidence >= 0.65
      ? check("confidence", "Confidence", "PASS", `${Math.round(publication.confidence * 100)}% confidence.`)
      : check("confidence", "Confidence", "WARN", `${Math.round(publication.confidence * 100)}% confidence needs closer review.`),
    taxonomyTagCount > 0
      ? check("coverage", "Taxonomy coverage", "PASS", `${taxonomyTagCount} taxonomy tags stored.`)
      : check("coverage", "Taxonomy coverage", "BLOCK", "No taxonomy tags are stored."),
    publication.serviceOfferingIds.length > 0
      ? check("services", "Service routing", "PASS", `${publication.serviceOfferingIds.length} service offering matched.`)
      : check("services", "Service routing", "WARN", "No fixed-fee service offering is routed."),
    publication.impactBucket !== "NONE"
      ? check("impact", "Impact score", "PASS", `${publication.impactBucket} at ${publication.impactScore}/100.`)
      : check("impact", "Impact score", "WARN", "No impact bucket above none is stored."),
    narrativeReady
      ? check("narrative", "Reviewer narrative", "PASS", "Summary, change, actor and action fields are filled.")
      : check("narrative", "Reviewer narrative", "WARN", "One or more reviewer narrative fields still look provisional."),
  ];

  const blockingCount = checks.filter((item) => item.status === "BLOCK").length;
  const warningCount = checks.filter((item) => item.status === "WARN").length;

  return {
    checks,
    blockingCount,
    warningCount,
    readyForAlertDraft: blockingCount === 0,
  };
}
