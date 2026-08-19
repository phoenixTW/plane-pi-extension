import { requireDeclared, oneOf, opt, coerceList, pageParams, envelope } from "../toolkit.js";

export const name = "plane_initiative";
export const title = "Initiatives";
export const summary = "Workspace initiatives.";

const STATES = ["DRAFT", "PLANNED", "ACTIVE", "COMPLETED", "CLOSED"];

const WORK_ITEM_FALLBACK =
  'Initiatives are stored as "Initiative" work items in this workspace. ' +
  'Call `plane_workitem_type resolve` with project_id and name="Initiative" to get the type id, ' +
  'then `plane_workitem list` with pql=\'type = "<type id>"\' to read them, or ' +
  "`plane_workitem create` with that type_id to add one. Work items belong to a project -- " +
  "ask which project if none was named.";

const PROJECTS_NEED_NATIVE =
  "Linking projects to an initiative requires the native initiatives feature; " +
  "there is no work-item equivalent. Enable it in workspace settings.";

export const actions = [
  { name: "list", requires: [], optional: [], note: "returns every initiative; this endpoint does not paginate", read: true },
  { name: "retrieve", requires: ["initiative_id"], optional: [], read: true },
  { name: "create", requires: ["name"], optional: ["description_html", "start_date", "end_date", "state", "lead"] },
  { name: "update", requires: ["initiative_id"], optional: ["name", "description_html", "start_date", "end_date", "state", "lead"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["initiative_id"], optional: [], destructive: true },
  { name: "list_projects", requires: ["initiative_id"], optional: ["cursor", "per_page"], read: true },
  { name: "add_projects", requires: ["initiative_id", "project_ids"], optional: [], note: "returns nothing, read back with list_projects" },
  { name: "remove_projects", requires: ["initiative_id", "project_ids"], optional: [], note: "returns nothing, read back with list_projects", destructive: true },
];

export const footer =
  `state is one of: ${STATES.join(", ")}. Dates are ISO 8601 (YYYY-MM-DD). ` +
  "lead is a member id. project_ids takes project UUIDs.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete", "list_projects", "add_projects", "remove_projects"],
      description: "Operation to perform",
    },
    initiative_id: { type: "string", description: "UUID of the initiative" },
    name: { type: "string", description: "Initiative name" },
    description_html: { type: "string", description: "HTML description" },
    start_date: { type: "string", description: "Start date, ISO 8601 (YYYY-MM-DD)" },
    end_date: { type: "string", description: "End date, ISO 8601 (YYYY-MM-DD)" },
    state: { type: "string", enum: STATES, description: "Initiative state" },
    lead: { type: "string", description: "Member id of the lead" },
    project_ids: { type: "string", description: "Comma-separated project UUIDs" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

async function requireNative(client, workspaceSlug, fallback) {
  const features = await client.get(client.wsPath(`${workspaceSlug}/features`));
  if (!features || !features.initiatives) {
    return `Error: The initiatives feature is disabled for this workspace. ${fallback}`;
  }
  return null;
}

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const {
    action,
    initiative_id,
    name,
    description_html,
    start_date,
    end_date,
    state,
    lead,
    project_ids,
    cursor,
    per_page,
  } = args;

  const stateError = oneOf("state", state, STATES);
  if (stateError) return stateError;

  const absent = requireDeclared(actions, action, { initiative_id, name, project_ids });
  if (absent) return absent;

  const fallback = ["list_projects", "add_projects", "remove_projects"].includes(action)
    ? PROJECTS_NEED_NATIVE
    : WORK_ITEM_FALLBACK;
  const nativeError = await requireNative(client, workspaceSlug, fallback);
  if (nativeError) return nativeError;

  if (action === "list") {
    const response = await client.get(client.wsPath("initiatives"));
    return response.results;
  }

  if (action === "create") {
    const body = { name };
    if (opt(description_html)) body.description_html = description_html;
    if (opt(start_date)) body.start_date = start_date;
    if (opt(end_date)) body.end_date = end_date;
    if (opt(state)) body.state = state;
    if (opt(lead)) body.lead = lead;
    return client.post(client.wsPath("initiatives"), body);
  }

  if (action === "retrieve") {
    return client.get(client.wsPath(`initiatives/${initiative_id}`));
  }

  if (action === "update") {
    const body = {};
    if (opt(name)) body.name = name;
    if (opt(description_html)) body.description_html = description_html;
    if (opt(start_date)) body.start_date = start_date;
    if (opt(end_date)) body.end_date = end_date;
    if (opt(state)) body.state = state;
    if (opt(lead)) body.lead = lead;
    return client.patch(client.wsPath(`initiatives/${initiative_id}`), body);
  }

  if (action === "delete") {
    return client.del(client.wsPath(`initiatives/${initiative_id}`));
  }

  if (action === "list_projects") {
    const linked = await client.get(
      client.wsPath(`initiatives/${initiative_id}/projects`),
      pageParams({ cursor, per_page })
    );
    return envelope(linked);
  }

  const ids = coerceList(project_ids);
  const path = client.wsPath(`initiatives/${initiative_id}/projects`);
  if (action === "add_projects") {
    return client.post(path, { project_ids: ids });
  }
  return client.del(path, { project_ids: ids });
}
