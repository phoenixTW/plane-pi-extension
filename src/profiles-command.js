import {
  CLOUD_BASE_URL,
  loadSettings,
  saveSettings,
  normalizeProfile,
  validateProfileInput,
  redactProfile,
} from "./settings.js";
import { PlaneClient } from "./plane-client.js";

async function testConnection(profile) {
  const client = new PlaneClient(profile);
  const started = Date.now();
  const workspace = await client.get(client.wsPath());
  return {
    ok: true,
    name: profile.name,
    baseUrl: profile.baseUrl,
    workspaceSlug: profile.workspaceSlug,
    workspaceName: workspace?.name || profile.workspaceSlug,
    elapsedMs: Date.now() - started,
  };
}

function profileLines(settings) {
  const names = Object.keys(settings.profiles);
  if (names.length === 0) return ["  (no profiles -- add one first)"];
  return names.map((name) => {
    const p = settings.profiles[name];
    const marker = name === settings.defaultProfile ? " (default)" : "";
    return `  ${name}${marker}\n    ${p.baseUrl}  workspace: ${p.workspaceSlug}`;
  });
}

async function promptAdd(ctx, presetName) {
  const settings = await loadSettings();
  const existing = Object.keys(settings.profiles);

  const name = presetName || (await ctx.ui.input("Profile name (letters, digits, -, _)", "e.g. plane-cloud"));
  if (!name || !name.trim()) {
    ctx.ui.notify("Cancelled", "warning");
    return;
  }

  const baseUrlRaw = await ctx.ui.input(
    `Base URL (empty = Plane Cloud ${CLOUD_BASE_URL})`,
    settings.defaultProfile
      ? settings.profiles[settings.defaultProfile].baseUrl
      : CLOUD_BASE_URL
  );
  if (baseUrlRaw === undefined) {
    ctx.ui.notify("Cancelled", "warning");
    return;
  }
  const baseUrl = baseUrlRaw.trim();

  const apiKey = await ctx.ui.input("API key (Workspace Settings -> API tokens)", "");
  if (!apiKey || !apiKey.trim()) {
    ctx.ui.notify("Cancelled", "warning");
    return;
  }

  const workspaceSlug = await ctx.ui.input("Workspace slug", "");
  if (!workspaceSlug || !workspaceSlug.trim()) {
    ctx.ui.notify("Cancelled", "warning");
    return;
  }

  const input = { name: name.trim(), baseUrl, apiKey: apiKey.trim(), workspaceSlug: workspaceSlug.trim() };
  const errors = validateProfileInput(input, existing);
  if (errors.length > 0) {
    ctx.ui.notify(`Invalid profile: ${errors.join("; ")}`, "error");
    return;
  }

  const profile = normalizeProfile(input.name, input);
  ctx.ui.notify(`Testing connection to ${profile.baseUrl}...`, "info");
  try {
    const result = await testConnection(profile);
    ctx.ui.notify(`Connected: workspace '${result.workspaceName}' (${result.elapsedMs}ms)`, "success");
  } catch (err) {
    const proceed = await ctx.ui.confirm(
      "Connection failed",
      `${err.message}\n\nSave profile anyway?`
    );
    if (!proceed) {
      ctx.ui.notify("Cancelled", "warning");
      return;
    }
  }

  settings.profiles[profile.name] = profile;
  const isFirst = Object.keys(settings.profiles).length === 1;
  const makeDefault =
    isFirst ||
    (await ctx.ui.confirm("Set as default profile?", `Use '${profile.name}' for all tool calls without an explicit profile?`));
  if (makeDefault) settings.defaultProfile = profile.name;
  await saveSettings(settings);
  ctx.ui.notify(`Profile '${profile.name}' saved${settings.defaultProfile === profile.name ? " (default)" : ""}`, "success");
}

async function promptDefault(ctx, presetName) {
  const settings = await loadSettings();
  const names = Object.keys(settings.profiles);
  if (names.length === 0) {
    ctx.ui.notify("No profiles configured. Add one first.", "warning");
    return;
  }
  let name = presetName;
  if (!name || !settings.profiles[name]) {
    const options = names.map((n) => (n === settings.defaultProfile ? `${n} (current default)` : n));
    name = await ctx.ui.select("Select default profile", options);
    if (!name) {
      ctx.ui.notify("Cancelled", "warning");
      return;
    }
    name = name.replace(" (current default)", "");
  }
  settings.defaultProfile = name;
  await saveSettings(settings);
  ctx.ui.notify(`Default profile: ${name}`, "success");
}

async function promptRemove(ctx, presetName) {
  const settings = await loadSettings();
  const names = Object.keys(settings.profiles);
  if (names.length === 0) {
    ctx.ui.notify("No profiles configured.", "warning");
    return;
  }
  let name = presetName;
  if (!name || !settings.profiles[name]) {
    name = await ctx.ui.select("Remove which profile?", names);
    if (!name) {
      ctx.ui.notify("Cancelled", "warning");
      return;
    }
  }
  const confirmed = await ctx.ui.confirm(`Remove profile '${name}'?`, "The stored API key is deleted. This cannot be undone.");
  if (!confirmed) {
    ctx.ui.notify("Cancelled", "warning");
    return;
  }
  delete settings.profiles[name];
  if (settings.defaultProfile === name) {
    const remaining = Object.keys(settings.profiles);
    settings.defaultProfile = remaining.length > 0 ? remaining[0] : null;
    if (settings.defaultProfile) ctx.ui.notify(`Default profile now: ${settings.defaultProfile}`, "info");
  }
  await saveSettings(settings);
  ctx.ui.notify(`Profile '${name}' removed`, "success");
}

async function promptTest(ctx, presetName) {
  const settings = await loadSettings();
  const names = Object.keys(settings.profiles);
  if (names.length === 0) {
    ctx.ui.notify("No profiles configured.", "warning");
    return;
  }
  let name = presetName;
  if (!name || !settings.profiles[name]) {
    name = await ctx.ui.select("Test which profile?", names);
    if (!name) {
      ctx.ui.notify("Cancelled", "warning");
      return;
    }
  }
  ctx.ui.notify(`Testing '${name}'...`, "info");
  try {
    const result = await testConnection(settings.profiles[name]);
    ctx.ui.notify(`OK: workspace '${result.workspaceName}' at ${result.baseUrl} (${result.elapsedMs}ms)`, "success");
  } catch (err) {
    ctx.ui.notify(`Failed: ${err.message}`, "error");
  }
}

async function listProfiles(ctx) {
  const settings = await loadSettings();
  const lines = ["Plane profiles:", ...profileLines(settings)];
  ctx.ui.notify(lines.join("\n"), "info");
}

async function showProfile(ctx, presetName) {
  const settings = await loadSettings();
  const names = Object.keys(settings.profiles);
  if (names.length === 0) {
    ctx.ui.notify("No profiles configured.", "warning");
    return;
  }
  let name = presetName;
  if (!name || !settings.profiles[name]) {
    name = await ctx.ui.select("Show which profile?", names);
    if (!name) return;
  }
  const p = settings.profiles[name];
  ctx.ui.notify(JSON.stringify(redactProfile(p), null, 2), "info");
}

async function interactiveMenu(ctx) {
  const choice = await ctx.ui.select("Plane profiles", [
    "add",
    "list",
    "default",
    "remove",
    "test",
    "show",
    "done",
  ]);
  if (!choice || choice === "done") return;
  switch (choice) {
    case "add":
      await promptAdd(ctx);
      break;
    case "list":
      await listProfiles(ctx);
      break;
    case "default":
      await promptDefault(ctx);
      break;
    case "remove":
      await promptRemove(ctx);
      break;
    case "test":
      await promptTest(ctx);
      break;
    case "show":
      await showProfile(ctx);
      break;
  }
  await interactiveMenu(ctx);
}

export function registerProfileCommand(pi) {
  pi.registerCommand("plane-profile", {
    description: "Manage Plane profiles (add, list, default, remove, test) for cloud and self-hosted endpoints",
    handler: async (argsText, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("plane-profile requires an interactive UI session", "error");
        return;
      }
      const [sub, ...rest] = (argsText || "").trim().split(/\s+/).filter(Boolean);
      const arg = rest.join(" ");
      try {
        switch (sub) {
          case "":
            await interactiveMenu(ctx);
            break;
          case "add":
            await promptAdd(ctx, arg || undefined);
            break;
          case "list":
            await listProfiles(ctx);
            break;
          case "default":
            await promptDefault(ctx, arg || undefined);
            break;
          case "remove":
            await promptRemove(ctx, arg || undefined);
            break;
          case "test":
            await promptTest(ctx, arg || undefined);
            break;
          case "show":
            await showProfile(ctx, arg || undefined);
            break;
          default:
            ctx.ui.notify(`Unknown subcommand '${sub}'. Usage: /plane-profile [add|list|default|remove|test|show] [name]`, "error");
        }
      } catch (err) {
        ctx.ui.notify(`Error: ${err.message}`, "error");
      }
    },
  });
}

export { testConnection };
