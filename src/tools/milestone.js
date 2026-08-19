import { opt, coerceList, pageParams, envelope } from "../toolkit.js";

export const name = "plane_milestone";
export const title = "Milestones";
export const summary = "Milestones within a project, and the work items assigned to them.";

export const actions = [
  { name: "list", requires: ["project_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "milestone_id"], read: true },
  { name: "create", requires: ["project_id", "title"], optional: ["target_date", "external_source", "external_id"] },
  { name: "update", requires: ["project_id", "milestone_id"], optional: ["title", "target_date", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["project_id", "milestone_id"], destructive: true },
  { name: "list_workitems", requires: ["project_id", "milestone_id"], optional: ["cursor", "per_page"], read: true },
  { name: "manage_workitems", requires: ["project_id", "milestone_id"], optional: ["add_ids", "remove_ids"], note: "pass at least one of add_ids or remove_ids; returns nothing, read back with list_workitems" },
];

export const footer = "target_date is ISO 8601 (YYYY-MM-DD). add_ids and remove_ids take work item UUIDs.";

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: actions.map((a) => a.name), description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    milestone_id: { type: "string", description: "UUID of the milestone" },
    title: { type: "string", description: "Milestone title" },
    target_date: { type: "string", description: "Target date, YYYY-MM-DD" },
    add_ids: { type: "string", description: "Work item UUID(s) to add to the milestone, one or several" },
    remove_ids: { type: "string", description: "Work item UUID(s) to remove from the milestone, one or several" },
    external_source: { type: "string", description: "External source identifier" },
    external_id: { type: "string", description: "External id" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, milestone_id, title, target_date, add_ids, remove_ids, external_source, external_id, cursor, per_page } = args;

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  if (action === "list") {
    const response = await client.get(client.wsPath(`projects/${project_id}/milestones`), pageParams({ cursor, per_page }));
    return envelope(response);
  }

  if (action === "create") {
    if (!title) {
      return `Error: action '${action}' requires: title.`;
    }
    const payload = Object.fromEntries(
      Object.entries({
        title,
        target_date: opt(target_date),
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath(`projects/${project_id}/milestones`), payload);
  }

  if (!milestone_id) {
    return `Error: action '${action}' requires: milestone_id.`;
  }

  const milestonePath = client.wsPath(`projects/${project_id}/milestones/${milestone_id}`);

  if (action === "retrieve") {
    return client.get(milestonePath);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries({
        title: opt(title),
        target_date: opt(target_date),
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.patch(milestonePath, payload);
  }

  if (action === "delete") {
    await client.del(milestonePath);
    return null;
  }

  if (action === "list_workitems") {
    const response = await client.get(client.wsPath(`projects/${project_id}/milestones/${milestone_id}/work-items`), pageParams({ cursor, per_page }));
    return envelope(response);
  }

  const add = coerceList(add_ids);
  const remove = coerceList(remove_ids);
  if (!add && !remove) {
    return `Error: action '${action}' requires: add_ids or remove_ids.`;
  }
  const itemsPath = client.wsPath(`projects/${project_id}/milestones/${milestone_id}/work-items`);
  if (add) {
    await client.post(itemsPath, { issues: add });
  }
  if (remove) {
    await client.del(itemsPath, { issues: remove });
  }
  return null;
}
