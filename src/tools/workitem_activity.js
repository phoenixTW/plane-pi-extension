import { missing, needs, pageParams, envelope } from "../toolkit.js";

export const name = "plane_workitem_activity";
export const title = "Work item activity";
export const summary = "Change history for a work item.";

export const actions = [
  { name: "list", requires: ["project_id", "workitem_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "workitem_id", "activity_id"], optional: [], read: true },
];

export const footer = "";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the work item" },
    activity_id: { type: "string", description: "UUID of the activity entry" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, workitem_id, activity_id } = args;

  const absent = needs(action, { project_id, workitem_id });
  if (absent) return absent;

  const basePath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/activities`);

  if (action === "list") {
    const response = await client.get(basePath, pageParams({ cursor: args.cursor, per_page: args.per_page }));
    return envelope(response);
  }

  if (!activity_id) return missing(action, "activity_id");
  return client.get(`${basePath}/${activity_id}`);
}
