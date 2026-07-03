import { addMonths } from "date-fns";

export const PRODUCT_MAP_CONFIRMATION_INTERVAL_MONTHS = 3;
const DUE_SOON_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProductMapConfirmationFields = {
  id: string;
  name: string;
  confirmationRequired: boolean;
  lastConfirmedAt: string | Date | null;
  nextConfirmationDueAt: string | Date | null;
  confirmedByName: string | null;
};

export type ProductMapConfirmationAssessment = {
  status: "REQUIRES_CONFIRMATION" | "OVERDUE" | "DUE_SOON" | "CURRENT";
  label: string;
  detail: string;
  blocksAlerts: boolean;
};

function asDate(value: string | Date | null) {
  return typeof value === "string" ? new Date(value) : value;
}

export function nextProductMapConfirmationDate(confirmedAt: Date) {
  return addMonths(confirmedAt, PRODUCT_MAP_CONFIRMATION_INTERVAL_MONTHS);
}

export function assessProductMapConfirmation(
  productMap: ProductMapConfirmationFields,
  now = new Date(),
): ProductMapConfirmationAssessment {
  const lastConfirmedAt = asDate(productMap.lastConfirmedAt);
  const nextDueAt = asDate(productMap.nextConfirmationDueAt);

  if (productMap.confirmationRequired || !lastConfirmedAt || !nextDueAt) {
    return {
      status: "REQUIRES_CONFIRMATION",
      label: "Confirmation required",
      detail: "Score-affecting footprint facts require confirmation.",
      blocksAlerts: true,
    };
  }

  if (nextDueAt.getTime() <= now.getTime()) {
    return {
      status: "OVERDUE",
      label: "Confirmation overdue",
      detail: "Quarterly footprint confirmation is overdue.",
      blocksAlerts: true,
    };
  }

  const daysRemaining = Math.ceil((nextDueAt.getTime() - now.getTime()) / DAY_MS);
  if (daysRemaining <= DUE_SOON_DAYS) {
    return {
      status: "DUE_SOON",
      label: "Confirmation due soon",
      detail: `Quarterly confirmation is due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
      blocksAlerts: false,
    };
  }

  return {
    status: "CURRENT",
    label: "Footprint current",
    detail: "Quarterly footprint confirmation is current.",
    blocksAlerts: false,
  };
}

export function assessProductMapDeliveryReadiness(
  productMaps: ProductMapConfirmationFields[],
  now = new Date(),
) {
  const maps = productMaps.map((productMap) => ({
    productMap,
    assessment: assessProductMapConfirmation(productMap, now),
  }));
  const blockingMaps = maps.filter(({ assessment }) => assessment.blocksAlerts);

  return {
    ready: maps.length > 0 && blockingMaps.length === 0,
    maps,
    blockingMaps,
    message:
      maps.length === 0
        ? "No active product map is available for alert routing."
        : blockingMaps.length
          ? "Confirm active product maps before generating or sending alert drafts."
          : "Active product maps are confirmed for alert routing.",
  };
}
