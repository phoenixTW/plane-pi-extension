import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";


export const CLOUD_BASE_URL = "https://api.plane.so";
export const SETTINGS_DIR = join(homedir(), ".pi", "agent", "extensions", "plane-pi-tools");
export const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");
export const SCHEMA_VERSION = 1;

export function defaultSettings() {
  return {
    schemaVersion: SCHEMA_VERSION,
    defaultProfile: null,
    profiles: {},
  };
}

function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

export function normalizeProfile(name, input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl || CLOUD_BASE_URL);
  return {
    name,
    baseUrl,
    apiKey: (input.apiKey || "").trim(),
    workspaceSlug: (input.workspaceSlug || "").trim(),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function validateProfileInput(input, existingNames) {
  const errors = [];
  const name = (input.name || "").trim();
  if (!name) errors.push("name is required");
  if (name && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    errors.push("name may contain letters, digits, '-' and '_' only");
  }
  if (name && existingNames && existingNames.includes(name)) {
    errors.push(`profile '${name}' already exists`);
  }
  if (!input.apiKey || !input.apiKey.trim()) errors.push("apiKey is required");
  if (!input.workspaceSlug || !input.workspaceSlug.trim()) errors.push("workspaceSlug is required");
  if (input.baseUrl && !/^https?:\/\//.test(input.baseUrl.trim())) {
    errors.push("baseUrl must start with http:// or https://");
  }
  return errors;
}

export async function loadSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const settings = defaultSettings();
    settings.defaultProfile = parsed.defaultProfile || null;
    for (const [name, value] of Object.entries(parsed.profiles || {})) {
      settings.profiles[name] = normalizeProfile(name, value);
    }
    return settings;
  } catch (err) {
    if (err.code === "ENOENT") return defaultSettings();
    throw err;
  }
}

export async function saveSettings(settings) {
  await mkdir(SETTINGS_DIR, { recursive: true });
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    defaultProfile: settings.defaultProfile,
    profiles: settings.profiles,
  };
  await writeFile(SETTINGS_PATH, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
  try {
    await chmod(SETTINGS_PATH, 0o600);
  } catch {
    // best effort on platforms without chmod
  }
  return settings;
}

export function resolveProfileSettings(settings, name) {
  const names = Object.keys(settings.profiles);
  if (names.length === 0) {
    return {
      error:
        "Error: no Plane profiles configured. Run /plane-profile to add one (name, base URL, API key, workspace slug).",
    };
  }
  const target = name || settings.defaultProfile;
  if (!target) {
    return {
      error: `Error: no default profile set. Pass profile=<name> or set a default with /plane-profile. Available: ${names.join(", ")}.`,
    };
  }
  if (!settings.profiles[target]) {
    return {
      error: `Error: profile '${target}' not found. Available: ${names.join(", ")}.`,
    };
  }
  return { profile: settings.profiles[target] };
}

export function redactProfile(profile) {
  const key = profile.apiKey || "";
  const shown = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : "***";
  return {
    name: profile.name,
    baseUrl: profile.baseUrl,
    workspaceSlug: profile.workspaceSlug,
    apiKey: shown,
    createdAt: profile.createdAt,
  };
}
