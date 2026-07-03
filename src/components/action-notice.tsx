import { CheckCircle2, CircleAlert } from "lucide-react";

export function ActionNotice({ tone, children }: { tone: "success" | "warning"; children: string }) {
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;
  return (
    <p
      role="status"
      className={
        tone === "success"
          ? "flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900"
          : "flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      }
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
