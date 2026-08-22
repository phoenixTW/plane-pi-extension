import { missing, needs, oneOf, opt, coerceList } from "../toolkit.js";

export const name = "plane_workitem_relation";
export const title = "Work item relations";
export const summary = "Relations between work items, and the definitions that type them.";

const DEPENDENCY_TYPES = [
  "blocking",
  "blocked_by",
  "start_before",
  "start_after",
  "finish_before",
  "finish_after",
];

const OTHER_RELATIONS =
  "For any other relationship pass relation_definition_id and " +
  "relation_definition_label from the list_definitions action.";

const CLOUD_ONLY_DEFINITIONS =
  "Error: custom relation definitions are Cloud-only; self-hosted Plane doesn't support this.";

const SELF_HOSTED_NO_DELETE =
  "Error: self-hosted Plane's relations API has no delete route (GET/POST only, " +
  "confirmed in v1.4.1 and preview). Remove the relation from the Plane web UI instead.";

export const actions = [
  { name: "list", requires: ["project_id", "workitem_id"], optional: [], read: true },
  { name: "create", requires: ["project_id", "workitem_id", "workitem_ids"], optional: ["relation_type", "relation_definition_id", "relation_definition_label"], note: "pass relation_type for a dependency, or definition id + label for a custom relation" },
  { name: "delete", requires: ["project_id", "workitem_id", "related_workitem_id"], optional: ["is_dependency"], note: "removes one relation; dependencies and custom relations are independent, so is_dependency must match the kind that was created (default false)", destructive: true },
  { name: "list_definitions", requires: [], optional: ["is_default", "is_active"], read: true },
  { name: "create_definition", requires: ["name"], optional: ["outward", "inward", "is_active", "color"] },
  { name: "update_definition", requires: ["definition_id"], optional: ["name", "outward", "inward", "is_active", "color"] },
  { name: "delete_definition", requires: ["definition_id"], optional: [], destructive: true },
];

export const footer =
  "Call list_definitions first and match the user's wording to an entry. A " +
  `built_in_dependencies value (${DEPENDENCY_TYPES.join(", ")}) goes in relation_type; a ` +
  "custom definition needs its id in relation_definition_id and the matched outward or " +
  "inward label in relation_definition_label, which sets direction.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "create", "delete", "list_definitions", "create_definition", "update_definition", "delete_definition"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the work item" },
    workitem_ids: { type: "string", description: "Comma-separated UUIDs of the related work items" },
    related_workitem_id: { type: "string", description: "UUID of the work item whose relation to remove" },
    relation_type: { type: "string", description: "Built-in dependency type" },
    relation_definition_id: { type: "string", description: "UUID of a custom relation definition" },
    relation_definition_label: { type: "string", description: "Outward or inward label of the definition, sets direction" },
    definition_id: { type: "string", description: "UUID of the relation definition" },
    name: { type: "string", description: "Definition name" },
    outward: { type: "string", description: "Outward label, e.g. implements" },
    inward: { type: "string", description: "Inward label, e.g. implemented by" },
    color: { type: "string", description: "Hex color such as #4E5355" },
    is_default: { type: ["boolean", "null"], description: "Filter definitions by default status" },
    is_active: { type: ["boolean", "null"], description: "Filter definitions by active status" },
    is_dependency: { type: ["boolean", "null"], description: "Delete a dependency (true) or custom relation (false, default)" },
  },
  required: ["action"],
};

async function allDefinitions(client, workspaceSlug, isDefault, isActive) {
  const results = [];
  let cursor;
  while (true) {
    const query = { per_page: 100 };
    if (isDefault !== undefined && isDefault !== null) query.is_default = String(isDefault).toLowerCase();
    if (isActive !== undefined && isActive !== null) query.is_active = String(isActive).toLowerCase();
    if (cursor) query.cursor = cursor;
    const page = await client.get(client.wsPath("work-item-relation-definitions"), query);
    results.push(...(page.results || []));
    cursor = page.next_cursor;
    if (!page.next_page_results || !cursor) return results;
  }
}

function definitionBody(args) {
  const body = {};
  if (opt(args.name)) body.name = args.name;
  if (opt(args.outward)) body.outward = args.outward;
  if (opt(args.inward)) body.inward = args.inward;
  if (args.is_active !== undefined && args.is_active !== null) body.is_active = args.is_active;
  if (opt(args.color)) body.color = args.color;
  return body;
}

export async function handler(args, plane) {
  const { client, isSelfHosted } = plane;
  const {
    action,
    project_id,
    workitem_id,
    workitem_ids,
    related_workitem_id,
    relation_type,
    relation_definition_id,
    relation_definition_label,
    definition_id,
    name,
    is_default,
    is_active,
    is_dependency,
  } = args;

  if (action === "list_definitions") {
    if (isSelfHosted) {
      return { built_in_dependencies: [...DEPENDENCY_TYPES], custom_definitions: [], note: CLOUD_ONLY_DEFINITIONS };
    }
    return {
      built_in_dependencies: [...DEPENDENCY_TYPES],
      custom_definitions: await allDefinitions(client, plane.workspaceSlug, is_default, is_active),
    };
  }

  if (["create_definition", "update_definition", "delete_definition"].includes(action)) {
    if (isSelfHosted) return CLOUD_ONLY_DEFINITIONS;
  }

  if (action === "create_definition") {
    if (!name) return missing(action, "name");
    return client.post(client.wsPath("work-item-relation-definitions"), definitionBody(args));
  }

  if (action === "update_definition" || action === "delete_definition") {
    if (!definition_id) return missing(action, "definition_id");
    const path = client.wsPath(`work-item-relation-definitions/${definition_id}`);
    if (action === "update_definition") {
      return client.patch(path, definitionBody(args));
    }
    return client.del(path);
  }

  if (action === "delete" && isSelfHosted) return SELF_HOSTED_NO_DELETE;

  const absent = needs(action, { project_id, workitem_id });
  if (absent) return absent;

  const basePath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}`);

  if (action === "list") {
    if (isSelfHosted) return client.get(`${basePath}/relations`);
    const dependencies = await client.get(`${basePath}/dependencies`);
    const custom = await client.get(`${basePath}/work-item-relations`);
    return { dependencies, custom };
  }

  if (action === "create") {
    const targets = coerceList(workitem_ids);
    if (!targets) return missing(action, "workitem_ids");
    if (relation_type) {
      const typeError = oneOf("relation_type", relation_type, DEPENDENCY_TYPES, OTHER_RELATIONS);
      if (typeError) return typeError;
      if (isSelfHosted) {
        return client.post(`${basePath}/relations`, { relation_type: relation_type, issues: targets });
      }
      return client.post(`${basePath}/dependencies`, {
        relation_type: relation_type,
        work_item_ids: targets,
      });
    }
    if (relation_definition_id && relation_definition_label) {
      if (isSelfHosted) return CLOUD_ONLY_DEFINITIONS;
      return client.post(`${basePath}/work-item-relations`, {
        relation_definition_id: relation_definition_id,
        relation_definition_type: relation_definition_label,
        work_item_ids: targets,
      });
    }
    return (
      "Error: provide relation_type for a built-in dependency, or both " +
      "relation_definition_id and relation_definition_label for a custom relation. " +
      "Call the list_definitions action to find one."
    );
  }

  if (!related_workitem_id) return missing(action, "related_workitem_id");
  const suffix = is_dependency ? "dependencies" : "work-item-relations";
  return client.del(`${basePath}/${suffix}/${related_workitem_id}`);
}
