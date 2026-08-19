import { needs, opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_page";
export const title = "Pages";
export const summary = "Pages at workspace or project scope.";

export const actions = [
  { name: "list", requires: [], optional: ["project_id", "cursor", "per_page"], note: "workspace pages unless project_id is given", read: true },
  { name: "retrieve", requires: ["page_id"], optional: ["project_id"], read: true },
  { name: "create", requires: ["name", "description_html"], optional: ["project_id", "access", "color", "is_locked", "external_source", "external_id"] },
  { name: "list_workitem_pages", requires: ["project_id", "workitem_id"], read: true },
  { name: "attach_to_workitem", requires: ["project_id", "workitem_id", "page_id"] },
  { name: "detach_from_workitem", requires: ["project_id", "workitem_id", "workitem_page_id"], note: "workitem_page_id is the link id from list_workitem_pages, not the page id", destructive: true },
];

export const footer = "description_html is the page body as HTML. access is the page access level. Omit project_id to work with workspace-level pages.";

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: actions.map((a) => a.name), description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project; omit for workspace pages" },
    page_id: { type: "string", description: "UUID of the page" },
    workitem_id: { type: "string", description: "UUID of the work item" },
    workitem_page_id: { type: "string", description: "UUID of the work item page link" },
    name: { type: "string", description: "Page name" },
    description_html: { type: "string", description: "Page body as HTML" },
    access: { type: ["integer", "null"], description: "Page access level, 0 is a real level" },
    color: { type: "string", description: "Hex code such as #EF4444" },
    is_locked: { type: ["boolean", "null"], description: "False is a meaningful value, unset leaves alone" },
    external_source: { type: "string", description: "External source identifier" },
    external_id: { type: "string", description: "External id" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const {
    action, project_id, page_id, workitem_id, workitem_page_id, name,
    description_html, access, color, is_locked, external_source, external_id,
    cursor, per_page,
  } = args;

  if (action === "list") {
    const query = pageParams({ cursor, per_page });
    const path = project_id
      ? client.wsPath(`projects/${project_id}/pages`)
      : client.wsPath("pages");
    const response = await client.get(path, query);
    return envelope(response);
  }

  if (action === "retrieve") {
    if (!page_id) {
      return `Error: action '${action}' requires: page_id.`;
    }
    const path = project_id
      ? client.wsPath(`projects/${project_id}/pages/${page_id}`)
      : client.wsPath(`pages/${page_id}`);
    return client.get(path);
  }

  if (action === "create") {
    const error = needs(action, { name, description_html });
    if (error) return error;
    const payload = Object.fromEntries(
      Object.entries({
        name,
        description_html,
        access,
        color: opt(color),
        is_locked,
        external_id: opt(external_id),
        external_source: opt(external_source),
      }).filter(([, v]) => v !== undefined)
    );
    const path = project_id
      ? client.wsPath(`projects/${project_id}/pages`)
      : client.wsPath("pages");
    return client.post(path, payload);
  }

  const error = needs(action, { project_id, workitem_id });
  if (error) return error;

  const pagesPath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/pages`);

  if (action === "list_workitem_pages") {
    const response = await client.get(pagesPath);
    return response?.results || [];
  }

  if (action === "attach_to_workitem") {
    if (!page_id) {
      return `Error: action '${action}' requires: page_id.`;
    }
    return client.post(pagesPath, { page_id });
  }

  if (!workitem_page_id) {
    return `Error: action '${action}' requires: workitem_page_id.`;
  }
  await client.del(client.wsPath(`projects/${project_id}/work-items/${workitem_id}/pages/${workitem_page_id}`));
  return null;
}
