"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import {
  assertOrganisationAccess,
  getActiveOrganisationId,
  getReviewerName,
  requireOperator,
  type OperatorContext,
} from "@/lib/authz";
import { hasDatabaseUrl } from "@/lib/env";
import { recalculateImpactScores } from "@/lib/impact-recalculation";
import { getPrisma } from "@/lib/prisma";
import { nextProductMapConfirmationDate } from "@/lib/product-map-assurance";
import { loadScoringRules } from "@/lib/scoring-rules";
import { assertTaxonomyValue } from "@/lib/taxonomy";

const CustomerSegmentSchema = z.enum([
  "RETAIL",
  "PROFESSIONAL",
  "ELIGIBLE_COUNTERPARTY",
  "CORPORATE",
  "INSTITUTIONAL",
]);
const LicenceStatusSchema = z.enum(["ACTIVE", "APPLIED", "WITHDRAWN", "LAPSED"]);
const RequiredTextSchema = z.string().trim().min(1).max(180);
const OptionalTextSchema = z.string().trim().max(240);

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readRequired(formData: FormData, key: string) {
  return RequiredTextSchema.parse(readText(formData, key));
}

function readTaxonomyValues(
  formData: FormData,
  key: string,
  axis: "activity" | "topic",
) {
  const values = formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map((value) => assertTaxonomyValue(axis, value.trim()));
  return [...new Set(values)];
}

function redirectDemo(productMapId = "demo-product-map-casp"): never {
  redirect(`/product-maps/${productMapId}?demo=read-only`);
}

async function getAuthorisedProductMap(productMapId: string, operator: OperatorContext) {
  const productMap = await getPrisma().productMap.findUnique({
    where: { id: productMapId },
    select: { id: true, organisationId: true, topicWatchlist: true },
  });
  if (!productMap) throw new Error("Product map not found.");
  assertOrganisationAccess(operator, productMap.organisationId);
  return productMap;
}

async function completeFootprintMutation(input: {
  operator: OperatorContext;
  productMapId: string;
  organisationId: string;
  action: string;
  payloadJson?: Record<string, unknown>;
  invalidatesConfirmation?: boolean;
  invalidatesDrafts?: boolean;
}) {
  const prisma = getPrisma();
  let invalidatedDrafts = { count: 0 };
  if (input.invalidatesConfirmation) {
    await prisma.productMap.update({
      where: { id: input.productMapId },
      data: { confirmationRequired: true },
    });
    if (input.invalidatesDrafts) {
      invalidatedDrafts = await prisma.alert.updateMany({
        where: {
          organisationId: input.organisationId,
          status: { in: ["DRAFT", "APPROVED", "BLOCKED_BY_CONFIG", "FAILED"] },
        },
        data: {
          status: "SKIPPED",
          errorMessage: "Product map changed. Confirm the footprint and generate a new reviewed alert draft.",
        },
      });
    }
  }
  const scoring = await recalculateImpactScores(input.organisationId);
  if (input.invalidatesDrafts && !input.invalidatesConfirmation && scoring.scoresChanged > 0) {
    invalidatedDrafts = await prisma.alert.updateMany({
      where: {
        organisationId: input.organisationId,
        status: { in: ["DRAFT", "APPROVED", "BLOCKED_BY_CONFIG", "FAILED"] },
      },
      data: {
        status: "SKIPPED",
        errorMessage: "Product map changed. Confirm the footprint and generate a new reviewed alert draft.",
      },
    });
  }
  await writeAuditLog({
    action: input.action,
    entityType: "product_map",
    entityId: input.productMapId,
    actorUserId: input.operator.userId,
    organisationId: input.organisationId,
    payloadJson: {
      ...input.payloadJson,
      scoresWritten: scoring.scoresWritten,
      scoresChanged: scoring.scoresChanged,
      invalidatedDrafts: invalidatedDrafts.count,
      confirmationRequired: Boolean(input.invalidatesConfirmation),
    },
  });
  revalidatePath("/");
  revalidatePath("/product-maps");
  revalidatePath(`/product-maps/${input.productMapId}`);
  revalidatePath("/publications");
  revalidatePath("/review");
  revalidatePath("/digest");
  revalidatePath("/alerts");
}

export async function createProductMapAction(formData: FormData) {
  const operator = await requireOperator();

  if (!hasDatabaseUrl()) redirectDemo();

  const organisationName = readRequired(formData, "organisationName");
  const productMapName = readRequired(formData, "productMapName");
  const licenceType = assertTaxonomyValue("licence_type", readRequired(formData, "licenceType"));
  const issuingAuthority = readRequired(formData, "issuingAuthority");
  const productLineName = readRequired(formData, "productLineName");
  const selectedActivities = readTaxonomyValues(formData, "activities", "activity");
  const activities =
    selectedActivities.length > 0
      ? selectedActivities
      : [assertTaxonomyValue("activity", readRequired(formData, "activity"))];
  const jurisdictionCode = assertTaxonomyValue("jurisdiction", readRequired(formData, "jurisdictionCode").toLowerCase());
  const customerSegment = CustomerSegmentSchema.parse(readRequired(formData, "customerSegment"));
  const topicWatchlist = readTaxonomyValues(formData, "topicWatchlist", "topic");
  const isCritical = formData.get("isCritical") === "on";

  const prisma = getPrisma();
  const activeOrganisationId = operator.organisationId ?? (await getActiveOrganisationId());
  const organisation = activeOrganisationId
    ? await prisma.organisation.findUniqueOrThrow({ where: { id: activeOrganisationId } })
    : (await prisma.organisation.findFirst({ where: { name: organisationName } })) ??
      (await prisma.organisation.create({
        data: {
          name: organisationName,
          tier: "TRIAL",
        },
      }));
  assertOrganisationAccess(operator, organisation.id);

  const productMap = await prisma.productMap.create({
    data: {
      organisationId: organisation.id,
      name: productMapName,
      topicWatchlist: topicWatchlist.length ? topicWatchlist : loadScoringRules().topic_watchlist,
      notes: "Created from product-map intake.",
      licences: {
        create: {
          licenceType,
          issuingAuthority,
          status: "ACTIVE",
        },
      },
      productLines: {
        create: {
          name: productLineName,
          activities,
          customerSegment: [customerSegment],
          isCritical,
        },
      },
      jurisdictions: {
        create: {
          jurisdictionCode,
          authority: issuingAuthority,
          isHomeMember: true,
        },
      },
    },
  });

  await completeFootprintMutation({
    operator,
    productMapId: productMap.id,
    organisationId: organisation.id,
    action: "product_map.create",
    payloadJson: { licenceCount: 1, productLineCount: 1, jurisdictionCount: 1, topicWatchlistCount: productMap.topicWatchlist.length },
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMap.id}?created=1`);
}

export async function updateTopicWatchlistAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const topicWatchlist = readTaxonomyValues(formData, "topicWatchlist", "topic");
  if (JSON.stringify(productMap.topicWatchlist) === JSON.stringify(topicWatchlist)) {
    redirect(`/product-maps/${productMapId}?unchanged=watchlist`);
  }

  await getPrisma().productMap.update({
    where: { id: productMap.id },
    data: { topicWatchlist },
  });
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.watchlist.update",
    payloadJson: { topicWatchlistCount: topicWatchlist.length },
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?watchlist=updated`);
}

export async function recalculateProductMapAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);

  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.scores.recalculate",
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?scores=recalculated`);
}

export async function confirmProductMapAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const confirmedAt = new Date();
  const nextConfirmationDueAt = nextProductMapConfirmationDate(confirmedAt);
  const confirmedByName = getReviewerName(operator, readText(formData, "reviewerName"));

  await getPrisma().productMap.update({
    where: { id: productMapId },
    data: {
      confirmationRequired: false,
      lastConfirmedAt: confirmedAt,
      nextConfirmationDueAt,
      confirmedByName,
    },
  });
  await writeAuditLog({
    action: "product_map.confirm",
    entityType: "product_map",
    entityId: productMapId,
    actorUserId: operator.userId,
    organisationId: productMap.organisationId,
    payloadJson: { confirmedByName, nextConfirmationDueAt: nextConfirmationDueAt.toISOString() },
  });
  revalidatePath("/product-maps");
  revalidatePath(`/product-maps/${productMapId}`);
  revalidatePath("/alerts");
  redirect(`/product-maps/${productMapId}?confirmation=recorded`);
}

export async function addLicenceAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const licenceType = assertTaxonomyValue("licence_type", readRequired(formData, "licenceType"));

  await getPrisma().licence.create({
    data: {
      productMapId,
      licenceType,
      issuingAuthority: readRequired(formData, "issuingAuthority"),
      licenceReference: OptionalTextSchema.parse(readText(formData, "licenceReference")) || null,
      status: LicenceStatusSchema.parse(readRequired(formData, "status")),
    },
  });
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.licence.add",
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?licence=added`);
}

export async function removeLicenceAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const deleted = await getPrisma().licence.deleteMany({
    where: { id: readRequired(formData, "licenceId"), productMapId },
  });
  if (!deleted.count) throw new Error("Licence not found in this product map.");
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.licence.remove",
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?licence=removed`);
}

export async function addProductLineAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const activities = readTaxonomyValues(formData, "activities", "activity");
  if (!activities.length) throw new Error("At least one activity is required.");
  const customerSegments = formData
    .getAll("customerSegments")
    .filter((value): value is string => typeof value === "string")
    .map((value) => CustomerSegmentSchema.parse(value));
  if (!customerSegments.length) throw new Error("At least one customer segment is required.");

  await getPrisma().productLine.create({
    data: {
      productMapId,
      name: readRequired(formData, "name"),
      activities,
      customerSegment: [...new Set(customerSegments)],
      description: OptionalTextSchema.parse(readText(formData, "description")) || null,
      isCritical: formData.get("isCritical") === "on",
    },
  });
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.product_line.add",
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?productLine=added`);
}

export async function removeProductLineAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const deleted = await getPrisma().productLine.deleteMany({
    where: { id: readRequired(formData, "productLineId"), productMapId },
  });
  if (!deleted.count) throw new Error("Product line not found in this product map.");
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.product_line.remove",
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?productLine=removed`);
}

export async function upsertJurisdictionAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const jurisdictionCode = assertTaxonomyValue("jurisdiction", readRequired(formData, "jurisdictionCode").toLowerCase());
  const authority = OptionalTextSchema.parse(readText(formData, "authority")) || null;
  const facts = {
    authority,
    isHomeMember: formData.get("isHomeMember") === "on",
    isPassportedInto: formData.get("isPassportedInto") === "on",
  };
  const existing = await getPrisma().productMapJurisdiction.findUnique({
    where: { productMapId_jurisdictionCode: { productMapId, jurisdictionCode } },
    select: { authority: true, isHomeMember: true, isPassportedInto: true },
  });
  if (
    existing &&
    existing.authority === facts.authority &&
    existing.isHomeMember === facts.isHomeMember &&
    existing.isPassportedInto === facts.isPassportedInto
  ) {
    redirect(`/product-maps/${productMapId}?unchanged=jurisdiction`);
  }

  await getPrisma().productMapJurisdiction.upsert({
    where: { productMapId_jurisdictionCode: { productMapId, jurisdictionCode } },
    update: facts,
    create: { productMapId, jurisdictionCode, ...facts },
  });
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.jurisdiction.upsert",
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?jurisdiction=updated`);
}

export async function removeJurisdictionAction(formData: FormData) {
  const operator = await requireOperator();
  const productMapId = readRequired(formData, "productMapId");
  if (!hasDatabaseUrl()) redirectDemo(productMapId);
  const productMap = await getAuthorisedProductMap(productMapId, operator);
  const deleted = await getPrisma().productMapJurisdiction.deleteMany({
    where: { id: readRequired(formData, "jurisdictionId"), productMapId },
  });
  if (!deleted.count) throw new Error("Jurisdiction not found in this product map.");
  await completeFootprintMutation({
    operator,
    productMapId,
    organisationId: productMap.organisationId,
    action: "product_map.jurisdiction.remove",
    invalidatesConfirmation: true,
    invalidatesDrafts: true,
  });
  redirect(`/product-maps/${productMapId}?jurisdiction=removed`);
}
