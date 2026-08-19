import { missing, opt, coerceList, pageParams, envelope } from "../toolkit.js";

export const name = "plane_customer_request";
export const title = "Customer requests";
export const summary = "Requests raised by a customer.";

export const actions = [
  { name: "list", requires: ["customer_id"], optional: ["query", "cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["customer_id", "request_id"], optional: [], read: true },
  { name: "create", requires: ["customer_id", "name"], optional: ["description_html", "link", "workitem_ids"], note: "workitem_ids can only be set here; change links afterwards with customer manage_workitems" },
  { name: "update", requires: ["customer_id", "request_id"], optional: ["name", "description_html", "link"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["customer_id", "request_id"], optional: [], destructive: true },
];

export const footer =
  "link is a URL associated with the request. workitem_ids is never echoed back -- read the " +
  "links with `plane_customer list_workitems`.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete"],
      description: "Operation to perform",
    },
    customer_id: { type: "string", description: "UUID of the customer" },
    request_id: { type: "string", description: "UUID of the request" },
    name: { type: "string", description: "Request name" },
    description_html: { type: "string", description: "HTML description" },
    link: { type: "string", description: "URL associated with the request" },
    workitem_ids: { type: "string", description: "Comma-separated work item UUIDs to link at creation" },
    query: { type: "string", description: "Search requests" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const { action, customer_id, request_id, name, description_html, link, workitem_ids } = args;

  if (!customer_id) return missing(action, "customer_id");

  if (action === "list") {
    const response = await client.get(
      client.wsPath(`customers/${customer_id}/requests`),
      pageParams({ cursor: args.cursor, per_page: args.per_page, query: args.query })
    );
    return envelope(response);
  }

  if (action === "create") {
    if (!name) return missing(action, "name");
    const body = { name };
    if (opt(description_html)) body.description_html = description_html;
    if (opt(link)) body.link = link;
    const ids = coerceList(workitem_ids);
    if (ids) body.work_item_ids = ids;
    return client.post(client.wsPath(`customers/${customer_id}/requests`), body);
  }

  if (!request_id) return missing(action, "request_id");

  if (action === "retrieve") {
    return client.get(client.wsPath(`customers/${customer_id}/requests/${request_id}`));
  }

  if (action === "update") {
    const body = {};
    if (opt(name)) body.name = name;
    if (opt(description_html)) body.description_html = description_html;
    if (opt(link)) body.link = link;
    return client.patch(client.wsPath(`customers/${customer_id}/requests/${request_id}`), body);
  }

  return client.del(client.wsPath(`customers/${customer_id}/requests/${request_id}`));
}
