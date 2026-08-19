import { missing, needs, oneOf, opt, coerceList, pageParams, envelope } from "../toolkit.js";

export const name = "plane_customer_property";
export const title = "Customer properties";
export const summary = "Custom properties on customers.";

const PROPERTY_TYPES = ["TEXT", "DATETIME", "DECIMAL", "BOOLEAN", "OPTION", "RELATION", "URL", "EMAIL", "FILE", "FORMULA"];
const RELATION_TYPES = ["ISSUE", "USER", "RELEASE", "RICH_TEXT"];
const TEXT_FORMATS = ["single-line", "multi-line", "readonly"];
const DATE_FORMATS = ["MMM dd, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy/MM/dd"];

export const actions = [
  { name: "list", requires: [], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["property_id"], optional: [], read: true },
  { name: "create", requires: ["display_name", "property_type"], optional: ["relation_type", "description", "is_required", "is_multi", "is_active", "default_value", "options", "display_format", "external_source", "external_id"] },
  { name: "update", requires: ["property_id"], optional: ["display_name", "relation_type", "description", "is_required", "is_multi", "is_active", "default_value", "options", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["property_id"], optional: [], destructive: true },
  { name: "get_values", requires: ["customer_id"], optional: ["property_id"], note: "omit property_id to read them all", read: true },
  { name: "set_values", requires: ["customer_id", "values"], optional: [], note: "replaces the values of the properties named; others keep theirs" },
];

export const footer =
  "display_name is the user-facing label and must be unique in the workspace -- the stored " +
  "name is derived from it. " +
  `property_type is one of: ${PROPERTY_TYPES.join(", ")}. relation_type (required for RELATION) ` +
  `is one of: ${RELATION_TYPES.join(", ")}. display_format is required by TEXT ` +
  `(${TEXT_FORMATS.join(", ")}) and DATETIME (${DATE_FORMATS.join(", ")}). ` +
  'options takes a JSON array of {"name", "description", "is_default"} objects. ' +
  'values takes a JSON object of property id to a list of strings, e.g. {"<id>": ["Enterprise"]} ' +
  "-- every value is a string whatever the property type, and a single-item list unless is_multi.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete", "get_values", "set_values"],
      description: "Operation to perform",
    },
    property_id: { type: "string", description: "UUID of the customer property" },
    customer_id: { type: "string", description: "UUID of the customer" },
    display_name: { type: "string", description: "User-facing label, unique in the workspace" },
    property_type: { type: "string", enum: PROPERTY_TYPES, description: "Type of the property" },
    relation_type: { type: "string", enum: RELATION_TYPES, description: "Required for RELATION properties" },
    description: { type: "string", description: "Property description" },
    default_value: { type: "string", description: "Default value; a single string is stored as one value" },
    options: { type: "string", description: 'JSON array of {"name", "description", "is_default"} objects' },
    display_format: { type: "string", description: "Display format for TEXT and DATETIME properties" },
    values: { type: "string", description: 'JSON object of property id to list of strings' },
    is_required: { type: ["boolean", "null"], description: "Whether a value is required" },
    is_multi: { type: ["boolean", "null"], description: "Whether multiple values are allowed" },
    is_active: { type: ["boolean", "null"], description: "Whether the property is active" },
    external_source: { type: "string", description: "External system the property came from" },
    external_id: { type: "string", description: "Property's identifier in the external system" },
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

function parseJson(raw, expected) {
  try {
    const parsed = JSON.parse(raw);
    if (expected === "list" && Array.isArray(parsed)) return parsed;
    if (expected === "dict" && parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const {
    action,
    property_id,
    customer_id,
    display_name,
    property_type,
    relation_type,
    description,
    default_value,
    options,
    display_format,
    values,
    is_required,
    is_multi,
    is_active,
    external_source,
    external_id,
    cursor,
    per_page,
  } = args;

  const typeError = oneOf("property_type", property_type, PROPERTY_TYPES);
  if (typeError) return typeError;
  const relationError = oneOf("relation_type", relation_type, RELATION_TYPES);
  if (relationError) return relationError;

  if (action === "list") {
    const response = await client.get(client.wsPath("customer-properties"), pageParams({ cursor, per_page }));
    return envelope(response);
  }

  if (action === "create") {
    const absent = needs(action, { display_name, property_type });
    if (absent) return absent;
    const body = { name: display_name, display_name, property_type };
    if (opt(relation_type)) body.relation_type = relation_type;
    if (opt(description)) body.description = description;
    if (is_required !== undefined && is_required !== null) body.is_required = is_required;
    const defaults = coerceList(default_value, { split: false });
    if (defaults) body.default_value = defaults;
    const config = settings(property_type, display_format);
    if (config) body.settings = config;
    if (is_active !== undefined && is_active !== null) body.is_active = is_active;
    if (is_multi !== undefined && is_multi !== null) body.is_multi = is_multi;
    if (opt(options)) {
      const parsed = parseJson(options, "list");
      if (parsed) body.options = parsed;
    }
    if (opt(external_source)) body.external_source = external_source;
    if (opt(external_id)) body.external_id = external_id;
    return client.post(client.wsPath("customer-properties"), body);
  }

  if (action === "get_values") {
    if (!customer_id) return missing(action, "customer_id");
    if (property_id) {
      const response = await client.get(
        client.wsPath(`customers/${customer_id}/property-values/${property_id}`)
      );
      const dict = response || {};
      return { [property_id]: dict[String(property_id)] || [] };
    }
    return client.get(client.wsPath(`customers/${customer_id}/property-values`));
  }

  if (action === "set_values") {
    const absent = needs(action, { customer_id, values });
    if (absent) return absent;
    const parsed = parseJson(values, "dict");
    if (parsed === null) {
      return 'Error: values must be a JSON object, for example {"<property_id>": ["Enterprise"]}.';
    }
    await client.post(client.wsPath(`customers/${customer_id}/property-values`), {
      customer_property_values: parsed,
    });
    return null;
  }

  if (!property_id) return missing(action, "property_id");

  if (action === "retrieve") {
    return client.get(client.wsPath(`customer-properties/${property_id}`));
  }

  if (action === "update") {
    const body = {};
    if (opt(display_name)) body.display_name = display_name;
    if (opt(relation_type)) body.relation_type = relation_type;
    if (opt(description)) body.description = description;
    if (is_required !== undefined && is_required !== null) body.is_required = is_required;
    const defaults = coerceList(default_value, { split: false });
    if (defaults) body.default_value = defaults;
    if (is_active !== undefined && is_active !== null) body.is_active = is_active;
    if (opt(options)) {
      const parsed = parseJson(options, "list");
      if (parsed) body.options = parsed;
    }
    if (opt(external_source)) body.external_source = external_source;
    if (opt(external_id)) body.external_id = external_id;
    return client.patch(client.wsPath(`customer-properties/${property_id}`), body);
  }

  return client.del(client.wsPath(`customer-properties/${property_id}`));
}
