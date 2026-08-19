import { PlaneApiError } from "../plane-client.js";
import { missing, needs, oneOf, opt, coerceList, pageParams } from "../toolkit.js";

export const name = "plane_workitem_property";
export const title = "Work item properties";
export const summary = "Custom work item properties: their definitions, options, and values.";
export const planGate = "Work item properties";

const PROPERTY_TYPES = ["TEXT", "DATETIME", "DECIMAL", "BOOLEAN", "OPTION", "RELATION", "URL", "EMAIL", "FILE", "FORMULA"];
const RELATION_TYPES = ["ISSUE", "USER", "RELEASE", "RICH_TEXT"];
const TEXT_FORMATS = ["single-line", "multi-line", "readonly"];
const DATE_FORMATS = ["MMM dd, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy/MM/dd"];

const WORKSPACE_MANAGED = "workspace_managed";

export const actions = [
  { name: "list", requires: [], optional: ["project_id", "workitem_type_id", "cursor", "per_page"], note: "no ids lists every workspace property in one call -- the fast path for PQL", read: true },
  { name: "retrieve", requires: ["workitem_property_id"], optional: ["project_id", "workitem_type_id"], read: true },
  { name: "create", requires: ["display_name", "property_type"], optional: ["project_id", "workitem_type_id", "description", "relation_type", "is_required", "is_multi", "is_active", "default_value", "options", "display_format", "external_source", "external_id"] },
  { name: "update", requires: ["workitem_property_id"], optional: ["project_id", "workitem_type_id", "display_name", "property_type", "description", "relation_type", "is_required", "is_multi", "is_active", "default_value", "display_format", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["workitem_property_id"], optional: ["project_id", "workitem_type_id"], destructive: true },
  { name: "manage_type_properties", requires: ["workitem_type_id"], optional: ["project_id", "attach_ids", "detach_ids"], note: "omit project_id where the workspace owns types; detach removes the association only, it does not delete the property" },
  { name: "list_options", requires: ["property_id"], optional: ["project_id"], read: true },
  { name: "retrieve_option", requires: ["property_id", "option_id"], optional: ["project_id"], read: true },
  { name: "create_option", requires: ["property_id", "name"], optional: ["project_id", "description", "color", "is_default", "external_source", "external_id"] },
  { name: "update_option", requires: ["property_id", "option_id"], optional: ["project_id", "name", "description", "color", "is_default", "external_source", "external_id"] },
  { name: "delete_option", requires: ["property_id", "option_id"], optional: ["project_id"], destructive: true },
  { name: "get_value", requires: ["project_id", "workitem_id", "property_id"], optional: [], read: true },
  { name: "set_value", requires: ["project_id", "workitem_id", "property_id", "value"], optional: ["external_source", "external_id"], note: "upsert; for a multi-value property this replaces every existing value" },
  { name: "delete_value", requires: ["project_id", "workitem_id", "property_id"], optional: [], destructive: true },
];

export const footer =
  `property_type is one of: ${PROPERTY_TYPES.join(", ")}. ` +
  `relation_type (for RELATION properties) is one of: ${RELATION_TYPES.join(", ")}. ` +
  'A property id is what goes in a PQL cf["<id>"] filter; for OPTION properties the value is an option id. ' +
  'options takes a JSON array of {"name", "color", "is_default"} objects. ' +
  `display_format is required by TEXT (${TEXT_FORMATS.join(", ")}) and ` +
  `DATETIME (${DATE_FORMATS.join(", ")}) properties. ` +
  "A property lives with its type: where the workspace owns types, pass workitem_type_id " +
  "without project_id and it is created in the workspace catalogue and associated for you. " +
  "list resolves scope in this order: project_id + workitem_type_id is type-scoped (falling " +
  "back to project-flat then workspace when empty), project_id alone is every property in the " +
  "project, and neither is every workspace property. To filter by property name in PQL, call " +
  "list with no ids -- one workspace-wide fetch beats iterating types -- then match " +
  "display_name in memory to get the id for a cf[] condition. " +
  "The *_value actions read and write a property on one work item: pass value in the type the " +
  "property expects -- TEXT/URL/EMAIL/FILE as a string; DATETIME as a YYYY-MM-DD or " +
  "YYYY-MM-DD HH:MM:SS string; DECIMAL as a number; BOOLEAN as true or false; OPTION and " +
  "RELATION as an option or record id string, or an array of them when the property is " +
  'multi-value. Send the value\'s own type, not a stringified form: "007" stays the text 007, ' +
  "whereas 7 is the number.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: [
        "list",
        "retrieve",
        "create",
        "update",
        "delete",
        "manage_type_properties",
        "list_options",
        "retrieve_option",
        "create_option",
        "update_option",
        "delete_option",
        "get_value",
        "set_value",
        "delete_value",
      ],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the work item (*_value actions)" },
    workitem_type_id: { type: "string", description: "UUID of the work item type" },
    workitem_property_id: { type: "string", description: "UUID of the work item property" },
    property_id: { type: "string", description: "UUID of the property (options and values)" },
    option_id: { type: "string", description: "UUID of the property option" },
    display_name: { type: "string", description: "User-facing label, unique in scope" },
    property_type: { type: "string", enum: PROPERTY_TYPES, description: "Type of the property" },
    relation_type: { type: "string", enum: RELATION_TYPES, description: "Required for RELATION properties" },
    description: { type: "string", description: "Property or option description" },
    name: { type: "string", description: "Option name" },
    color: { type: "string", description: "Hex color such as #4E5355" },
    default_value: { type: "string", description: "Default value; a single string is stored as one value" },
    options: { type: "string", description: 'JSON array of {"name", "color", "is_default"} objects' },
    display_format: { type: "string", description: "Display format for TEXT and DATETIME properties" },
    value: { type: ["string", "boolean", "integer", "number", "array", "object"], description: "Value to set, in the type the property expects" },
    attach_ids: { type: "string", description: "Comma-separated property UUIDs to attach to the type" },
    detach_ids: { type: "string", description: "Comma-separated property UUIDs to detach from the type" },
    is_required: { type: ["boolean", "null"], description: "Whether a value is required" },
    is_multi: { type: ["boolean", "null"], description: "Whether multiple values are allowed" },
    is_active: { type: ["boolean", "null"], description: "Whether the property is active" },
    is_default: { type: ["boolean", "null"], description: "Whether an option is the default" },
    external_source: { type: "string", description: "External system the record came from" },
    external_id: { type: "string", description: "Record's identifier in the external system" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

function settings(propertyType, displayFormat) {
  if (propertyType === "TEXT") {
    return { display_format: displayFormat || "single-line" };
  }
  if (propertyType === "DATETIME") {
    return { display_format: displayFormat || "MMM dd, yyyy" };
  }
  return undefined;
}

const OPTIONS_SHAPE = 'options must be a JSON array of {"name", "color", "is_default"} objects';

function parseOptions(options) {
  if (!options) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(options);
  } catch (err) {
    throw new Error(`Error: ${OPTIONS_SHAPE}; it is not valid JSON (${err.message}).`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Error: ${OPTIONS_SHAPE}; got ${Array.isArray(parsed) ? "array" : typeof parsed}.`);
  }
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !item.name) {
      throw new Error(`Error: ${OPTIONS_SHAPE}; one entry is unusable.`);
    }
  }
  return parsed;
}

function isAbsent(err) {
  return err instanceof PlaneApiError && err.status === 404;
}

function workspaceOwns(err) {
  return (
    err instanceof PlaneApiError &&
    err.status === 400 &&
    err.payload &&
    typeof err.payload === "object" &&
    err.payload.code === WORKSPACE_MANAGED
  );
}

function propertyBody(args, { isCreate }) {
  const body = {};
  if (isCreate) {
    body.display_name = args.display_name;
    body.property_type = args.property_type;
  } else {
    if (opt(args.display_name)) body.display_name = args.display_name;
    if (opt(args.property_type)) body.property_type = args.property_type;
  }
  if (opt(args.relation_type)) body.relation_type = args.relation_type;
  if (opt(args.description)) body.description = args.description;
  if (args.is_required !== undefined && args.is_required !== null) body.is_required = args.is_required;
  const defaults = coerceList(args.default_value, { split: false });
  if (defaults) body.default_value = defaults;
  const config = settings(args.property_type, args.display_format);
  if (config) body.settings = config;
  if (args.is_active !== undefined && args.is_active !== null) body.is_active = args.is_active;
  if (args.is_multi !== undefined && args.is_multi !== null) body.is_multi = args.is_multi;
  if (opt(args.external_source)) body.external_source = args.external_source;
  if (opt(args.external_id)) body.external_id = args.external_id;
  return body;
}

async function linkToType(client, workspaceSlug, typeId, propertyIds) {
  await client.post(client.wsPath(`work-item-types/${typeId}/properties`), { properties: propertyIds });
}

async function workspacePropsForType(client, workspaceSlug, typeId) {
  let propertyIds;
  try {
    propertyIds = await client.get(client.wsPath(`work-item-types/${typeId}/properties`));
  } catch (err) {
    if (isAbsent(err)) return [];
    throw err;
  }
  if (!propertyIds || propertyIds.length === 0) return [];
  const wanted = new Set(propertyIds.map(String));
  const everything = await client.get(client.wsPath("work-item-properties"));
  return (everything || []).filter((p) => wanted.has(String(p.id)));
}

async function createAtWorkspace(client, workspaceSlug, typeId, body) {
  if (body.is_active === undefined) body.is_active = true;
  const created = await client.post(client.wsPath("work-item-properties"), body);
  await linkToType(client, workspaceSlug, typeId, [String(created.id)]);
  return created;
}

async function manageWorkspaceLinks(client, workspaceSlug, typeId, attach, detach) {
  if (attach) await linkToType(client, workspaceSlug, typeId, attach);
  for (const one of detach || []) {
    await client.del(client.wsPath(`work-item-types/${typeId}/properties/${one}`));
  }
  return attach;
}

async function manageProjectLinks(client, workspaceSlug, projectId, typeId, attach, detach) {
  let attached;
  if (attach) {
    attached = await client.post(
      client.wsPath(`projects/${projectId}/work-item-types/${typeId}/properties`),
      { properties: attach }
    );
  }
  for (const one of detach || []) {
    await client.del(
      client.wsPath(`projects/${projectId}/work-item-types/${typeId}/properties/${one}`)
    );
  }
  return attached;
}

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const {
    action,
    project_id,
    workitem_id,
    workitem_type_id,
    workitem_property_id,
    property_id,
    option_id,
    display_name,
    property_type,
    relation_type,
    description,
    name,
    color,
    default_value,
    options,
    value,
    attach_ids,
    detach_ids,
    is_default,
    external_source,
    external_id,
    cursor,
    per_page,
  } = args;

  const typeError = oneOf("property_type", property_type, PROPERTY_TYPES);
  if (typeError) return typeError;
  const relationError = oneOf("relation_type", relation_type, RELATION_TYPES);
  if (relationError) return relationError;

  if (action.endsWith("_value")) {
    const absent = needs(action, { project_id, workitem_id, property_id });
    if (absent) return absent;
    const valuesPath = client.wsPath(
      `projects/${project_id}/work-items/${workitem_id}/work-item-properties/${property_id}/values`
    );
    if (action === "get_value") {
      return client.get(valuesPath);
    }
    if (action === "set_value") {
      if (value === "" || value === undefined) return missing(action, "value");
      const body = { value };
      if (opt(external_id)) body.external_id = external_id;
      if (opt(external_source)) body.external_source = external_source;
      return client.post(valuesPath, body);
    }
    return client.del(valuesPath);
  }

  if (action === "list") {
    if (!workitem_type_id && !project_id) {
      return client.get(client.wsPath("work-item-properties"));
    }
    if (!project_id) {
      return workspacePropsForType(client, workspaceSlug, workitem_type_id);
    }
    const params = pageParams({ cursor, per_page });
    if (!workitem_type_id) {
      try {
        return await client.get(client.wsPath(`projects/${project_id}/work-item-properties`), params);
      } catch (err) {
        if (isAbsent(err)) return [];
        throw err;
      }
    }
    const scoped = await client.get(
      client.wsPath(`projects/${project_id}/work-item-types/${workitem_type_id}/work-item-properties`),
      params
    );
    if (scoped && scoped.length > 0) return scoped;
    try {
      const flat = await client.get(client.wsPath(`projects/${project_id}/work-item-properties`), params);
      if (flat && flat.length > 0) return flat;
    } catch (err) {
      if (!isAbsent(err)) throw err;
    }
    return workspacePropsForType(client, workspaceSlug, workitem_type_id);
  }

  if (action === "create") {
    const absent = needs(action, { display_name, property_type });
    if (absent) return absent;
    let parsedOptions;
    try {
      parsedOptions = parseOptions(options);
    } catch (err) {
      return err.message;
    }
    const body = propertyBody(args, { isCreate: true });
    if (parsedOptions) body.options = parsedOptions;
    if (workitem_type_id && !project_id) {
      return createAtWorkspace(client, workspaceSlug, workitem_type_id, body);
    }
    const createPath = project_id && workitem_type_id
      ? client.wsPath(`projects/${project_id}/work-item-types/${workitem_type_id}/work-item-properties`)
      : client.wsPath(`projects/${project_id}/work-item-properties`);
    try {
      return await client.post(createPath, body);
    } catch (err) {
      if (!(workitem_type_id && workspaceOwns(err))) throw err;
      return createAtWorkspace(client, workspaceSlug, workitem_type_id, body);
    }
  }

  if (action === "manage_type_properties") {
    const attach = coerceList(attach_ids);
    const detach = coerceList(detach_ids);
    const absent = needs(action, { workitem_type_id });
    if (absent) return absent;
    if (!attach && !detach) return missing(action, "attach_ids or detach_ids");
    if (!project_id) {
      return manageWorkspaceLinks(client, workspaceSlug, workitem_type_id, attach, detach);
    }
    try {
      return await manageProjectLinks(client, workspaceSlug, project_id, workitem_type_id, attach, detach);
    } catch (err) {
      if (!workspaceOwns(err)) throw err;
      return manageWorkspaceLinks(client, workspaceSlug, workitem_type_id, attach, detach);
    }
  }

  if (action === "retrieve" || action === "update" || action === "delete") {
    if (!workitem_property_id) return missing(action, "workitem_property_id");
    const targetPath = project_id && workitem_type_id
      ? client.wsPath(`projects/${project_id}/work-item-types/${workitem_type_id}/work-item-properties/${workitem_property_id}`)
      : project_id
        ? client.wsPath(`projects/${project_id}/work-item-properties/${workitem_property_id}`)
        : client.wsPath(`work-item-properties/${workitem_property_id}`);
    if (action === "retrieve") {
      return client.get(targetPath);
    }
    if (action === "update") {
      return client.patch(targetPath, propertyBody(args, { isCreate: false }));
    }
    return client.del(targetPath);
  }

  if (!property_id) return missing(action, "property_id");

  const optionsPath = project_id
    ? client.wsPath(`projects/${project_id}/work-item-properties/${property_id}/options`)
    : client.wsPath(`work-item-properties/${property_id}/options`);

  if (action === "list_options") {
    if (project_id) {
      return client.get(optionsPath, pageParams({ cursor, per_page }));
    }
    return client.get(optionsPath);
  }

  if (action === "create_option") {
    if (!name) return missing(action, "name");
    const body = { name };
    if (opt(description)) body.description = description;
    if (opt(color)) body.color = color;
    if (is_default !== undefined && is_default !== null) body.is_default = is_default;
    if (opt(external_source)) body.external_source = external_source;
    if (opt(external_id)) body.external_id = external_id;
    return client.post(optionsPath, body);
  }

  if (!option_id) return missing(action, "option_id");

  const optionPath = `${optionsPath}/${option_id}`;

  if (action === "retrieve_option") {
    return client.get(optionPath);
  }

  if (action === "update_option") {
    const body = {};
    if (opt(name)) body.name = name;
    if (opt(description)) body.description = description;
    if (opt(color)) body.color = color;
    if (is_default !== undefined && is_default !== null) body.is_default = is_default;
    if (opt(external_source)) body.external_source = external_source;
    if (opt(external_id)) body.external_id = external_id;
    return client.patch(optionPath, body);
  }

  return client.del(optionPath);
}
