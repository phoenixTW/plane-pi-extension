import { opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_member";
export const title = "Members and roles";
export const summary = "Workspace and project members, and role definitions.";

export const actions = [
  { name: "me", requires: [], note: "the authenticated user", read: true },
  {
    name: "list_workspace",
    requires: [],
    optional: ["first_name", "last_name", "email", "display_name", "role_slug", "is_active", "is_bot", "cursor", "per_page", "order_by"],
    note: "name filters match case-insensitively and combine with AND",
    read: true,
  },
  { name: "list_project", requires: ["project_id"], read: true },
  { name: "list_roles", requires: [], optional: ["namespace", "cursor", "per_page"], read: true },
  { name: "retrieve_role", requires: ["role_id"], read: true },
];

export const footer = "namespace is 'workspace' (Owner/Admin/Member/Guest) or 'project' (Admin/Contributor/Commenter/Guest); omit for both. A role slug is stable but not globally unique -- key on (namespace, slug).";

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: actions.map((a) => a.name), description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    role_id: { type: "string", description: "UUID of the role" },
    namespace: { type: "string", description: "'workspace' or 'project'; omit for both" },
    first_name: { type: "string", description: "Filter by first name, case-insensitive" },
    last_name: { type: "string", description: "Filter by last name, case-insensitive" },
    email: { type: "string", description: "Filter by email" },
    display_name: { type: "string", description: "Filter by display name, case-insensitive" },
    role_slug: { type: "string", description: "Filter by role slug" },
    is_active: { type: ["boolean", "null"], description: "False filters for inactive members, unset filters neither" },
    is_bot: { type: ["boolean", "null"], description: "False filters for non-bot members, unset filters neither" },
    order_by: { type: "string", description: "Ordering, e.g. -created_at" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size, defaults to 100" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const {
    action, project_id, role_id, namespace, first_name, last_name, email,
    display_name, role_slug, is_active, is_bot, order_by, cursor, per_page,
  } = args;

  if (action === "me") {
    return client.get("users/me");
  }

  if (action === "list_workspace") {
    const asFlag = (value) => (value === null || value === undefined ? undefined : String(value));
    const query = pageParams({
      first_name: opt(first_name),
      last_name: opt(last_name),
      email: opt(email),
      display_name: opt(display_name),
      role_slug: opt(role_slug),
      is_active: asFlag(is_active),
      is_bot: asFlag(is_bot),
      cursor: opt(cursor),
      per_page: opt(per_page) || 100,
      order_by: opt(order_by),
    });
    const response = await client.get(client.wsPath("members-lite"), query);
    return envelope(response);
  }

  if (action === "list_project") {
    if (!project_id) {
      return `Error: action '${action}' requires: project_id.`;
    }
    return client.get(client.wsPath(`projects/${project_id}/project-members`));
  }

  if (action === "list_roles") {
    const query = pageParams({ namespace: opt(namespace), per_page: opt(per_page), cursor: opt(cursor) });
    return client.get(client.wsPath("roles"), query);
  }

  if (!role_id) {
    return `Error: action '${action}' requires: role_id.`;
  }
  return client.get(client.wsPath(`roles/${role_id}`));
}
