import { loadSettings, resolveProfileSettings } from "./src/settings.js";
import { PlaneClient, PlaneApiError } from "./src/plane-client.js";
import { buildDescription, planRequired } from "./src/toolkit.js";
import { registerProfileCommand } from "./src/profiles-command.js";

import * as workitem from "./src/tools/workitem.js";
import * as project from "./src/tools/project.js";
import * as state from "./src/tools/state.js";
import * as label from "./src/tools/label.js";
import * as cycle from "./src/tools/cycle.js";
import * as module_ from "./src/tools/module.js";
import * as milestone from "./src/tools/milestone.js";
import * as page from "./src/tools/page.js";
import * as member from "./src/tools/member.js";
import * as workspace from "./src/tools/workspace.js";
import * as initiative from "./src/tools/initiative.js";
import * as intake from "./src/tools/intake.js";
import * as customer from "./src/tools/customer.js";
import * as customerProperty from "./src/tools/customer_property.js";
import * as customerRequest from "./src/tools/customer_request.js";
import * as release from "./src/tools/release.js";
import * as releaseLabel from "./src/tools/release_label.js";
import * as releaseTag from "./src/tools/release_tag.js";
import * as projectEstimate from "./src/tools/project_estimate.js";
import * as workLog from "./src/tools/work_log.js";
import * as workitemActivity from "./src/tools/workitem_activity.js";
import * as workitemAttachment from "./src/tools/workitem_attachment.js";
import * as workitemComment from "./src/tools/workitem_comment.js";
import * as workitemLink from "./src/tools/workitem_link.js";
import * as workitemRelation from "./src/tools/workitem_relation.js";
import * as workitemProperty from "./src/tools/workitem_property.js";
import * as workitemType from "./src/tools/workitem_type.js";
import * as getPqlReference from "./src/tools/get_pql_reference.js";

const TOOLS = [
  workitem,
  project,
  state,
  label,
  cycle,
  module_,
  milestone,
  page,
  member,
  workspace,
  initiative,
  intake,
  customer,
  customerProperty,
  customerRequest,
  release,
  releaseLabel,
  releaseTag,
  projectEstimate,
  workLog,
  workitemActivity,
  workitemAttachment,
  workitemComment,
  workitemLink,
  workitemRelation,
  workitemProperty,
  workitemType,
  getPqlReference,
];

const PROFILE_PARAM = {
  type: "string",
  description:
    "Plane profile name. Omit to use the default profile. List profiles with /plane-profile.",
};

function formatError(err, tool) {
  if (err instanceof PlaneApiError) {
    const gated = planRequired(err, tool.planGate || "This Plane feature");
    if (gated) return gated;
    const payload = err.payload;
    const detail =
      payload && typeof payload === "object" ? JSON.stringify(payload) : payload || "";
    return `Error: ${err.message}${detail ? ` -- ${detail}` : ""}`;
  }
  return `Error: ${err.message}`;
}

function registerPlaneTool(pi, tool) {
  const parameters = {
    type: "object",
    properties: { ...(tool.parameters.properties || {}), profile: PROFILE_PARAM },
    required: tool.parameters.required || ["action"],
  };
  pi.registerTool({
    name: tool.name,
    label: tool.title,
    description: buildDescription(tool.summary, tool.actions, tool.footer),
    promptSnippet: `${tool.title}: ${tool.actions.map((a) => a.name).join(", ")}`,
    parameters,
    async execute(_toolCallId, params) {
      let client = null;
      let workspaceSlug = null;
      let profileName = null;
      if (!tool.noProfile) {
        const settings = await loadSettings();
        const resolved = resolveProfileSettings(settings, params.profile);
        if (resolved.error) {
          return { content: [{ type: "text", text: resolved.error }], details: {}, isError: true };
        }
        client = new PlaneClient(resolved.profile);
        workspaceSlug = resolved.profile.workspaceSlug;
        profileName = resolved.profile.name;
      }
      try {
        const result = await tool.handler(params, {
          client,
          workspaceSlug,
          profileName,
        });
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return { content: [{ type: "text", text }], details: {} };
      } catch (err) {
        return {
          content: [{ type: "text", text: formatError(err, tool) }],
          details: {},
          isError: true,
        };
      }
    },
  });
}

export default function planePiTools(pi) {
  if (typeof pi.registerTool === "function") {
    for (const tool of TOOLS) registerPlaneTool(pi, tool);
  }
  if (typeof pi.registerCommand === "function") {
    registerProfileCommand(pi);
  }
}
