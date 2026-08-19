import { needs, oneOf, opt, coerceList, pageParams, envelope, pqlFailure } from "../toolkit.js";

export const name = "plane_cycle";
export const title = "Cycles";
export const summary = "Cycles (time-boxed iterations) in a project.";

const STATUSES = ["current", "upcoming", "completed", "draft", "incomplete"];

const PQL_FIELD_HINT = [
  "Optional Plane Query Language (PQL) filter. Examples:",
  '`priority = "urgent" AND assignee = currentUser()`,',
  "`stateGroup IN openStates() AND isOverdue()`.",
  "UUID fields (project, assignee, state, label, cycle, module, type, milestone, createdBy)",
  "need UUIDs — resolve a name to its UUID first if you only have a name or short",
  "identifier (e.g. `LSS` -> project list and match `identifier` to get `id`).",
  "Call `plane_get_pql_reference` for full PQL syntax before composing complex queries.",
].join(" ");

export const actions = [
  { name: "list", requires: ["project_id"], optional: ["archived", "status", "cursor", "per_page", "order_by"], read: true },
  { name: "retrieve", requires: ["project_id", "cycle_id"], read: true },
  { name: "create", requires: ["project_id", "name", "owned_by"], optional: ["description", "start_date", "end_date", "timezone", "external_source", "external_id"] },
  { name: "update", requires: ["project_id", "cycle_id"], optional: ["name", "description", "start_date", "end_date", "owned_by", "timezone", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["project_id", "cycle_id"], destructive: true },
  { name: "list_workitems", requires: ["project_id", "cycle_id"], optional: ["pql", "order_by", "cursor", "per_page", "expand", "fields"], read: true },
  { name: "manage_workitems", requires: ["project_id", "cycle_id"], optional: ["add_ids", "remove_ids"], note: "pass at least one of add_ids or remove_ids; returns nothing, read back with list_workitems" },
  { name: "transfer_workitems", requires: ["project_id", "cycle_id", "new_cycle_id"], note: "moves everything to new_cycle_id" },
  { name: "complete", requires: ["project_id", "cycle_id"], note: "sets end_date to today" },
  { name: "archive", requires: ["project_id", "cycle_id"], note: "ends the cycle first if it is still running" },
  { name: "unarchive", requires: ["project_id", "cycle_id"] },
];

export const footer = [
  `status filters active cycles: ${STATUSES.join(", ")}; it is ignored when archived is true.`,
  "Dates are ISO 8601 (YYYY-MM-DD). owned_by is a member id.",
  PQL_FIELD_HINT,
].join(" ");

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: actions.map((a) => a.name), description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    cycle_id: { type: "string", description: "UUID of the cycle" },
    new_cycle_id: { type: "string", description: "UUID of the target cycle for transfer_workitems" },
    name: { type: "string", description: "Cycle name" },
    owned_by: { type: "string", description: "Member id owning the cycle" },
    description: { type: "string", description: "Cycle description" },
    start_date: { type: "string", description: "Start date, YYYY-MM-DD" },
    end_date: { type: "string", description: "End date, YYYY-MM-DD" },
    timezone: { type: "string", description: "IANA timezone" },
    status: { type: "string", description: `One of: ${STATUSES.join(", ")}` },
    archived: { type: "boolean", description: "True lists archived cycles" },
    add_ids: { type: "string", description: "Work item UUID(s) to add to the cycle, one or several" },
    remove_ids: { type: "string", description: "Work item UUID(s) to remove from the cycle, one or several" },
    pql: { type: "string", description: PQL_FIELD_HINT },
    expand: { type: "string", description: "Related objects to expand, comma-separated" },
    fields: { type: "string", description: "Sparse fieldset, comma-separated" },
    external_source: { type: "string", description: "External source identifier" },
    external_id: { type: "string", description: "External id" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
    order_by: { type: "string", description: "Ordering, e.g. -created_at" },
  },
  required: ["action"],
};

function stillRunning(endDate) {
  if (!endDate) return true;
  const date = endDate.slice(0, 10);
  return date > new Date().toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function handler(args, plane) {
  const { client } = plane;
  const {
    action, project_id, cycle_id, new_cycle_id, name, owned_by, description,
    start_date, end_date, timezone, status, archived, add_ids, remove_ids,
    pql, expand, fields, external_source, external_id, cursor, per_page, order_by,
  } = args;

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  if (action === "list") {
    if (archived) {
      const query = pageParams({ cursor: opt(cursor), per_page: opt(per_page), order_by: opt(order_by) });
      return client.get(client.wsPath(`projects/${project_id}/archived-cycles`), query);
    }
    const error = oneOf("status", status, STATUSES);
    if (error) return error;
    const query = pageParams({
      cursor: opt(cursor),
      per_page: opt(per_page),
      order_by: opt(order_by),
      status: opt(status),
    });
    return client.get(client.wsPath(`projects/${project_id}/cycles-lite`), query);
  }

  if (action === "create") {
    const error = needs(action, { name, owned_by });
    if (error) return error;
    const payload = Object.fromEntries(
      Object.entries({
        name,
        owned_by,
        description: opt(description),
        start_date: opt(start_date),
        end_date: opt(end_date),
        timezone: opt(timezone),
        external_source: opt(external_source),
        external_id: opt(external_id),
        project_id,
      }).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath(`projects/${project_id}/cycles`), payload);
  }

  if (!cycle_id) {
    return `Error: action '${action}' requires: cycle_id.`;
  }

  const cyclePath = client.wsPath(`projects/${project_id}/cycles/${cycle_id}`);

  if (action === "retrieve") {
    return client.get(cyclePath);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries({
        name: opt(name),
        description: opt(description),
        start_date: opt(start_date),
        end_date: opt(end_date),
        owned_by: opt(owned_by),
        timezone: opt(timezone),
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.patch(cyclePath, payload);
  }

  if (action === "delete") {
    await client.del(cyclePath);
    return null;
  }

  if (action === "list_workitems") {
    const query = pageParams({
      pql: opt(pql),
      order_by: opt(order_by),
      cursor: opt(cursor),
      per_page: opt(per_page),
      expand: opt(expand),
      fields: opt(fields),
    });
    try {
      const response = await client.get(client.wsPath(`projects/${project_id}/cycles/${cycle_id}/cycle-issues`), query);
      return envelope(response, opt(fields));
    } catch (err) {
      const failure = pqlFailure("plane_cycle", action, pql, err);
      if (failure) return failure;
      throw err;
    }
  }

  if (action === "manage_workitems") {
    const add = coerceList(add_ids);
    const remove = coerceList(remove_ids);
    if (!add && !remove) {
      return `Error: action '${action}' requires: add_ids or remove_ids.`;
    }
    if (add) {
      await client.post(client.wsPath(`projects/${project_id}/cycles/${cycle_id}/cycle-issues`), { issues: add });
    }
    for (const workitemId of remove || []) {
      await client.del(client.wsPath(`projects/${project_id}/cycles/${cycle_id}/cycle-issues/${workitemId}`));
    }
    return null;
  }

  if (action === "transfer_workitems") {
    if (!new_cycle_id) {
      return `Error: action '${action}' requires: new_cycle_id.`;
    }
    await client.post(client.wsPath(`projects/${project_id}/cycles/${cycle_id}/transfer-issues`), { new_cycle_id });
    return null;
  }

  if (action === "complete") {
    return client.patch(cyclePath, { end_date: today() });
  }

  if (action === "archive") {
    const current = await client.get(cyclePath);
    if (stillRunning(current?.end_date)) {
      await client.patch(cyclePath, { end_date: today() });
    }
    await client.post(client.wsPath(`projects/${project_id}/cycles/${cycle_id}/archive`), {});
    return null;
  }

  await client.del(client.wsPath(`projects/${project_id}/archived-cycles/${cycle_id}/unarchive`));
  return null;
}
