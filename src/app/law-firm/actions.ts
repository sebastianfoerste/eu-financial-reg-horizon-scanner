"use server";

import type { ClientBriefStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { advanceClientBrief, createClientBriefDraft } from "@/lib/law-firm";

const allowedBriefStatuses = new Set<ClientBriefStatus>([
  "DRAFT",
  "SENIOR_REVIEW",
  "PARTNER_REVIEW",
  "CLIENT_READY",
  "ARCHIVED",
]);

function readRequiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function readOptionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createClientBriefDraftAction(formData: FormData) {
  const matterId = readRequiredText(formData, "matterId");
  const publicationId = readOptionalText(formData, "publicationId");

  await createClientBriefDraft({
    matterId,
    publicationId,
    reviewerName: readOptionalText(formData, "reviewerName"),
  });

  revalidatePath("/law-firm");
  revalidatePath(`/law-firm/${matterId}`);
  redirect(`/law-firm/${matterId}?brief=created`);
}

export async function advanceClientBriefAction(formData: FormData) {
  const matterId = readRequiredText(formData, "matterId");
  const briefId = readRequiredText(formData, "briefId");
  const status = readRequiredText(formData, "status") as ClientBriefStatus;

  if (!allowedBriefStatuses.has(status)) {
    throw new Error("Unsupported client brief status.");
  }

  await advanceClientBrief({
    briefId,
    status,
    reviewerName: readOptionalText(formData, "reviewerName"),
  });

  revalidatePath("/law-firm");
  revalidatePath(`/law-firm/${matterId}`);
  redirect(`/law-firm/${matterId}?brief=advanced`);
}
