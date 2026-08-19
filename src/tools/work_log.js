import { missing, needs, pageParams } from "../toolkit.js";

export const name = "plane_work_log";
export const title = "Work logs";
export const summary = "Time logged against a work item.";
export const planGate = "Time tracking";

export const actions = [
  { name: "list", requires: ["project_id", "workitem_id"], optional: ["cursor", "per_page"], read: true },
  { name: "create", requires: ["project_id", "workitem_id", "duration"], optional: ["description"] },
  { name: "update", requires: ["project_id", "workitem_id", "work_log_id"], optional: ["duration", "description"] },
  { name: "delete", requires: ["project_id", "workitem_id", "work_log_id"], optional: [], destructive: true },
];

export const footer = "duration is in minutes.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "create", "update", "delete"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the work item" },
    work_log_id: { type: "string", description: "UUID of the work log" },
    duration: { type: "integer", description: "Logged duration in minutes" },
    description: { type: "string", description: "What the time was spent on" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, workitem_id, work_log_id, duration, description } = args;

  const absent = needs(action, { project_id, workitem_id });
  if (absent) return absent;

  const basePath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/worklogs`);

  if (action === "list") {
    return client.get(basePath, pageParams({ cursor: args.cursor, per_page: args.per_page }));
  }

  const payload = {};
  if (duration) payload.duration = duration;
  if (description) payload.description = description;

  if (action === "create") {
    if (!duration) return missing(action, "duration");
    return client.post(basePath, payload);
  }

  if (!work_log_id) return missing(action, "work_log_id");

  if (action === "update") {
    return client.patch(`${basePath}/${work_log_id}`, payload);
  }

  return client.del(`${basePath}/${work_log_id}`);
}
