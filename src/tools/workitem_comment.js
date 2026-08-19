import { missing, needs, opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_workitem_comment";
export const title = "Work item comments";
export const summary = "Comments on a work item.";

export const actions = [
  { name: "list", requires: ["project_id", "workitem_id"], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["project_id", "workitem_id", "comment_id"], optional: [], read: true },
  { name: "create", requires: ["project_id", "workitem_id", "comment_html"], optional: ["access", "external_source", "external_id"] },
  { name: "update", requires: ["project_id", "workitem_id", "comment_id"], optional: ["comment_html", "access", "external_source", "external_id"] },
  { name: "delete", requires: ["project_id", "workitem_id", "comment_id"], optional: [], destructive: true },
];

export const footer =
  "comment_html is HTML, e.g. '<p>Looks good.</p>'. access is INTERNAL or EXTERNAL.";

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
    comment_id: { type: "string", description: "UUID of the comment" },
    comment_html: { type: "string", description: "Comment body as HTML" },
    access: { type: "string", description: "INTERNAL or EXTERNAL" },
    external_source: { type: "string", description: "External system the comment came from" },
    external_id: { type: "string", description: "Comment's identifier in the external system" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, workitem_id, comment_id, comment_html, access, external_source, external_id } = args;

  const absent = needs(action, { project_id, workitem_id });
  if (absent) return absent;

  const basePath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/comments`);

  if (action === "list") {
    const response = await client.get(basePath, pageParams({ cursor: args.cursor, per_page: args.per_page }));
    return envelope(response);
  }

  if (action === "create") {
    if (!comment_html) return missing(action, "comment_html");
    const body = { comment_html };
    if (opt(access)) body.access = access;
    if (opt(external_source)) body.external_source = external_source;
    if (opt(external_id)) body.external_id = external_id;
    return client.post(basePath, body);
  }

  if (!comment_id) return missing(action, "comment_id");

  if (action === "retrieve") {
    return client.get(`${basePath}/${comment_id}`);
  }

  if (action === "update") {
    const body = {};
    if (opt(comment_html)) body.comment_html = comment_html;
    if (opt(access)) body.access = access;
    if (opt(external_source)) body.external_source = external_source;
    if (opt(external_id)) body.external_id = external_id;
    return client.patch(`${basePath}/${comment_id}`, body);
  }

  return client.del(`${basePath}/${comment_id}`);
}
