"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Database, LogIn, ShieldCheck } from "lucide-react";

import type { ShellRuntimeStatus, ShellRuntimeTone } from "@/lib/runtime-shell";

const toneClasses: Record<ShellRuntimeTone, string> = {
  success: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export function AuthControls({ runtime }: { runtime: ShellRuntimeStatus }) {
  if (!runtime.clerkConfigured) return <RuntimeBadges runtime={runtime} />;

  return <ClerkAuthControls runtime={runtime} />;
}

function RuntimeBadges({ runtime }: { runtime: ShellRuntimeStatus }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label={runtime.accessibleLabel}>
      <RuntimeBadge tone={runtime.persistence.tone} icon={Database}>
        {runtime.persistence.label}
      </RuntimeBadge>
      <RuntimeBadge tone={runtime.auth.tone} icon={ShieldCheck}>
        {runtime.auth.label}
      </RuntimeBadge>
    </div>
  );
}

function RuntimeBadge({
  tone,
  icon: Icon,
  children,
}: {
  tone: ShellRuntimeTone;
  icon: typeof Database;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${toneClasses[tone]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

function ClerkAuthControls({ runtime }: { runtime: ShellRuntimeStatus }) {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <RuntimeBadges runtime={runtime} />
        <UserButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <RuntimeBadges runtime={runtime} />
      <SignInButton mode="modal">
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in
        </button>
      </SignInButton>
    </div>
  );
}
