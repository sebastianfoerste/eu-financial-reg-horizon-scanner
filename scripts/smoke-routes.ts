import { pathToFileURL } from "node:url";

type SmokeRoute = {
  path: string;
  expected: string[];
};

type SmokeResult = {
  path: string;
  status: number;
  ok: boolean;
  missing: string[];
};

export const baseUrl =
  process.argv.find((argument) => argument.startsWith("--base-url="))?.replace("--base-url=", "") ??
  process.env.SMOKE_BASE_URL ??
  "http://localhost:3000";

export const routes: SmokeRoute[] = [
  { path: "/briefing", expected: ["pilot briefing room", "impact queue"] },
  { path: "/", expected: ["scanner cockpit", "agent handoff", "save current view"] },
  { path: "/law-firm", expected: ["law firm workbench", "detailed implementation plan", "priority matter board"] },
  { path: "/law-firm/matter-casp-zag-authorisation", expected: ["matter command center", "client brief drafts"] },
  { path: "/agents", expected: ["agent control room", "agent registry", "run enabled agents"] },
  { path: "/agents/agent-demo-review-qa", expected: ["run steps", "artifacts", "apply as in-app draft"] },
  { path: "/review", expected: ["review queue", "approved content"] },
  { path: "/review/pub-esma-qa-2845", expected: ["classification correction", "impact explanation"] },
  { path: "/alerts", expected: ["alert drafts", "send reviewed alert"] },
  { path: "/service-catalogue", expected: ["service catalogue", "trigger rules"] },
  { path: "/sources", expected: ["tier 1 source estate", "source diligence"] },
  { path: "/sources/diligence", expected: ["source diligence", "reuse status"] },
  { path: "/integrations", expected: ["production diagnostics", "governed integration settings"] },
  { path: "/audit", expected: ["audit log", "latest events"] },
  { path: "/digest", expected: ["dry-run digest", "impact explanation"] },
  { path: "/product-maps", expected: ["product maps drive the impact score", "create a product map"] },
  { path: "/sign-in", expected: ["clerk is not configured locally"] },
  { path: "/sign-up", expected: ["clerk is not configured locally"] },
];

export function describeSmokeError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return error.errors.map(describeSmokeError).join("; ");
  }

  if (error instanceof Error && error.message.trim()) {
    const cause = "cause" in error ? error.cause : undefined;
    const causeText = cause ? describeSmokeError(cause) : "";
    return causeText ? `${error.message}: ${causeText}` : error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : "";
    const syscall = typeof record.syscall === "string" ? record.syscall : "";
    const address = typeof record.address === "string" ? record.address : "";
    const port = typeof record.port === "number" ? String(record.port) : "";
    const target = address && port ? `${address}:${port}` : address || port;
    const parts = [code, syscall, target].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }

  return String(error || "unknown route smoke error");
}

export async function checkRoute(route: SmokeRoute, fetchImpl: typeof fetch = fetch): Promise<SmokeResult> {
  const url = new URL(route.path, baseUrl);
  try {
    const response = await fetchImpl(url);
    const text = (await response.text()).toLowerCase();
    const missing = route.expected.filter((expected) => !text.includes(expected));

    return {
      path: route.path,
      status: response.status,
      ok: response.ok && missing.length === 0,
      missing,
    };
  } catch (error) {
    return {
      path: route.path,
      status: 0,
      ok: false,
      missing: [`request failed: ${describeSmokeError(error)}`],
    };
  }
}

async function main() {
  const results = await Promise.all(routes.map((route) => checkRoute(route)));
  const failed = results.filter((result) => !result.ok);

  for (const result of results) {
    const marker = result.ok ? "OK" : "FAIL";
    console.log(`${marker} ${result.path} ${result.status}`);
    if (result.missing.length) {
      console.log(`  missing: ${result.missing.join(", ")}`);
    }
  }

  if (failed.length) {
    if (failed.length === results.length && results.every((result) => result.status === 0)) {
      console.error(
        `Route smoke could not reach ${baseUrl}. Start the app with \`npm run dev\` or pass --base-url=http://host:port.`,
      );
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
