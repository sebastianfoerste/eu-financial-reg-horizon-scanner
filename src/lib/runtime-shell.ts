import { getEnv, hasDatabaseUrl } from "@/lib/env";

export type ShellRuntimeTone = "success" | "warning" | "danger" | "neutral";

export type ShellRuntimeStatus = {
  clerkConfigured: boolean;
  persistence: {
    label: string;
    tone: ShellRuntimeTone;
  };
  auth: {
    label: string;
    tone: ShellRuntimeTone;
  };
  accessibleLabel: string;
};

export function describeShellRuntime(input: {
  databaseConfigured: boolean;
  clerkConfigured: boolean;
  demoFallbackAllowed: boolean;
  isProduction: boolean;
}): ShellRuntimeStatus {
  const persistence = input.databaseConfigured
    ? { label: "Postgres", tone: "success" as const }
    : { label: "Sample data", tone: input.isProduction ? ("danger" as const) : ("warning" as const) };

  const auth = input.clerkConfigured
    ? { label: "Clerk auth", tone: "success" as const }
    : input.isProduction
      ? { label: "Auth missing", tone: "danger" as const }
      : {
          label: input.demoFallbackAllowed ? "Local operator" : "Auth disabled",
          tone: input.demoFallbackAllowed ? ("warning" as const) : ("danger" as const),
        };

  return {
    clerkConfigured: input.clerkConfigured,
    persistence,
    auth,
    accessibleLabel: `${persistence.label}. ${auth.label}.`,
  };
}

export function getShellRuntimeStatus() {
  const env = getEnv();

  return describeShellRuntime({
    databaseConfigured: hasDatabaseUrl(),
    clerkConfigured: Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY),
    demoFallbackAllowed: env.HORIZON_ALLOW_DEMO_MODE,
    isProduction: process.env.NODE_ENV === "production",
  });
}
