import { missing, oneOf, opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_intake";
export const title = "Intake queue";
export const summary = "The intake (triage) queue for a project.";

const PRIORITIES = ["urgent", "high", "medium", "low", "none"];

export const actions = [
  { name: "list", requires: ["project_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "workitem_id"], optional: [], read: true },
  { name: "create", requires: ["project_id", "name"], optional: ["description_html", "priority"] },
  { name: "update", requires: ["project_id", "workitem_id"], optional: ["status", "snoozed_till", "duplicate_to", "source", "source_email"], note: "pass status to make a triage decision" },
  { name: "delete", requires: ["project_id", "workitem_id"], optional: [], destructive: true },
];

export const footer =
  "workitem_id is the `issue` field of an intake record, not the record's own id. " +
  "status: -2 pending, -1 declined, 0 snoozed (needs snoozed_till), 1 accepted, " +
  "2 duplicate (needs duplicate_to). " +
  `priority is one of: ${PRIORITIES.join(", ")}.`;

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the wrapped work item (the `issue` field of an intake record)" },
    name: { type: "string", description: "Work item name" },
    description_html: { type: "string", description: "HTML description" },
    priority: { type: "string", enum: PRIORITIES, description: "Work item priority" },
    status: { type: "integer", description: "Triage status: -2 pending, -1 declined, 0 snoozed, 1 accepted, 2 duplicate" },
    snoozed_till: { type: "string", description: "Snooze deadline, required when status=0" },
    duplicate_to: { type: "string", description: "Duplicate target work item id, required when status=2" },
    source: { type: "string", description: "Source metadata" },
    source_email: { type: "string", description: "Source email metadata" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const {
    action,
    project_id,
    workitem_id,
    name,
    description_html,
    priority,
    status,
    snoozed_till,
    duplicate_to,
    source,
    source_email,
    cursor,
    per_page,
  } = args;

  if (!project_id) return missing(action, "project_id");

  if (action === "list") {
    const response = await client.get(
      client.wsPath(`projects/${project_id}/intake-issues`),
      pageParams({ cursor, per_page })
    );
    return envelope(response);
  }

  if (action === "create") {
    if (!name) return missing(action, "name");
    const priorityError = oneOf("priority", priority, PRIORITIES);
    if (priorityError) return priorityError;
    const issue = { name };
    if (opt(description_html)) issue.description_html = description_html;
    if (opt(priority)) issue.priority = priority;
    return client.post(client.wsPath(`projects/${project_id}/intake-issues`), { issue });
  }

  if (!workitem_id) return missing(action, "workitem_id");

  if (action === "retrieve") {
    return client.get(client.wsPath(`projects/${project_id}/intake-issues/${workitem_id}`));
  }

  if (action === "update") {
    if (status === 0 && !snoozed_till) {
      return "Error: snoozed_till is required when status=0 (snoozed).";
    }
    if (status === 2 && !duplicate_to) {
      return "Error: duplicate_to is required when status=2 (duplicate).";
    }
    if (status === undefined && !(snoozed_till || duplicate_to || source || source_email)) {
      return missing(action, "status (or a source field to edit)");
    }
    const body = {};
    if (status !== undefined && status !== null) body.status = status;
    if (opt(snoozed_till)) body.snoozed_till = snoozed_till;
    if (opt(duplicate_to)) body.duplicate_to = duplicate_to;
    if (opt(source)) body.source = source;
    if (opt(source_email)) body.source_email = source_email;
    const base = client.wsPath(`projects/${project_id}/intake-issues/${workitem_id}`);
    if (status !== undefined && status !== null) {
      return client.patch(`${base}/status`, body);
    }
    if (snoozed_till || duplicate_to) {
      return client.patch(`${base}/status`, body);
    }
    return client.patch(base, body);
  }

  return client.del(client.wsPath(`projects/${project_id}/intake-issues/${workitem_id}`));
}
