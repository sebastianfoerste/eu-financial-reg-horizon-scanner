import { getDigestPreview } from "@/lib/publications";
import { isAgentKind } from "@/lib/agents/policy";
import { runAgent } from "@/lib/agents/runner";
import { getEnv } from "@/lib/env";
import { pollTierOneSources } from "@/lib/ingestion/pipeline";
import { inngest } from "@/inngest/client";

export const pollTierOneSourcesFunction = inngest.createFunction(
  {
    id: "poll-tier-one-sources",
    name: "Poll Tier 1 regulator sources",
    triggers: [{ cron: "*/60 * * * *" }],
  },
  async ({ step }) => {
    const results = await step.run("poll tier one adapters", async () => pollTierOneSources());
    return {
      results,
      failed: results.filter((result) => result.status === "FAILED").length,
    };
  },
);

export const manualPollSourcesFunction = inngest.createFunction(
  {
    id: "manual-poll-sources",
    name: "Manual source poll",
    triggers: [{ event: "sources/poll.requested" }],
  },
  async ({ step }) => {
    return step.run("poll tier one adapters", async () => pollTierOneSources());
  },
);

export const prepareDigestPreviewFunction = inngest.createFunction(
  {
    id: "prepare-digest-preview",
    name: "Prepare dry-run digest preview",
    triggers: [{ event: "digest/preview.requested" }, { cron: "0 7 * * 1-5" }],
  },
  async ({ step }) => {
    return step.run("render digest preview", async () => getDigestPreview());
  },
);

export const scheduledSourceMonitorAgentFunction = inngest.createFunction(
  {
    id: "agent-source-monitor",
    name: "Agent source monitor",
    triggers: [{ cron: "*/60 * * * *" }, { event: "agents/source-monitor.requested" }],
  },
  async ({ step }) => {
    return step.run("run source monitor agent", async () => {
      if (!getEnv().HORIZON_AGENT_AUTORUN_ENABLED) {
        return { skipped: true, reason: "Agent autorun is disabled." };
      }
      return runAgent({ kind: "SOURCE_MONITOR", trigger: "inngest" });
    });
  },
);

export const requestedAgentRunFunction = inngest.createFunction(
  {
    id: "agent-run-requested",
    name: "Requested agent run",
    triggers: [{ event: "agents/run.requested" }],
  },
  async ({ event, step }) => {
    return step.run("run requested agent", async () => {
      const data = event.data as {
        kind?: string;
        organisationId?: string | null;
        triggeredByUserId?: string | null;
        publicationId?: string | null;
        limit?: number;
      };
      if (!data.kind || !isAgentKind(data.kind)) {
        throw new Error("Requested agent run did not include a known agent kind.");
      }
      return runAgent({
        kind: data.kind,
        trigger: "inngest",
        organisationId: data.organisationId ?? null,
        triggeredByUserId: data.triggeredByUserId ?? null,
        publicationId: data.publicationId ?? null,
        limit: data.limit,
      });
    });
  },
);

export const functions = [
  pollTierOneSourcesFunction,
  manualPollSourcesFunction,
  prepareDigestPreviewFunction,
  scheduledSourceMonitorAgentFunction,
  requestedAgentRunFunction,
];
