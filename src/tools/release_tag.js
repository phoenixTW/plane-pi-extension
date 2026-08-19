import { missing, opt, pageParams, envelope } from "../toolkit.js";

export const name = "plane_release_tag";
export const title = "Release tags";
export const summary = "Release tags (version markers).";

export const actions = [
  { name: "list", requires: [], optional: ["cursor", "per_page"], read: true },
  { name: "retrieve", requires: ["tag_id"], optional: [], read: true },
  { name: "create", requires: ["version"], optional: ["description", "commit_hash", "git_tag"] },
  { name: "update", requires: ["tag_id"], optional: ["version", "description", "commit_hash", "git_tag"], note: "only the fields you pass are changed" },
  { name: "delete", requires: ["tag_id"], optional: [], destructive: true },
];

export const footer =
  'version is a version string such as "v1.2.0". A tag id is what release takes as tag_id.';

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "retrieve", "create", "update", "delete"],
      description: "Operation to perform",
    },
    tag_id: { type: "string", description: "UUID of the release tag" },
    version: { type: "string", description: "Version string such as v1.2.0, unique in the workspace" },
    description: { type: "string", description: "Tag description" },
    commit_hash: { type: "string", description: "Commit hash the tag points at" },
    git_tag: { type: "string", description: "Git tag name" },
    cursor: { type: "string", description: "Pagination cursor from a previous page" },
    per_page: { type: "integer", description: "Page size" },
  },
  required: ["action"],
};

function tagBody(args) {
  const body = {};
  if (opt(args.version)) body.version = args.version;
  if (opt(args.description)) body.description = args.description;
  if (opt(args.commit_hash)) body.commit_hash = args.commit_hash;
  if (opt(args.git_tag)) body.git_tag = args.git_tag;
  return body;
}

export async function handler(args, plane) {
  const { client } = plane;
  const { action, tag_id, version } = args;

  if (action === "list") {
    const response = await client.get(client.wsPath("releases/tags"), pageParams({ cursor: args.cursor, per_page: args.per_page }));
    return envelope(response);
  }

  if (action === "create") {
    if (!version) return missing(action, "version");
    return client.post(client.wsPath("releases/tags"), tagBody(args));
  }

  if (!tag_id) return missing(action, "tag_id");

  if (action === "retrieve") {
    return client.get(client.wsPath(`releases/tags/${tag_id}`));
  }

  if (action === "update") {
    return client.patch(client.wsPath(`releases/tags/${tag_id}`), tagBody(args));
  }

  return client.del(client.wsPath(`releases/tags/${tag_id}`));
}
