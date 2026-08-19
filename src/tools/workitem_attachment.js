import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { missing, needs } from "../toolkit.js";

export const name = "plane_workitem_attachment";
export const title = "Work item attachments";
export const summary = "Files attached to a work item.";

const IMAGE_READ_LIMIT = 5 * 1024 * 1024;
const TEXT_READ_LIMIT = 1 * 1024 * 1024;
const UPLOAD_SIZE_LIMIT = 5 * 1024 * 1024;
const HTTP_TIMEOUT_MS = 60000;

const READABLE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const READABLE_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "text/yaml",
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
]);

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "text/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".json": "application/json",
};

function guessMime(name) {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return MIME_BY_EXT[name.slice(dot).toLowerCase()] || "";
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts[0] === 127 || parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const expanded = ip.toLowerCase().split("::")[0];
  const first = parseInt(expanded.split(":")[0] || "0", 16);
  if (ip.toLowerCase() === "::1") return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  return false;
}

async function assertPublicUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Error: Invalid URL (no hostname): '${url}'`);
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) throw new Error(`Error: Invalid URL (no hostname): '${url}'`);
  if (isIP(hostname)) {
    if (isIP(hostname) === 4 && isPrivateIPv4(hostname)) throw privateUrlError(url, hostname);
    if (isIP(hostname) === 6 && isPrivateIPv6(hostname)) throw privateUrlError(url, hostname);
    return;
  }
  let resolved;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`Error: Could not resolve hostname '${hostname}': ${err.message}`);
  }
  for (const { address } of resolved) {
    if (isIP(address) === 4 && isPrivateIPv4(address)) throw privateUrlError(url, address);
    if (isIP(address) === 6 && isPrivateIPv6(address)) throw privateUrlError(url, address);
  }
}

function privateUrlError(url, address) {
  return new Error(
    `Error: URL '${url}' resolves to a private/reserved address (${address}) and cannot be fetched for security reasons.`
  );
}

function attachmentToDict(attachment) {
  const data = { ...(attachment || {}) };
  const attrs = data.attributes || {};
  data.name = attrs.name ?? null;
  data.size = attrs.size || data.size;
  data.content_type = attrs.type ?? null;
  return data;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function findAttachment(client, project_id, workitem_id, attachment_id) {
  const attachments = await client.get(
    client.wsPath(`projects/${project_id}/work-items/${workitem_id}/attachments`)
  );
  const list = Array.isArray(attachments) ? attachments : [];
  const attachment = list.find((a) => a && a.id === attachment_id);
  if (!attachment) {
    throw new Error(`Error: Attachment '${attachment_id}' not found on work item '${workitem_id}'`);
  }
  return attachment;
}

async function getDownloadUrl(client, project_id, workitem_id, attachment_id) {
  const path = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/attachments/${attachment_id}`);
  const url = client.buildUrl(path);
  const response = await fetchWithTimeout(url, {
    headers: { "X-Api-Key": client.apiKey },
    redirect: "manual",
  });
  const location = response.headers.get("location");
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    return location;
  }
  return await client.get(path);
}

async function readAttachment(client, project_id, workitem_id, attachment_id) {
  const attachment = await findAttachment(client, project_id, workitem_id, attachment_id);
  const attrs = attachment.attributes || {};
  const name = attrs.name || attachment_id;
  let contentType = attrs.type || "";
  if (!contentType || contentType === "application/octet-stream") {
    contentType = guessMime(name) || "application/octet-stream";
  }

  const isImage = READABLE_IMAGE_TYPES.has(contentType);
  const isText = READABLE_TEXT_TYPES.has(contentType);
  if (!isImage && !isText) {
    throw new Error(
      `Error: Unsupported content type '${contentType}' for file '${name}'. Supported: ` +
        "PNG/JPEG/GIF/WEBP (images) and TXT/MD/CSV/HTML/XML/YAML/JSON (text). " +
        "For PDFs and Office documents use the download_url action."
    );
  }

  const url = await getDownloadUrl(client, project_id, workitem_id, attachment_id);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Error: Failed to fetch attachment content: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  const limit = isImage ? IMAGE_READ_LIMIT : TEXT_READ_LIMIT;
  if (buffer.length > limit) {
    throw new Error(
      `Error: '${name}' is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, which exceeds the ` +
        `${limit / 1024 / 1024} MB limit. Use the download_url action instead.`
    );
  }
  if (isImage) {
    return {
      name,
      content_type: contentType,
      is_image: true,
      data_base64: buffer.toString("base64"),
    };
  }
  return { name, content_type: contentType, is_image: false, text: buffer.toString("utf-8") };
}

async function uploadFromUrl(client, project_id, workitem_id, url, name) {
  await assertPublicUrl(url);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Error: Failed to fetch file from '${url}': HTTP ${response.status}`);
  }

  const declared = Number(response.headers.get("content-length")) || 0;
  const buffer = Buffer.from(await response.arrayBuffer());
  const size = Math.max(declared, buffer.length);
  if (size > UPLOAD_SIZE_LIMIT) {
    throw new Error(
      `Error: File at '${url}' is too large (${Math.floor(size / 1024 / 1024)} MB). Maximum allowed ` +
        `size is ${UPLOAD_SIZE_LIMIT / 1024 / 1024} MB.`
    );
  }

  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = "";
  }
  const filename =
    name || (pathname.split("/").filter(Boolean).pop() || "attachment");
  const rawType = response.headers.get("content-type") || "";
  let contentType = rawType.split(";")[0].trim();
  if (!contentType || contentType === "application/octet-stream") {
    contentType = guessMime(filename) || "application/octet-stream";
  }

  const basePath = client.wsPath(`projects/${project_id}/work-items/${workitem_id}/attachments`);
  const raw = await client.post(basePath, { name: filename, type: contentType, size });
  const uploadData = raw.upload_data || {};
  const assetId = raw.asset_id;
  const attachment = raw.attachment;

  const form = new FormData();
  for (const [field, value] of Object.entries(uploadData.fields || {})) {
    form.append(field, value);
  }
  form.append("file", new Blob([buffer], { type: contentType }), filename);
  const s3Response = await fetchWithTimeout(uploadData.url, { method: "POST", body: form });
  if (!s3Response.ok) {
    throw new Error(`Error: S3 upload failed: HTTP ${s3Response.status}`);
  }

  await client.patch(`${basePath}/${assetId}`, { is_uploaded: true });
  return attachmentToDict(attachment);
}

export const actions = [
  { name: "list", requires: ["project_id", "workitem_id"], optional: [], read: true },
  { name: "read", requires: ["project_id", "workitem_id", "attachment_id"], optional: [], note: "returns images and text inline; use download_url for anything else", read: true },
  { name: "download_url", requires: ["project_id", "workitem_id", "attachment_id"], optional: [], read: true },
  { name: "upload_from_url", requires: ["project_id", "workitem_id", "url"], optional: ["name"] },
  { name: "delete", requires: ["project_id", "workitem_id", "attachment_id"], optional: [], destructive: true },
];

export const footer =
  `read supports PNG/JPEG/GIF/WEBP up to ${IMAGE_READ_LIMIT / 1024 / 1024} MB and ` +
  `TXT/MD/CSV/HTML/XML/YAML/JSON up to ${TEXT_READ_LIMIT / 1024 / 1024} MB. ` +
  "Get attachment_id from the list action. upload_from_url fetches the file server-side, so " +
  "the URL must be reachable without authentication and must not resolve to a private address.";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "read", "download_url", "upload_from_url", "delete"],
      description: "Operation to perform",
    },
    project_id: { type: "string", description: "UUID of the project" },
    workitem_id: { type: "string", description: "UUID of the work item" },
    attachment_id: { type: "string", description: "UUID of the attachment" },
    url: { type: "string", description: "Public URL of the file to attach" },
    name: { type: "string", description: "Filename for the uploaded attachment" },
  },
  required: ["action"],
};

export async function handler(args, plane) {
  const { client } = plane;
  const { action, project_id, workitem_id, attachment_id, url, name } = args;

  const absent = needs(action, { project_id, workitem_id });
  if (absent) return absent;

  if (action === "list") {
    const attachments = await client.get(
      client.wsPath(`projects/${project_id}/work-items/${workitem_id}/attachments`)
    );
    const list = Array.isArray(attachments) ? attachments : [];
    return list.map((a) => attachmentToDict(a));
  }

  if (action === "upload_from_url") {
    if (!url) return missing(action, "url");
    return uploadFromUrl(client, project_id, workitem_id, url, name);
  }

  if (!attachment_id) return missing(action, "attachment_id");

  if (action === "read") {
    return readAttachment(client, project_id, workitem_id, attachment_id);
  }

  if (action === "download_url") {
    const attachment = await findAttachment(client, project_id, workitem_id, attachment_id);
    const attrs = attachment.attributes || {};
    return {
      download_url: await getDownloadUrl(client, project_id, workitem_id, attachment_id),
      attachment_id,
      name: attrs.name || attachment_id,
    };
  }

  return client.del(
    client.wsPath(`projects/${project_id}/work-items/${workitem_id}/attachments/${attachment_id}`)
  );
}
