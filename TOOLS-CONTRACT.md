# Tool Module Contract

One file per Plane resource in `src/tools/`. Each module is a direct port of the
matching Python module in plane-mcp-server, against REST endpoints taken from the
plane-sdk.

## Sources

- MCP tool modules (actions, params, validation, footers):
  `/tmp/plane-mcp-server/plane_mcp/tools/<resource>.py`
- REST endpoint shapes (paths, methods, bodies):
  `~/.cache/uv/archive-v0/-dPyaCKSETaSzi4qa2Jof/lib/python3.13/site-packages/plane/api/`
- PQL reference text: `/tmp/plane-mcp-server/plane_mcp/pql_reference.py`

## Module shape

```js
import { needs, oneOf, opt, coerceList, pageParams, envelope, pqlFailure, descriptionHtml } from "../toolkit.js";

export const name = "plane_workitem";
export const title = "Work items";
export const summary = "Work items -- issues, tasks and epics.";
export const planGate = "This Plane feature";        // optional, shown on 402
export const actions = [
  { name: "list", requires: [], optional: ["project_id", "pql", "cursor", "per_page"], note: "...", read: true },
  { name: "delete", requires: ["project_id", "workitem_id"], destructive: true },
];
export const footer = "cross-cutting notes from the Python FOOTER, verbatim";
export const parameters = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["list", "delete"], description: "Operation to perform" },
    project_id: { type: "string", description: "..." },
  },
  required: ["action"],
};
export async function handler(args, plane) { ... }
```

- `plane` = `{ client, workspaceSlug, profileName }`.
- `client` is a PlaneClient: `get(path, query)`, `post(path, body, query)`,
  `patch(path, body)`, `put(path, body)`, `del(path, body, query)`. Paths are
  relative to `{baseUrl}/api/v1/`, and the client always appends a trailing
  slash. Build workspace paths with `client.wsPath(rest)` ->
  `workspaces/{slug}/{rest}`.
- `handler` returns a JSON-serializable value, or a string starting with
  `Error:` for validation failures (self-correction channel, same as Python).
- Throw nothing for validation problems; return the error string instead.
  HTTP failures may throw PlaneApiError; index.js formats them.
- Do NOT add a `profile` parameter -- index.js adds it to every tool.
- Parameter defaults: strings `""`, numbers `0`, booleans where meaningful.
  Tri-state booleans (false is a real value) use `type: ["boolean", "null"]`
  with default null -- mirror the Python signature faithfully.
- Endpoints with a `cursor` param MUST return `envelope(response, fields)`.
- Invalid-PQL 400s on workitem/cycle/module list actions: use
  `pqlFailure(name, action, pql, err)` in a catch, rethrow when null.
- Port action notes, footers, enum validation (`oneOf`) verbatim from Python.
- Skip LEGACY action aliases entirely.
- No comments in code. No blank-line padding beyond normal style.

## Naming

File `src/tools/<resource>.js`, tool name `plane_<resource>`. `module.js`
exports conflict with nothing; import it in index.js as `module_`.
