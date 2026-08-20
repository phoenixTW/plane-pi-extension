export class PlaneApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "PlaneApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class PlaneClient {
  constructor({ baseUrl, apiKey, workspaceSlug, headers = {}, timeoutMs = 30000 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.workspaceSlug = workspaceSlug;
    this.headers = headers;
    this.timeoutMs = timeoutMs;
  }

  wsPath(rest) {
    const suffix = rest ? `/${rest.replace(/^\/+|\/+$/g, "")}` : "";
    return `workspaces/${this.workspaceSlug}${suffix}`;
  }

  buildUrl(path) {
    const cleaned = path.replace(/^\/+|\/+$/g, "");
    const base = `${this.baseUrl}/api/v1`;
    return cleaned ? `${base}/${cleaned}/` : `${base}/`;
  }

  buildQuery(query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) {
      if (value === undefined || value === null || value === "") continue;
      if (value === false) continue;
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  }

  async request(method, path, { query, body } = {}) {
    const url = this.buildUrl(path) + this.buildQuery(query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
          ...this.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new PlaneApiError(`request timed out after ${this.timeoutMs}ms`, 0, null);
      }
      throw new PlaneApiError(`network error: ${err.message}`, 0, null);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return null;

    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!(response.status >= 200 && response.status < 300)) {
      const reason = payload && typeof payload === "object" && payload.error
        ? typeof payload.error === "string" ? payload.error : JSON.stringify(payload.error)
        : response.statusText;
      throw new PlaneApiError(`HTTP ${response.status}: ${reason}`, response.status, payload);
    }

    return payload;
  }

  get(path, query) {
    return this.request("GET", path, { query });
  }

  post(path, body, query) {
    return this.request("POST", path, { body, query });
  }

  patch(path, body) {
    return this.request("PATCH", path, { body });
  }

  put(path, body) {
    return this.request("PUT", path, { body });
  }

  del(path, body, query) {
    return this.request("DELETE", path, { body, query });
  }
}
