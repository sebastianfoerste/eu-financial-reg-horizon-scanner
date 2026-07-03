import { CalendarClock, CircleAlert, ShieldCheck } from "lucide-react";

import type { ProductMapConfirmationAssessment } from "@/lib/product-map-assurance";
import { cn } from "@/lib/utils";

const styles = {
  CURRENT: "border-teal-200 bg-teal-50 text-teal-900",
  DUE_SOON: "border-amber-200 bg-amber-50 text-amber-900",
  OVERDUE: "border-red-200 bg-red-50 text-red-900",
  REQUIRES_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-900",
};

export function ProductMapConfirmationBadge({
  assessment,
}: {
  assessment: ProductMapConfirmationAssessment;
}) {
  const Icon =
    assessment.status === "CURRENT"
      ? ShieldCheck
      : assessment.status === "DUE_SOON"
        ? CalendarClock
        : CircleAlert;

  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold", styles[assessment.status])}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {assessment.label}
    </span>
  );
}

