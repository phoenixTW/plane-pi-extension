import { PlaneApiError } from "../plane-client.js";
import { missing, needs, opt, coerceList, pageParams } from "../toolkit.js";

export const name = "plane_workitem_type";
export const title = "Work item types";
export const summary = "Work item types, at project or workspace scope.";
export const planGate = "Work item types";

const WORKSPACE_MANAGED = "workspace_managed";
const WORK_ITEM_TYPES_FEATURE = "work_item_types";

export const actions = [
  { name: "list", requires: [], optional: ["project_id", "cursor", "per_page"], note: "workspace scope when project_id is omitted", read: true },
  { name: "retrieve", requires: ["workitem_type_id"], optional: ["project_id"], read: true },
  { name: "resolve", requires: ["project_id", "name"], optional: [], note: "finds or creates a named type usable in the project; never duplicates" },
  { name: "create", requires: ["name"], optional: ["project_id", "description", "project_ids", "is_active", "external_source", "external_id"] },
  { name: "update", requires: ["workitem_type_id"], optional: ["project_id", "name", "description", "project_ids", "is_active", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["workitem_type_id"], optional: ["project_id"], destructive: true },
  { name: "import_to_project", requires: ["project_id", "workitem_type_ids"], optional: [], note: "links workspace types to a project" },
];

export const footer =
  "Omit project_id to work at workspace scope. A type's id is the type_id for `plane_workitem create` " +
  "and the workitem_type_id for `plane_workitem_property list`. " +
  "Prefer resolve over create when you just need a usable type such as Epic or Initiative: it " +
  "handles both modes, matches exactly (case-sensitive, whitespace-stripped) and never " +
  "duplicates. Where the workspace owns the vocabulary, creating a type on a project is " +
  "rejected and importing is the only valid path -- resolve does that for you.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "resolve", "create", "update", "delete", "import_to_project"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_type_id: { type: "string", description: "UUID of the work item type" },
    workitem_type_ids: { type: "string", description: "Comma-separated work item type UUIDs to import" },
    name: { type: "string", description: "Type name" },
    description: { type: "string", description: "Type description" },
    project_ids: { type: "string", description: "Comma-separated project UUIDs to link the type to" },
    is_active: { type: ["boolean", "null"], description: "Whether the type is active" },
    external_source: { type: "string", description: "External system the type came from" },
    external_id: { type: "string", description: "Type's identifier in the external system" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

function named(types, target) {
  return (types || []).find((t) => (t.name || "").trim() === target) || null;
}

function workspaceOwns(err, field) {
  if (!(err instanceof PlaneApiError && err.status === 400 && err.payload && typeof err.payload === "object")) {
    return false;
  }
  return err.payload.code === WORKSPACE_MANAGED || field in err.payload;
}

async function workspaceOwnsResource(client, workspaceSlug, flag) {
  const features = await client.get(client.wsPath(`${workspaceSlug}/features`));
  return Boolean(features && features[flag]);
}

async function adoptFromWorkspace(client, workspaceSlug, projectId, name, target) {
  let atWorkspace = named(
    await client.get(client.wsPath("work-item-types")),
    target
  );
  if (atWorkspace === null) {
    atWorkspace = await client.post(client.wsPath("work-item-types"), { name });
  }
  await client.post(client.wsPath(`projects/${projectId}/import-work-item-types`), {
    work_item_types: [atWorkspace.id],
  });
  return atWorkspace;
}

async function resolveType(client, workspaceSlug, projectId, name) {
  const target = name.trim();

  const inProject = named(
    await client.get(client.wsPath(`projects/${projectId}/work-item-types`)),
    target
  );
  if (inProject !== null) return inProject;

  if (await workspaceOwnsResource(client, workspaceSlug, WORK_ITEM_TYPES_FEATURE)) {
    return adoptFromWorkspace(client, workspaceSlug, projectId, name, target);
  }

  const featuresPath = client.wsPath(`projects/${projectId}/features`);
  const projectFeatures = await client.get(featuresPath);
  if (!projectFeatures || !projectFeatures[WORK_ITEM_TYPES_FEATURE]) {
    try {
      await client.patch(featuresPath, { [WORK_ITEM_TYPES_FEATURE]: true });
    } catch (err) {
      if (!workspaceOwns(err, WORK_ITEM_TYPES_FEATURE)) throw err;
      return adoptFromWorkspace(client, workspaceSlug, projectId, name, target);
    }
  }

  return client.post(client.wsPath(`projects/${projectId}/work-item-types`), { name });
}

function typeBody(args) {
  const body = {};
  if (opt(args.name)) body.name = args.name;
  if (opt(args.description)) body.description = args.description;
  const ids = coerceList(args.project_ids);
  if (ids) body.project_ids = ids;
  if (args.is_active !== undefined && args.is_active !== null) body.is_active = args.is_active;
  if (opt(args.external_source)) body.external_source = args.external_source;
  if (opt(args.external_id)) body.external_id = args.external_id;
  return body;
}

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const { action, project_id, workitem_type_id, workitem_type_ids, name } = args;

  if (action === "list") {
    if (project_id) {
      return client.get(
        client.wsPath(`projects/${project_id}/work-item-types`),
        pageParams({ cursor: args.cursor, per_page: args.per_page })
      );
    }
    return client.get(client.wsPath("work-item-types"));
  }

  if (action === "resolve") {
    const absent = needs(action, { project_id, name });
    if (absent) return absent;
    return resolveType(client, workspaceSlug, project_id, name);
  }

  if (action === "import_to_project") {
    const absent = needs(action, { project_id, workitem_type_ids });
    if (absent) return absent;
    await client.post(client.wsPath(`projects/${project_id}/import-work-item-types`), {
      work_item_types: coerceList(workitem_type_ids),
    });
    return null;
  }

  if (action === "create") {
    if (!name) return missing(action, "name");
    const body = typeBody(args);
    const path = project_id
      ? client.wsPath(`projects/${project_id}/work-item-types`)
      : client.wsPath("work-item-types");
    return client.post(path, body);
  }

  if (!workitem_type_id) return missing(action, "workitem_type_id");

  const targetPath = project_id
    ? client.wsPath(`projects/${project_id}/work-item-types/${workitem_type_id}`)
    : client.wsPath(`work-item-types/${workitem_type_id}`);

  if (action === "retrieve") {
    return client.get(targetPath);
  }

  if (action === "update") {
    return client.patch(targetPath, typeBody(args));
  }

  return client.del(targetPath);
}
