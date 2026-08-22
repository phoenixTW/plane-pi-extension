export const name = "plane_workspace";
export const title = "Workspace settings";
export const summary = "Workspace-level feature flags.";

const FLAGS = ["project_grouping", "initiatives", "teams", "customers", "wiki", "pi"];

export const actions = [
  { name: "get_features", requires: [], note: "feature flags for the current workspace", read: true },
  { name: "update_features", requires: [], optional: FLAGS, note: "only the flags you pass are changed" },
];

export const footer = "For a project's feature flags use `plane_project get_features` and `plane_project update_features`.";

export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["get_features", "update_features"], description: "Operation to perform" },
    project_grouping: { type: ["boolean", "null"], description: "False disables the feature, unset leaves alone" },
    initiatives: { type: ["boolean", "null"], description: "False disables the feature, unset leaves alone" },
    teams: { type: ["boolean", "null"], description: "False disables the feature, unset leaves alone" },
    customers: { type: ["boolean", "null"], description: "False disables the feature, unset leaves alone" },
    wiki: { type: ["boolean", "null"], description: "False disables the feature, unset leaves alone" },
    pi: { type: ["boolean", "null"], description: "False disables the feature, unset leaves alone" },
  },
  required: ["action"],
};

const CLOUD_ONLY_FEATURES = "Error: workspace feature flags are Cloud-only; self-hosted Plane doesn't support this.";

export async function handler(args, plane) {
  const { client, isSelfHosted } = plane;
  const { action, ...flags } = args;
  delete flags.profile;

  if (isSelfHosted) return CLOUD_ONLY_FEATURES;

  if (action === "get_features") {
    return client.get(client.wsPath("features"));
  }

  const payload = Object.fromEntries(
    FLAGS.map((flag) => [flag, flags[flag]]).filter(([, v]) => v !== undefined && v !== null)
  );
  return client.patch(client.wsPath("features"), payload);
}
