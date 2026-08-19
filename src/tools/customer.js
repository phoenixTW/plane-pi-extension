import { missing, opt, coerceList, pageParams, envelope } from "../toolkit.js";

export const name = "plane_customer";
export const title = "Customers";
export const summary = "Customers in the workspace.";

const STAGES = ["lead", "sales_qualified_lead", "contract_negotiation", "closed_won", "closed_lost"];
const CONTRACT_STATUSES = ["active", "pre_contract", "signed", "inactive"];

export const actions = [
  { name: "list", requires: [], optional: ["query", "cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["customer_id"], optional: [], read: true },
  { name: "create", requires: ["name"], optional: ["description_html", "email", "website_url", "domain", "employees", "stage", "contract_status", "revenue", "external_source", "external_id"], note: "upsert: matches on external_source + external_id, else on name, so it never duplicates" },
  { name: "update", requires: ["customer_id"], optional: ["name", "description_html", "email", "website_url", "domain", "employees", "stage", "contract_status", "revenue", "external_source", "external_id"], note: "only the fields you pass are changed" },
  { name: "delete", requires: [], optional: ["customer_id", "external_source", "external_id"], note: "address by customer_id, or by external_source plus external_id", destructive: true },
  { name: "list_workitems", requires: ["customer_id"], optional: ["customer_request_id", "search"], read: true },
  { name: "manage_workitems", requires: ["customer_id"], optional: ["link_ids", "unlink_ids", "customer_request_id"], note: "pass at least one of link_ids or unlink_ids; returns nothing, read back with list_workitems" },
];

export const footer =
  'domain is the customer\'s industry, shown as "Industry" in Plane -- the website goes in ' +
  `website_url. stage renders as one of: ${STAGES.join(", ")}. contract_status renders as one ` +
  `of: ${CONTRACT_STATUSES.join(", ")}. Both are stored free-form; anything else is kept but ` +
  "not displayed. revenue is annual revenue as a string.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete", "list_workitems", "manage_workitems"],
      description: "Operation to perform",
    },
    customer_id: { type: "string", description: "UUID of the customer" },
    customer_request_id: { type: "string", description: "Restrict to work items linked via this customer request" },
    name: { type: "string", description: "Customer name" },
    description_html: { type: "string", description: "HTML description" },
    email: { type: "string", description: "Contact email" },
    website_url: { type: "string", description: "Customer website URL" },
    domain: { type: "string", description: 'Industry, shown as "Industry" in Plane' },
    employees: { type: "integer", description: "Employee count" },
    stage: { type: "string", description: "Sales stage" },
    contract_status: { type: "string", description: "Contract status" },
    revenue: { type: "string", description: "Annual revenue as a string" },
    link_ids: { type: "string", description: "Comma-separated work item UUIDs to link" },
    unlink_ids: { type: "string", description: "Comma-separated work item UUIDs to unlink" },
    search: { type: "string", description: "Match on work item name, sequence ID or project identifier" },
    query: { type: "string", description: "Search customers by name" },
    external_source: { type: "string", description: "External system the customer came from" },
    external_id: { type: "string", description: "Customer's identifier in the external system" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

const CUSTOMER_FIELDS = [
  "name",
  "description_html",
  "email",
  "website_url",
  "domain",
  "employees",
  "stage",
  "contract_status",
  "revenue",
  "external_source",
  "external_id",
];

function customerBody(args, { includeName }) {
  const body = {};
  for (const field of CUSTOMER_FIELDS) {
    const value = args[field];
    if (field === "name" && !includeName) continue;
    if (opt(value)) body[field] = value;
  }
  return body;
}

export async function handler(args, plane) {
  const { client, workspaceSlug } = plane;
  const { action, customer_id, customer_request_id, link_ids, unlink_ids, search } = args;

  if (action === "list") {
    const response = await client.get(
      client.wsPath("customers"),
      pageParams({ cursor: args.cursor, per_page: args.per_page, query: args.query })
    );
    return envelope(response);
  }

  if (action === "create") {
    if (!args.name) return missing(action, "name");
    return client.post(client.wsPath("customers"), customerBody(args, { includeName: true }));
  }

  if (action === "delete") {
    if (!customer_id && !(args.external_source && args.external_id)) {
      return missing(action, "customer_id (or both external_source and external_id)");
    }
    if (opt(customer_id)) {
      return client.del(client.wsPath(`customers/${customer_id}`));
    }
    return client.del(client.wsPath("customers"), undefined, {
      external_source: args.external_source,
      external_id: args.external_id,
    });
  }

  if (!customer_id) return missing(action, "customer_id");

  if (action === "retrieve") {
    return client.get(client.wsPath(`customers/${customer_id}`));
  }

  if (action === "update") {
    return client.patch(client.wsPath(`customers/${customer_id}`), customerBody(args, { includeName: true }));
  }

  if (action === "list_workitems") {
    const query = {};
    if (opt(customer_request_id)) query.customer_request_id = customer_request_id;
    if (opt(search)) query.search = search;
    return client.get(client.wsPath(`customers/${customer_id}/issues`), query);
  }

  const link = coerceList(link_ids);
  const unlink = coerceList(unlink_ids);
  if (!link && !unlink) return missing(action, "link_ids or unlink_ids");
  if (link) {
    const query = opt(customer_request_id) ? { customer_request_id } : undefined;
    await client.post(client.wsPath(`customers/${customer_id}/issues`), { work_item_ids: link }, query);
  }
  for (const workitemId of unlink || []) {
    const query = opt(customer_request_id) ? { customer_request_id } : undefined;
    await client.del(client.wsPath(`customers/${customer_id}/issues/${workitemId}`), undefined, query);
  }
  return null;
}
