import { missing, oneOf, opt } from "../toolkit.js";

export const name = "plane_project_estimate";
export const title = "Project estimates";
export const summary = "A project's estimate system and its points.";

const TYPES = ["categories", "points", "time"];

export const actions = [
  { name: "retrieve", requires: ["project_id"], optional: [], note: "a project has at most one estimate", read: true },
  { name: "create", requires: ["project_id", "name"], optional: ["type", "description", "last_used", "external_source", "external_id"] },
  { name: "update", requires: ["project_id"], optional: ["name", "description", "external_source", "external_id"] },
  { name: "delete", requires: ["project_id"], optional: [], destructive: true },
  { name: "link", requires: ["project_id", "estimate_id"], optional: [], note: "makes that estimate the project's active one" },
  { name: "list_points", requires: ["project_id", "estimate_id"], optional: [], read: true },
  { name: "create_points", requires: ["project_id", "estimate_id", "points"], optional: [] },
  { name: "update_point", requires: ["project_id", "estimate_id", "estimate_point_id"], optional: ["value", "key", "description", "external_source", "external_id"] },
  { name: "delete_point", requires: ["project_id", "estimate_id", "estimate_point_id"], optional: [], destructive: true },
];

export const footer =
  `type is one of: ${TYPES.join(", ")}. A point's \`value\` is its display label ("5", "XL") and ` +
  'its `key` is the sort order. points takes a JSON array such as [{"value": "1", "key": 0}]. ' +
  "To set a work item's estimate: retrieve to get the estimate_id, list_points to see the " +
  "available values, then pass the chosen point's id to `plane_workitem update` as estimate_point.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["retrieve", "create", "update", "delete", "link", "list_points", "create_points", "update_point", "delete_point"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    estimate_id: { type: "string", description: "UUID of the estimate" },
    estimate_point_id: { type: "string", description: "UUID of the estimate point" },
    name: { type: "string", description: "Estimate name" },
    type: { type: "string", enum: TYPES, description: "Estimate type" },
    description: { type: "string", description: "Estimate or point description" },
    points: { type: "string", description: 'JSON array such as [{"value": "1", "key": 0}]' },
    value: { type: "string", description: "Point display label, such as 5 or XL" },
    key: { type: ["integer", "null"], description: "Point sort order; keys start at 0" },
    last_used: { type: ["boolean", "null"], description: "Whether the estimate is the last used one" },
    external_source: { type: "string", description: "External system the estimate came from" },
    external_id: { type: "string", description: "Estimate's identifier in the external system" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const {
    action,
    project_id,
    estimate_id,
    estimate_point_id,
    name,
    type,
    description,
    points,
    value,
    key,
    last_used,
    external_source,
    external_id,
  } = args;

  if (!project_id) return missing(action, "project_id");
  const typeError = oneOf("type", type, TYPES);
  if (typeError) return typeError;

  const estimatePath = client.wsPath(`projects/${project_id}/estimates`);

  if (action === "retrieve") {
    return client.get(estimatePath);
  }

  if (action === "create") {
    if (!name) return missing(action, "name");
    const body = { name };
    if (opt(type)) body.type = type;
    if (opt(description)) body.description = description;
    if (last_used !== undefined && last_used !== null) body.last_used = last_used;
    if (opt(external_id)) body.external_id = external_id;
    if (opt(external_source)) body.external_source = external_source;
    return client.post(estimatePath, body);
  }

  if (action === "update") {
    const body = {};
    if (opt(name)) body.name = name;
    if (opt(description)) body.description = description;
    if (opt(external_id)) body.external_id = external_id;
    if (opt(external_source)) body.external_source = external_source;
    return client.patch(estimatePath, body);
  }

  if (action === "delete") {
    return client.del(estimatePath);
  }

  if (!estimate_id) return missing(action, "estimate_id");

  if (action === "link") {
    return client.patch(client.wsPath(`projects/${project_id}`), { estimate: estimate_id });
  }

  const pointsPath = client.wsPath(`projects/${project_id}/estimates/${estimate_id}/estimate-points`);

  if (action === "list_points") {
    return client.get(pointsPath);
  }

  if (action === "create_points") {
    let parsed = null;
    if (points) {
      try {
        parsed = JSON.parse(points);
      } catch {
        return 'Error: points must be a JSON array, for example [{"value": "1", "key": 0}].';
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return missing(action, "points");
    return client.post(pointsPath, parsed);
  }

  if (!estimate_point_id) return missing(action, "estimate_point_id");

  if (action === "update_point") {
    const body = {};
    if (opt(value)) body.value = value;
    if (key !== undefined && key !== null) body.key = key;
    if (opt(description)) body.description = description;
    if (opt(external_id)) body.external_id = external_id;
    if (opt(external_source)) body.external_source = external_source;
    return client.patch(`${pointsPath}/${estimate_point_id}`, body);
  }

  return client.del(`${pointsPath}/${estimate_point_id}`);
}
