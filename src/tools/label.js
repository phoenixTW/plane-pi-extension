import { opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_label";
export const title = "Labels";
export const summary = "Labels within a project.";

export const actions = [
  { name: "list", requires: ["project_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "label_id"], read: true },
  { name: "create", requires: ["project_id", "name"], optional: ["color", "description", "parent", "sort_order", "external_source", "external_id"] },
  { name: "update", requires: ["project_id", "label_id"], optional: ["name", "color", "description", "parent", "sort_order", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["project_id", "label_id"], destructive: true },
];

export const footer = "color is a hex code such as #EF4444. parent is the UUID of another label, for nesting.";

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["list", "retrieve", "create", "update", "delete"], description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    label_id: { type: "string", description: "UUID of the label" },
    name: { type: "string", description: "Label name" },
    color: { type: "string", description: "Hex code such as #EF4444" },
    description: { type: "string", description: "Label description" },
    parent: { type: "string", description: "UUID of the parent label, for nesting" },
    sort_order: { type: ["number", "null"], description: "Sort position, 0 is a real value" },
    external_source: { type: "string", description: "External source identifier" },
    external_id: { type: "string", description: "External id" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, label_id, name, color, description, parent, sort_order, external_source, external_id, cursor, per_page } = args;

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  if (action === "list") {
    const response = await client.get(client.wsPath(`projects/${project_id}/labels`), pageParams({ cursor, per_page }));
    return envelope(response);
  }

  if (action === "create") {
    if (!name) {
      return `Error: action '${action}' requires: name.`;
    }
    const payload = Object.fromEntries(
      Object.entries({
        name,
        color: opt(color),
        description: opt(description),
        parent: opt(parent),
        sort_order,
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath(`projects/${project_id}/labels`), payload);
  }

  if (!label_id) {
    return `Error: action '${action}' requires: label_id.`;
  }

  const labelPath = client.wsPath(`projects/${project_id}/labels/${label_id}`);

  if (action === "retrieve") {
    return client.get(labelPath);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries({
        name: opt(name),
        color: opt(color),
        description: opt(description),
        parent: opt(parent),
        sort_order,
        external_source: opt(external_source),
        external_id: opt(external_id),
      }).filter(([, v]) => v !== undefined)
    );
    return client.patch(labelPath, payload);
  }

  await client.del(labelPath);
  return null;
}
