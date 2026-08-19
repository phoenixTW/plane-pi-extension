import { oneOf, opt, coerceList, pageParams, envelope, pqlFailure } from "../toolkit.js";

export const name = "plane_module";
export const title = "Modules";
export const summary = "Modules (feature groupings) in a project.";

const STATUSES = ["backlog", "planned", "in-progress", "paused", "completed", "cancelled"];

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
  { name: "list", requires: ["project_id"], optional: ["archived", "cursor", "per_page", "order_by"], read: true },
  { name: "retrieve", requires: ["project_id", "module_id"], read: true },
  { name: "create", requires: ["project_id", "name"], optional: ["description", "start_date", "target_date", "status", "lead", "members", "external_source", "external_id"] },
  { name: "update", requires: ["project_id", "module_id"], optional: ["name", "description", "start_date", "target_date", "status", "lead", "members", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["project_id", "module_id"], destructive: true },
  { name: "list_workitems", requires: ["project_id", "module_id"], optional: ["pql", "order_by", "cursor", "per_page", "expand", "fields"], read: true },
  { name: "manage_workitems", requires: ["project_id", "module_id"], optional: ["add_ids", "remove_ids"], note: "pass at least one of add_ids or remove_ids; returns nothing, read back with list_workitems" },
  { name: "archive", requires: ["project_id", "module_id"] },
  { name: "unarchive", requires: ["project_id", "module_id"] },
];

export const footer = [
  `status is one of: ${STATUSES.join(", ")}. Dates are ISO 8601 (YYYY-MM-DD).`,
  "lead and members are member ids.",
  PQL_FIELD_HINT,
].join(" ");

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: actions.map((a) => a.name), description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    module_id: { type: "string", description: "UUID of the module" },
    name: { type: "string", description: "Module name" },
    description: { type: "string", description: "Module description" },
    start_date: { type: "string", description: "Start date, YYYY-MM-DD" },
    target_date: { type: "string", description: "Target date, YYYY-MM-DD" },
    status: { type: "string", description: `One of: ${STATUSES.join(", ")}` },
    lead: { type: "string", description: "Member id leading the module" },
    members: { type: "string", description: "Member ids, one or several" },
    archived: { type: "boolean", description: "True lists archived modules" },
    add_ids: { type: "string", description: "Work item UUID(s) to add to the module, one or several" },
    remove_ids: { type: "string", description: "Work item UUID(s) to remove from the module, one or several" },
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

export async function handler(args, plane) {
  const { client } = plane;
  const {
    action, project_id, module_id, name, description, start_date, target_date,
    status, lead, members, archived, add_ids, remove_ids, pql, expand, fields,
    external_source, external_id, cursor, per_page, order_by,
  } = args;

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  const error = oneOf("status", status, STATUSES);
  if (error) return error;

  if (action === "list") {
    const query = pageParams({ cursor: opt(cursor), per_page: opt(per_page), order_by: opt(order_by) });
    const path = archived
      ? client.wsPath(`projects/${project_id}/archived-modules`)
      : client.wsPath(`projects/${project_id}/modules-lite`);
    return client.get(path, query);
  }

  if (action === "create") {
    if (!name) {
      return `Error: action '${action}' requires: name.`;
    }
    const payload = Object.fromEntries(
      Object.entries({
        name,
        description: opt(description),
        start_date: opt(start_date),
        target_date: opt(target_date),
        status: opt(status),
        lead: opt(lead),
        members: coerceList(members),
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath(`projects/${project_id}/modules`), payload);
  }

  if (!module_id) {
    return `Error: action '${action}' requires: module_id.`;
  }

  const modulePath = client.wsPath(`projects/${project_id}/modules/${module_id}`);

  if (action === "retrieve") {
    return client.get(modulePath);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries({
        name: opt(name),
        description: opt(description),
        start_date: opt(start_date),
        target_date: opt(target_date),
        status: opt(status),
        lead: opt(lead),
        members: coerceList(members),
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.patch(modulePath, payload);
  }

  if (action === "delete") {
    await client.del(modulePath);
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
      const response = await client.get(client.wsPath(`projects/${project_id}/modules/${module_id}/module-issues`), query);
      return envelope(response, opt(fields));
    } catch (err) {
      const failure = pqlFailure("plane_module", action, pql, err);
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
      await client.post(client.wsPath(`projects/${project_id}/modules/${module_id}/module-issues`), { issues: add });
    }
    for (const workitemId of remove || []) {
      await client.del(client.wsPath(`projects/${project_id}/modules/${module_id}/module-issues/${workitemId}`));
    }
    return null;
  }

  if (action === "archive") {
    await client.post(client.wsPath(`projects/${project_id}/modules/${module_id}/archive`), {});
    return null;
  }

  await client.del(client.wsPath(`projects/${project_id}/archived-modules/${module_id}/unarchive`));
  return null;
}
