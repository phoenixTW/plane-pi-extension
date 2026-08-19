import { needs, opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_state";
export const title = "Workflow states";
export const summary = "Workflow states within a project.";

const GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled", "triage"];

export const actions = [
  { name: "list", requires: ["project_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "state_id"], read: true },
  { name: "create", requires: ["project_id", "name", "color"], optional: ["description", "sequence", "group", "is_triage", "default", "external_source", "external_id"] },
  { name: "update", requires: ["project_id", "state_id"], optional: ["name", "color", "description", "sequence", "group", "is_triage", "default"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["project_id", "state_id"], destructive: true },
];

export const footer = `group is one of: ${GROUPS.join(", ")}. color is a hex code such as #EF4444.`;

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["list", "retrieve", "create", "update", "delete"], description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    state_id: { type: "string", description: "UUID of the state" },
    name: { type: "string", description: "State name" },
    color: { type: "string", description: "Hex code such as #EF4444" },
    description: { type: "string", description: "State description" },
    sequence: { type: ["number", "null"], description: "Sort position, 0 is a real value" },
    group: { type: "string", description: `One of: ${GROUPS.join(", ")}; anything else is dropped` },
    is_triage: { type: ["boolean", "null"], description: "False is a meaningful value, unset leaves alone" },
    default: { type: ["boolean", "null"], description: "False is a meaningful value, unset leaves alone" },
    external_source: { type: "string", description: "External source identifier" },
    external_id: { type: "string", description: "External id" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

const knownGroup = (value) => (GROUPS.includes(value) ? value : undefined);

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, state_id, name, color, description, sequence, group, is_triage, default: isDefault, external_source, external_id, cursor, per_page } = args;

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  if (action === "list") {
    const response = await client.get(client.wsPath(`projects/${project_id}/states`), pageParams({ cursor, per_page }));
    return envelope(response);
  }

  if (action === "create") {
    const error = needs(action, { name, color });
    if (error) return error;
    const payload = Object.fromEntries(
      Object.entries({
        name,
        color,
        description: opt(description),
        sequence,
        group: knownGroup(group),
        is_triage: is_triage,
        default: isDefault,
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath(`projects/${project_id}/states`), payload);
  }

  if (!state_id) {
    return `Error: action '${action}' requires: state_id.`;
  }

  const statePath = client.wsPath(`projects/${project_id}/states/${state_id}`);

  if (action === "retrieve") {
    return client.get(statePath);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries({
        name: opt(name),
        color: opt(color),
        description: opt(description),
        sequence,
        group: knownGroup(group),
        is_triage: is_triage,
        default: isDefault,
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.patch(statePath, payload);
  }

  await client.del(statePath);
  return null;
}
