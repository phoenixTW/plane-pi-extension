import { missing, needs, opt, coerceList, pageParams, envelope } from "../toolkit.js";

export const name = "plane_release_label";
export const title = "Release labels";
export const summary = "Release labels, workspace palette and per release.";

export const actions = [
  { name: "list", requires: [], optional: ["release_id", "cursor", "per_page"], note: "the workspace palette unless release_id is given", read: true },
  { name: "create", requires: ["name"], optional: ["color", "sort_order"], note: "adds to the workspace palette" },
  { name: "update", requires: ["label_id"], optional: ["name", "color", "sort_order"] },
  { name: "delete", requires: ["label_id"], optional: [], note: "removes it from the palette entirely", destructive: true },
  { name: "attach", requires: ["release_id", "label_ids"], optional: [], note: "returns nothing, read back with list" },
  { name: "detach", requires: ["release_id", "label_ids"], optional: [], note: "returns nothing, read back with list", destructive: true },
];

export const footer =
  "color is a hex code such as #4E5355. label_ids takes palette label ids. Detaching a label " +
  "leaves it in the palette; delete removes it for everyone.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "create", "update", "delete", "attach", "detach"],
      description: "Operation to perform",
    },
    release_id: { type: "string", description: "UUID of the release (list, attach, detach)" },
    label_id: { type: "string", description: "UUID of the palette label (update, delete)" },
    label_ids: { type: "string", description: "Comma-separated palette label UUIDs (attach, detach)" },
    name: { type: "string", description: "Label name" },
    color: { type: "string", description: "Hex color such as #4E5355" },
    sort_order: { type: ["integer", "null"], description: "Sort position; 0 is a real position" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, release_id, label_id, label_ids, name, color, sort_order } = args;

  if (action === "list") {
    const params = pageParams({ cursor: args.cursor, per_page: args.per_page });
    const path = release_id ? client.wsPath(`releases/${release_id}/labels`) : client.wsPath("releases/labels");
    const response = await client.get(path, params);
    return envelope(response);
  }

  if (action === "create") {
    if (!name) return missing(action, "name");
    const body = { name };
    if (opt(color)) body.color = color;
    if (sort_order !== undefined && sort_order !== null) body.sort_order = sort_order;
    return client.post(client.wsPath("releases/labels"), body);
  }

  if (action === "update" || action === "delete") {
    if (!label_id) return missing(action, "label_id");
    if (action === "update") {
      const body = {};
      if (opt(name)) body.name = name;
      if (opt(color)) body.color = color;
      if (sort_order !== undefined && sort_order !== null) body.sort_order = sort_order;
      return client.patch(client.wsPath(`releases/labels/${label_id}`), body);
    }
    return client.del(client.wsPath(`releases/labels/${label_id}`));
  }

  const ids = coerceList(label_ids);
  const absent = needs(action, { release_id, label_ids });
  if (absent) return absent;

  if (action === "attach") {
    return client.post(client.wsPath(`releases/${release_id}/labels`), { label_ids: ids });
  }
  return client.del(client.wsPath(`releases/${release_id}/labels`), { label_ids: ids });
}
