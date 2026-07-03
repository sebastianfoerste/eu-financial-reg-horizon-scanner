"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { approveAlert, generateAlertDrafts, sendApprovedAlert } from "@/lib/alerts";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function generateAlertDraftsAction() {
  const result = await generateAlertDrafts();
  revalidatePath("/alerts");
  if ("blockedReason" in result) {
    redirect("/alerts?blocked=footprint");
  }
  redirect("/alerts?generated=1");
}

export async function approveAlertAction(formData: FormData) {
  const alertId = readText(formData, "alertId");
  const reviewerName = readText(formData, "reviewerName") || "Sebastian";
  const result = await approveAlert({ alertId, reviewerName });
  revalidatePath("/alerts");
  if (!result.ok) {
    redirect("/alerts?blocked=footprint");
  }
  redirect("/alerts?approved=1");
}

export async function sendAlertAction(formData: FormData) {
  const alertId = readText(formData, "alertId");
  const result = await sendApprovedAlert({ alertId });
  revalidatePath("/alerts");
  if (!result.ok && result.status === "SKIPPED") {
    redirect("/alerts?blocked=footprint");
  }
  if (!result.ok) {
    redirect("/alerts?delivery=blocked");
  }
  redirect("/alerts?sent=1");
}
