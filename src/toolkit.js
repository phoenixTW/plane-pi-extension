import { PlaneApiError } from "./plane-client.js";

const ENVELOPE_FIELDS = [
  "total_count",
  "count",
  "next_cursor",
  "prev_cursor",
  "next_page_results",
  "prev_page_results",
];

const PLAN_GATE_PROSE = "upgrade your plan";
const PLAN_GATE_FEATURE = /upgrade your plan to enable ([^."']+)/i;

export function missing(action, ...names) {
  return `Error: action '${action}' requires: ${names.join(", ")}.`;
}

export function needs(action, supplied) {
  const absent = Object.entries(supplied)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  return absent.length > 0 ? missing(action, ...absent) : null;
}

export function requireDeclared(actions, action, supplied) {
  const declared = actions.find((a) => a.name === action);
  if (!declared) return null;
  const absent = declared.requires.filter((name) => !supplied[name]);
  return absent.length > 0 ? missing(action, ...absent) : null;
}

export function oneOf(name, value, allowed, hint = "") {
  if (!value || allowed.includes(value)) return null;
  const message = `Error: ${name} must be one of: ${allowed.join(", ")}.`;
  return hint ? `${message} ${hint}` : message;
}

export function opt(value) {
  return value === "" || value === 0 || value === undefined ? undefined : value;
}

export function coerceList(value, { split = true } = {}) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return undefined;
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [text];
      }
    }
    if (!split) return [text];
    return text.split(",").map((part) => part.trim()).filter(Boolean);
  }
  return [value];
}

export function pageParams({ cursor = "", per_page = 0, ...extra } = {}) {
  const params = {};
  if (cursor) params.cursor = cursor;
  if (per_page) params.per_page = per_page;
  for (const [key, value] of Object.entries(extra)) {
    if (value !== "" && value !== 0 && value !== undefined && value !== null && value !== false) {
      params[key] = value;
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

export function envelope(response, fields) {
  const out = {};
  for (const name of ENVELOPE_FIELDS) {
    if (response && typeof response === "object" && name in response) {
      out[name] = response[name];
    }
  }
  out.results = sparse(response?.results, fields);
  return out;
}

function sparse(items, fields) {
  if (!fields) return items || [];
  const requested = new Set(fields.split(",").map((s) => s.trim()).filter(Boolean));
  return (items || []).map((item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).filter(([key]) => requested.has(key)))
      : item
  );
}

export function pqlFailure(tool, action, pql, err) {
  if (!(pql && err instanceof PlaneApiError && err.status === 400 && err.payload && typeof err.payload === "object")) {
    return null;
  }
  const detail = filterComplaint(err.payload);
  if (detail === null) return null;
  return {
    error: detail,
    pql,
    hint: "call plane_get_pql_reference with detail='full' for syntax, operators and worked examples",
    tool,
    action,
  };
}

function filterComplaint(payload) {
  const candidates = [payload.error, payload.detail, payload.message];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    if (candidate && typeof candidate === "object") {
      const s = JSON.stringify(candidate);
      if (s && s !== "{}" && s !== "[]") return s;
    }
  }
  return null;
}

export function planRequired(err, feature) {
  if (!(err instanceof PlaneApiError)) return null;
  const prose = JSON.stringify(err.payload || "").toLowerCase();
  if (err.status === 402 || (err.status === 400 && prose.includes(PLAN_GATE_PROSE))) {
    const match = prose.match(PLAN_GATE_FEATURE);
    const named = match ? match[1].trim() : feature;
    return `Error: ${named} is not available on this workspace's plan, so this cannot be done here.`;
  }
  return null;
}

export function describeAction(action) {
  const parts = [action.name];
  if (action.requires?.length) parts.push(`requires ${action.requires.join(", ")}`);
  if (action.optional?.length) parts.push(`optional ${action.optional.join(", ")}`);
  if (action.note) parts.push(`-- ${action.note}`);
  const flags = [];
  if (action.read) flags.push("READ-ONLY");
  if (action.destructive) flags.push("DESTRUCTIVE");
  if (flags.length) parts.push(`[${flags.join(" ")}]`);
  return parts.join(": ");
}

export function buildDescription(summary, actions, footer = "") {
  const lines = [summary, "", "Actions:"];
  for (const action of actions) lines.push(`- ${describeAction(action)}`);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function descriptionHtml(descriptionHtml, descriptionStripped) {
  if (descriptionHtml) return descriptionHtml;
  if (descriptionStripped) {
    const escaped = descriptionStripped
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<p>${escaped.replace(/\n/g, "<br/>")}</p>`;
  }
  return undefined;
}
