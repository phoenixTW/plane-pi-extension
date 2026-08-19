import {
  needs,
  oneOf,
  opt,
  coerceList,
  pageParams,
  envelope,
  pqlFailure,
  descriptionHtml,
} from "../toolkit.js";

export const name = "plane_workitem";
export const title = "Work items";
export const summary = "Work items -- issues, tasks and epics.";

const PRIORITIES = ["urgent", "high", "medium", "low", "none"];

const GROUP_BY_VALUES = [
  "state_id",
  "state__group",
  "priority",
  "project_id",
  "type_id",
  "labels__id",
  "assignees__id",
  "issue_module__module_id",
  "release_work_items__release_id",
  "cycle_id",
  "milestone_id",
  "created_by",
  "target_date",
  "start_date",
];

const WRITE_FIELDS = [
  "name",
  "assignees",
  "labels",
  "type_id",
  "point",
  "description_html",
  "description_stripped",
  "priority",
  "start_date",
  "target_date",
  "sort_order",
  "is_draft",
  "parent",
  "state",
  "estimate_point",
  "external_source",
  "external_id",
];

const QUERY_FIELDS = ["order_by", "per_page", "cursor", "expand", "fields", "external_id", "external_source"];

export const actions = [
  { name: "list", requires: [], optional: ["project_id", "pql", ...QUERY_FIELDS], note: "omit project_id to search the whole workspace", read: true },
  { name: "list_archived", requires: ["project_id"], optional: ["pql", ...QUERY_FIELDS], read: true },
  { name: "retrieve", requires: ["project_id", "workitem_id"], optional: ["expand", "fields", "external_id", "external_source", "order_by"], read: true },
  { name: "retrieve_by_identifier", requires: ["workitem_identifier"], optional: ["expand", "fields", "external_id", "external_source", "order_by"], note: "identifier is PROJECT-N, e.g. ENG-42", read: true },
  { name: "search", requires: ["query"], optional: ["expand", "fields", "external_id", "external_source", "order_by"], read: true },
  { name: "count", requires: [], optional: ["project_id", "pql", "group_by", "sub_group_by"], note: "counts the whole workspace unless project_id narrows it", read: true },
  { name: "create", requires: ["project_id", "name"], optional: WRITE_FIELDS.slice(1) },
  { name: "update", requires: ["project_id", "workitem_id"], optional: WRITE_FIELDS, note: "only the fields you pass are changed" },
  { name: "delete", requires: ["project_id", "workitem_id"], destructive: true },
  { name: "archive", requires: ["project_id", "workitem_id"], optional: ["archive"], note: "archive defaults to true; pass archive=false to unarchive. Only completed or cancelled items can be archived" },
  { name: "manage_assignee", requires: ["project_id", "workitem_id"], optional: ["add_user_id", "remove_user_id"], note: "each takes one id or several; the list is merged, not replaced, and removals apply first" },
  { name: "manage_label", requires: ["project_id", "workitem_id"], optional: ["add_label_id", "remove_label_id"], note: "each takes one id or several; the list is merged, not replaced, and removals apply first" },
];

export const footer = [
  `priority: ${PRIORITIES.join(", ")}.`,
  "UUID fields (assignees, labels, state, parent, type_id) need UUIDs -- list the relevant resource first if you only have a name.",
  "description_stripped is plain text and is wrapped into HTML on save; description_html wins if both are given.",
  "fields is a sparse fieldset: use `project`, not project_id, and `description_html`, not description.",
  `count group_by and sub_group_by accept: ${GROUP_BY_VALUES.join(", ")}. These are grouping keys only -- they are not PQL filter fields, and filtering on state__group is rejected.`,
].join("\n");

const param = (description) => ({ type: "string", description });
const intParam = (description) => ({ type: "integer", description });
const numParam = (description) => ({ type: "number", description });
const triBool = (description) => ({ type: ["boolean", "null"], description });

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: actions.map((a) => a.name),
      description: "Operation to perform",
    },
    project_id: param("UUID of the project"),
    workitem_id: param("UUID of the work item"),
    workitem_identifier: param("Work item identifier, e.g. ENG-42"),
    query: param("Search query for the search action"),
    pql: { type: "string", description: "Plane Query Language filter, e.g. state__group = \"started\" AND priority = \"urgent\"" },
    group_by: param("Grouping key for count"),
    sub_group_by: param("Sub-grouping key for count, needs group_by"),
    name: param("Work item name"),
    assignees: { type: ["array", "string"], items: { type: "string" }, description: "Assignee UUIDs" },
    labels: { type: ["array", "string"], items: { type: "string" }, description: "Label UUIDs" },
    type_id: param("UUID of the work item type"),
    point: intParam("Estimate point number"),
    description_html: param("HTML description; wins over description_stripped"),
    description_stripped: param("Plain-text description, wrapped into HTML on save"),
    priority: param(`One of: ${PRIORITIES.join(", ")}`),
    start_date: param("Start date, YYYY-MM-DD"),
    target_date: param("Target date, YYYY-MM-DD"),
    sort_order: numParam("Sort order"),
    parent: param("UUID of the parent work item"),
    state: param("UUID of the state"),
    estimate_point: param("UUID of the estimate point"),
    add_user_id: param("Assignee UUID(s) to add, one or several"),
    remove_user_id: param("Assignee UUID(s) to remove, one or several"),
    add_label_id: param("Label UUID(s) to add, one or several"),
    remove_label_id: param("Label UUID(s) to remove, one or several"),
    external_source: param("External source identifier"),
    external_id: param("External id"),
    order_by: param("Ordering, e.g. -created_at"),
    expand: param("Related objects to expand, comma-separated"),
    fields: param("Sparse fieldset, comma-separated"),
    cursor: param("Pagination cursor from a previous page"),
    per_page: intParam("Page size"),
    is_draft: triBool("False publishes a draft, unset leaves the flag alone"),
    archive: { type: "boolean", description: "True archives, false unarchives" },
  },
  required: ["action"],
};

function scopedPql(pql, projectId) {
  if (!projectId) return pql;
  const scope = `project = "${projectId}"`;
  return pql ? `(${pql}) AND ${scope}` : scope;
}

function idsOf(items) {
  return (items || [])
    .map((item) => (typeof item === "string" ? item : item?.id))
    .filter(Boolean)
    .map(String);
}

export async function handler(args, plane) {
  const { client } = plane;
  const {
    action, project_id, workitem_id, workitem_identifier, query, pql,
    group_by, sub_group_by, name, assignees, labels, type_id, point,
    description_html, description_stripped, priority, start_date, target_date,
    sort_order, parent, state, estimate_point, add_user_id, remove_user_id,
    add_label_id, remove_label_id, external_source, external_id, order_by,
    expand, fields, cursor, per_page, is_draft, archive,
  } = args;

  let error;
  if ((error = oneOf("priority", priority, PRIORITIES))) return error;
  if ((error = oneOf("group_by", group_by, GROUP_BY_VALUES))) return error;
  if ((error = oneOf("sub_group_by", sub_group_by, GROUP_BY_VALUES))) return error;

  const retrieveParams = pageParams({
    expand: opt(expand),
    fields: opt(fields),
    external_id: opt(external_id),
    external_source: opt(external_source),
    order_by: opt(order_by),
  });

  const writePayload = () => ({
    name: opt(name),
    assignees: coerceList(assignees),
    labels: coerceList(labels),
    type_id: opt(type_id),
    point: opt(point),
    description_html: descriptionHtml(description_html, description_stripped),
    priority: opt(priority),
    start_date: opt(start_date),
    target_date: opt(target_date),
    sort_order: opt(sort_order),
    is_draft,
    external_source: opt(external_source),
    external_id: opt(external_id),
    parent: opt(parent),
    state: opt(state),
    estimate_point: opt(estimate_point),
  });

  if (action === "list" || action === "list_archived") {
    if (action === "list_archived" && !project_id) {
      return `Error: action '${action}' requires: project_id.`;
    }
    const params = pageParams({
      pql: opt(pql),
      order_by: opt(order_by),
      per_page: opt(per_page),
      cursor: opt(cursor),
      expand: opt(expand),
      fields: opt(fields),
      external_id: opt(external_id),
      external_source: opt(external_source),
    });
    let path;
    if (action === "list_archived") {
      path = client.wsPath(`projects/${project_id}/archived-work-items`);
    } else if (project_id) {
      path = client.wsPath(`projects/${project_id}/work-items`);
    } else {
      path = client.wsPath("work-items");
    }
    try {
      const response = await client.get(path, params);
      return envelope(response, opt(fields));
    } catch (err) {
      const failure = pqlFailure("plane_workitem", action, pql, err);
      if (failure) return failure;
      throw err;
    }
  }

  if (action === "count") {
    const scoped = scopedPql(pql, project_id);
    const params = pageParams({ pql: opt(scoped), group_by: opt(group_by), sub_group_by: opt(sub_group_by) });
    try {
      return await client.get(client.wsPath("work-items/count"), params);
    } catch (err) {
      const failure = pqlFailure("plane_workitem", action, scoped, err);
      if (failure) return failure;
      throw err;
    }
  }

  if (action === "search") {
    if ((error = needs(action, { query }))) return error;
    return client.get(client.wsPath("work-items/search"), { search: query, ...retrieveParams });
  }

  if (action === "retrieve_by_identifier") {
    if ((error = needs(action, { workitem_identifier }))) return error;
    const idx = workitem_identifier.lastIndexOf("-");
    const head = workitem_identifier.slice(0, idx);
    const sequence = workitem_identifier.slice(idx + 1);
    if (!head || !/^\d+$/.test(sequence)) {
      return `Error: invalid work item identifier '${workitem_identifier}'. Expected PROJECT-N, for example ENG-42.`;
    }
    return client.get(client.wsPath(`work-items/${head}-${parseInt(sequence, 10)}`), retrieveParams);
  }

  if (!project_id) {
    return `Error: action '${action}' requires: project_id.`;
  }

  if (action === "create") {
    if ((error = needs(action, { name }))) return error;
    const payload = Object.fromEntries(
      Object.entries(writePayload()).filter(([, v]) => v !== undefined)
    );
    return client.post(client.wsPath(`projects/${project_id}/work-items`), payload);
  }

  if (!workitem_id) {
    return `Error: action '${action}' requires: workitem_id.`;
  }

  const itemPath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}`);

  if (action === "retrieve") {
    return client.get(itemPath, retrieveParams);
  }

  if (action === "update") {
    const payload = Object.fromEntries(
      Object.entries(writePayload()).filter(([, v]) => v !== undefined)
    );
    return client.patch(itemPath, payload);
  }

  if (action === "delete") {
    await client.del(itemPath);
    return null;
  }

  if (action === "archive") {
    if (archive === false) {
      await client.del(client.wsPath(`projects/${project_id}/work-items/${workitem_id}/unarchive`));
    } else {
      await client.post(client.wsPath(`projects/${project_id}/work-items/${workitem_id}/archive`), {});
    }
    return { workitem_id, archived: archive !== false };
  }

  const isAssignee = action === "manage_assignee";
  const add = isAssignee ? add_user_id : add_label_id;
  const remove = isAssignee ? remove_user_id : remove_label_id;
  const field = isAssignee ? "assignees" : "labels";
  if (!add && !remove) {
    const stem = field.slice(0, -1);
    return `Error: action '${action}' requires: add_${stem}_id or remove_${stem}_id.`;
  }
  const adding = coerceList(add) || [];
  const removing = coerceList(remove) || [];
  const current = await client.get(itemPath);
  let ids = idsOf(current?.[field]).filter((value) => !removing.includes(value));
  for (const value of adding) {
    if (!ids.includes(value)) ids = [...ids, value];
  }
  return client.patch(itemPath, { [field]: ids });
}
