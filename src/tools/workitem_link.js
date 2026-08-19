import { missing, needs, pageParams, envelope } from "../toolkit.js";

export const name = "plane_workitem_link";
export const title = "Work item links";
export const summary = "External links attached to a work item.";

export const actions = [
  { name: "list", requires: ["project_id", "workitem_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "workitem_id", "link_id"], optional: [], read: true },
  { name: "create", requires: ["project_id", "workitem_id", "url"], optional: [] },
  { name: "update", requires: ["project_id", "workitem_id", "link_id", "url"], optional: [] },
  { name: "delete", requires: ["project_id", "workitem_id", "link_id"], optional: [], destructive: true },
];

export const footer = "";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the work item" },
    link_id: { type: "string", description: "UUID of the link" },
    url: { type: "string", description: "External URL" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, workitem_id, link_id, url } = args;

  const absent = needs(action, { project_id, workitem_id });
  if (absent) return absent;

  const basePath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/links`);

  if (action === "list") {
    const response = await client.get(basePath, pageParams({ cursor: args.cursor, per_page: args.per_page }));
    return envelope(response);
  }

  if (action === "create") {
    if (!url) return missing(action, "url");
    return client.post(basePath, { url });
  }

  if (!link_id) return missing(action, "link_id");

  if (action === "retrieve") {
    return client.get(`${basePath}/${link_id}`);
  }

  if (action === "update") {
    if (!url) return missing(action, "url");
    return client.patch(`${basePath}/${link_id}`, { url });
  }

  return client.del(`${basePath}/${link_id}`);
}
