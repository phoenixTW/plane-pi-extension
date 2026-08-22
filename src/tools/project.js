import { needs, opt, pageParams } from "../toolkit.js";

export const name = "plane_project";
export const title = "Projects";
export const summary = "Projects in a workspace, and the feature flags that govern them.";

export const planGate = "This project feature";

const DEFAULT_PER_PAGE = 100;

export const actions = [
  { name: "list", requires: [], optional: ["cursor", "per_page", "order_by"], note: "trimmed fields; use retrieve for full detail", read: true },
  { name: "retrieve", requires: ["project_id"], read: true },
  {
    name: "create",
    requires: ["name", "identifier"],
    optional: ["description", "project_lead", "default_assignee", "emoji", "cover_image", "timezone", "archive_in", "close_in", "external_source", "external_id"],
  },
  {
    name: "update",
    requires: ["project_id"],
    optional: ["name", "description", "identifier", "project_lead", "default_assignee", "emoji", "cover_image", "network", "timezone", "archive_in", "close_in", "default_state", "estimate", "is_time_tracking_enabled", "external_source", "external_id"],
    note: "only the fields you pass are changed",
  },
  { name: "delete", requires: ["project_id"], destructive: true },
  { name: "archive", requires: ["project_id"] },
  { name: "unarchive", requires: ["project_id"] },
  { name: "worklog_summary", requires: ["project_id"], read: true },
  { name: "get_features", requires: ["project_id"], read: true },
  {
    name: "update_features",
    requires: ["project_id"],
    optional: ["modules", "cycles", "views", "pages", "intakes", "workitem_types", "epics", "parallel_cycles", "project_updates", "workflows"],
    note: "toggles project features on or off",
  },
];

export const footer = "identifier is the short work item prefix, such as ENG. network is 0 for secret or 2 for public. project_lead and default_assignee are member ids -- get them from `plane_member list_workspace`. Feature toggles are booleans; omitted ones are left as they are.";

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: actions.map((a) => a.name), description: "Operation to perform" },
    project_id: { type: "string", description: "UUID of the project" },
    name: { type: "string", description: "Project name" },
    identifier: { type: "string", description: "Short work item prefix, such as ENG" },
    description: { type: "string", description: "Project description" },
    project_lead: { type: "string", description: "Member id of the project lead" },
    default_assignee: { type: "string", description: "Member id of the default assignee" },
    emoji: { type: "string", description: "Project emoji" },
    cover_image: { type: "string", description: "Cover image URL" },
    network: { type: ["integer", "null"], description: "0 for secret or 2 for public" },
    timezone: { type: "string", description: "IANA timezone such as Europe/Berlin" },
    archive_in: { type: "integer", description: "Days before auto-archive" },
    close_in: { type: "integer", description: "Days before auto-close" },
    default_state: { type: "string", description: "UUID of the default state" },
    estimate: { type: "string", description: "UUID of the estimate" },
    is_time_tracking_enabled: { type: ["boolean", "null"], description: "False disables, unset leaves alone" },
    external_source: { type: "string", description: "External source identifier" },
    external_id: { type: "string", description: "External id" },
    modules: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    cycles: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    views: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    pages: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    intakes: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    workitem_types: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    epics: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    parallel_cycles: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    project_updates: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    workflows: { type: ["boolean", "null"], description: "Feature toggle; false disables, unset leaves alone" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
    order_by: { type: "string", description: "Ordering, e.g. -created_at" },
  },
  required: ["action"],
};

function isValidTimezone(timezone) {
  if (!timezone) return true;
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    if (!zones || !zones.length) return true;
    return zones.includes(timezone);
  } catch {
    return true;
  }
}

const CLOUD_ONLY_FEATURES = "Error: project feature flags are Cloud-only; self-hosted Plane doesn't support this.";

export async function handler(args, plane) {
  const { client, isSelfHosted } = plane;
  const {
    action, project_id, name, identifier, description, project_lead,
    default_assignee, emoji, cover_image, network, timezone, archive_in,
    close_in, default_state, estimate, is_time_tracking_enabled,
    external_source, external_id, modules, cycles, views, pages, intakes,
    workitem_types, epics, parallel_cycles, project_updates, workflows,
    cursor, per_page, order_by,
  } = args;

  if (timezone && !isValidTimezone(timezone)) {
    return `Error: '${timezone}' is not a recognised timezone.`;
  }
  if (network !== null && network !== undefined && network !== 0 && network !== 2) {
    return "Error: network must be 0 (secret) or 2 (public).";
  }

  if (action === "list") {
    const query = pageParams({
      cursor: opt(cursor),
      per_page: opt(per_page) || DEFAULT_PER_PAGE,
      order_by: opt(order_by),
      include_archived: false,
    });
    return client.get(client.wsPath("projects-lite"), query);
  }

  if (action === "create") {
    const error = needs(action, { name, identifier });
    if (error) return error;
    const payload = Object.fromEntries(
      Object.entries({
        name,
        identifier,
        description: opt(description),
        project_lead: opt(project_lead),
        default_assignee: opt(default_assignee),
        emoji: opt(emoji),
        cover_image: opt(cover_image),
        module_view: modules,
        cycle_view: cycles,
        issue_views_view: views,
        page_view: pages,
        intake_view: intakes,
        archive_in: opt(archive_in),
        close_in: opt(close_in),
        timezone: opt(timezone),
        external_source: opt(external_source),
        external_id: opt(external_id),
        is_issue_type_enabled: workitem_types,
      }).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath("projects"), payload);
  }

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  const projectPath = client.wsPath(`projects/${project_id}`);

  if (action === "retrieve") {
    return client.get(projectPath);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries({
        name: opt(name),
        description: opt(description),
        identifier: opt(identifier),
        project_lead: opt(project_lead),
        default_assignee: opt(default_assignee),
        emoji: opt(emoji),
        cover_image: opt(cover_image),
        network,
        module_view: modules,
        cycle_view: cycles,
        issue_views_view: views,
        page_view: pages,
        intake_view: intakes,
        archive_in: opt(archive_in),
        close_in: opt(close_in),
        timezone: opt(timezone),
        external_source: opt(external_source),
        external_id: opt(external_id),
        is_issue_type_enabled: workitem_types,
        is_time_tracking_enabled,
        default_state: opt(default_state),
        estimate: opt(estimate),
      }).filter(([, v]) => v !== undefined)
    );
    return client.patch(projectPath, payload);
  }

  if (action === "delete") {
    await client.del(projectPath);
    return null;
  }

  if (action === "archive") {
    await client.post(client.wsPath(`projects/${project_id}/archive`), {});
    return null;
  }

  if (action === "unarchive") {
    await client.del(client.wsPath(`projects/${project_id}/archive`));
    return null;
  }

  if (action === "worklog_summary") {
    return client.get(client.wsPath(`projects/${project_id}/total-worklogs`));
  }

  if ((action === "get_features" || action === "update_features") && isSelfHosted) {
    return CLOUD_ONLY_FEATURES;
  }

  if (action === "get_features") {
    return client.get(client.wsPath(`projects/${project_id}/features`));
  }

  const payload = Object.fromEntries(
    Object.entries({
      modules,
      cycles,
      views,
      pages,
      intakes,
      work_item_types: workitem_types,
      epics,
      parallel_cycles,
      project_updates,
      workflows,
    }).filter(([, v]) => v !== undefined && v !== null)
  );
  return client.patch(client.wsPath(`projects/${project_id}/features`), payload);
}
