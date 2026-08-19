import { missing, oneOf, opt, coerceList, pageParams, envelope, descriptionHtml } from "../toolkit.js";

export const name = "plane_release";
export const title = "Releases";
export const summary = "Releases in the workspace: the release itself, its changelog and its work items.";

const STATUSES = ["unreleased", "released", "cancelled"];

export const actions = [
  { name: "list", requires: [], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["release_id"], optional: [], read: true },
  { name: "create", requires: ["name"], optional: ["description_html", "status", "release_date", "target_date", "tag_id", "lead_id", "is_prerelease", "external_source", "external_id"] },
  { name: "update", requires: ["release_id"], optional: ["name", "description_html", "status", "release_date", "target_date", "tag_id", "lead_id", "is_prerelease"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["release_id"], optional: [], destructive: true },
  { name: "get_changelog", requires: ["release_id"], optional: [], read: true },
  { name: "update_changelog", requires: ["release_id"], optional: ["description_html", "description_stripped"] },
  { name: "list_workitems", requires: ["release_id"], optional: ["cursor", "per_page"], read: true },
  { name: "manage_workitems", requires: ["release_id"], optional: ["add_ids", "remove_ids"], note: "pass at least one of add_ids or remove_ids; returns nothing, read back with list_workitems" },
];

export const footer =
  `status is one of: ${STATUSES.join(", ")}, defaulting to unreleased. ` +
  'release_date is what the Plane UI labels "Target date" (YYYY-MM-DD); target_date is a ' +
  "separate stored date that the UI does not show. tag_id comes from `plane_release_tag list`, " +
  "lead_id from `plane_member list_workspace`. For the changelog pass description_html, or description_stripped " +
  "for plain text. A changelog is created empty with the release, so get_changelog always " +
  "returns one.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete", "get_changelog", "update_changelog", "list_workitems", "manage_workitems"],
      description: "Operation to perform",
    },
    release_id: { type: "string", description: "UUID of the release" },
    name: { type: "string", description: "Release name" },
    description_html: { type: "string", description: "HTML description" },
    description_stripped: { type: "string", description: "Plain-text description (changelog)" },
    status: { type: "string", enum: STATUSES, description: "Release status" },
    release_date: { type: "string", description: 'The date the UI labels "Target date" (YYYY-MM-DD)' },
    target_date: { type: "string", description: "Separate stored date the UI does not show (YYYY-MM-DD)" },
    tag_id: { type: "string", description: "Release tag UUID" },
    lead_id: { type: "string", description: "Member id of the release lead" },
    add_ids: { type: "string", description: "Comma-separated work item UUIDs to add" },
    remove_ids: { type: "string", description: "Comma-separated work item UUIDs to remove" },
    is_prerelease: { type: ["boolean", "null"], description: "Whether the release is a prerelease" },
    external_source: { type: "string", description: "External system the release came from" },
    external_id: { type: "string", description: "Release's identifier in the external system" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

function prosemirror(text) {
  const paragraphs = [];
  for (const line of text.split("\n")) {
    const paragraph = { type: "paragraph" };
    if (line) paragraph.content = [{ type: "text", text: line }];
    paragraphs.push(paragraph);
  }
  return { type: "doc", content: paragraphs };
}

function releaseBody(args, { includeExternal }) {
  const body = {};
  if (opt(args.name)) body.name = args.name;
  if (opt(args.description_html)) body.description_html = args.description_html;
  if (opt(args.status)) body.status = args.status;
  if (opt(args.target_date)) body.target_date = args.target_date;
  if (opt(args.release_date)) body.release_date = args.release_date;
  if (opt(args.tag_id)) body.tag = args.tag_id;
  if (opt(args.lead_id)) body.lead = args.lead_id;
  if (args.is_prerelease !== undefined && args.is_prerelease !== null) body.is_prerelease = args.is_prerelease;
  if (includeExternal) {
    if (opt(args.external_source)) body.external_source = args.external_source;
    if (opt(args.external_id)) body.external_id = args.external_id;
  }
  return body;
}

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const { action, release_id, name, description_html, description_stripped, add_ids, remove_ids } = args;

  const statusError = oneOf("status", args.status, STATUSES);
  if (statusError) return statusError;

  if (action === "list") {
    const response = await client.get(client.wsPath("releases"), pageParams({ cursor: args.cursor, per_page: args.per_page }));
    return envelope(response);
  }

  if (action === "create") {
    if (!name) return missing(action, "name");
    return client.post(client.wsPath("releases"), releaseBody(args, { includeExternal: true }));
  }

  if (!release_id) return missing(action, "release_id");

  if (action === "retrieve") {
    return client.get(client.wsPath(`releases/${release_id}`));
  }

  if (action === "update") {
    return client.patch(client.wsPath(`releases/${release_id}`), releaseBody(args, { includeExternal: false }));
  }

  if (action === "delete") {
    return client.del(client.wsPath(`releases/${release_id}`));
  }

  if (action === "get_changelog") {
    return client.get(client.wsPath(`releases/${release_id}/changelog`));
  }

  if (action === "update_changelog") {
    if (!description_html && !description_stripped) {
      return missing(action, "description_html or description_stripped");
    }
    const body = {};
    if (description_html) {
      body.description_html = description_html;
    } else {
      body.description_html = descriptionHtml("", description_stripped);
      body.description_json = prosemirror(description_stripped);
    }
    return client.patch(client.wsPath(`releases/${release_id}/changelog`), body);
  }

  if (action === "list_workitems") {
    const response = await client.get(
      client.wsPath(`releases/${release_id}/work-items`),
      pageParams({ cursor: args.cursor, per_page: args.per_page })
    );
    return envelope(response);
  }

  const add = coerceList(add_ids);
  const remove = coerceList(remove_ids);
  if (!add && !remove) return missing(action, "add_ids or remove_ids");
  if (add) {
    await client.post(client.wsPath(`releases/${release_id}/work-items`), { work_item_ids: add });
  }
  if (remove) {
    await client.del(client.wsPath(`releases/${release_id}/work-items`), { work_item_ids: remove });
  }
  return null;
}
