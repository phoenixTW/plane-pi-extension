# plane-pi-tools

Pi extension for [Plane](https://plane.so) — works with Plane Cloud and
self-hosted endpoints via multiple profiles.

Ported from [plane-mcp-server](https://github.com/makeplane/plane-mcp-server):
28 tools, one per Plane resource, each dispatching on an `action` parameter
(183 actions total).

## Profiles

A profile = `{ name, baseUrl, apiKey, workspaceSlug }`. One profile can be the
default; every tool accepts an optional `profile` override.

```json
{
  "schemaVersion": 1,
  "defaultProfile": "plane-cloud",
  "profiles": {
    "plane-cloud": {
      "baseUrl": "https://api.plane.so",
      "apiKey": "...",
      "workspaceSlug": "myteam"
    },
    "progresify": {
      "baseUrl": "https://plane.progresify.internal",
      "apiKey": "...",
      "workspaceSlug": "progresify"
    }
  }
}
```

Stored at `~/.pi/agent/extensions/plane-pi-tools/settings.json` (mode 0600).

### Manage

```
/plane-profile              interactive menu
/plane-profile add [name]
/plane-profile list
/plane-profile default [name]
/plane-profile remove [name]
/plane-profile test [name]
/plane-profile show [name]
```

Add flow tests the connection (workspace lookup) and offers to set the new
profile as default.

API key: Plane → Workspace Settings → API tokens. For self-hosted, base URL is
the Plane host (`https://plane.example.com`); the client appends `/api/v1`.

## Tools

`plane_workitem`, `plane_project`, `plane_state`, `plane_label`,
`plane_cycle`, `plane_module`, `plane_milestone`, `plane_page`,
`plane_member`, `plane_workspace`, `plane_initiative`, `plane_intake`,
`plane_customer`, `plane_customer_property`, `plane_customer_request`,
`plane_release`, `plane_release_label`, `plane_release_tag`,
`plane_project_estimate`, `plane_work_log`, `plane_workitem_activity`,
`plane_workitem_attachment`, `plane_workitem_comment`, `plane_workitem_link`,
`plane_workitem_relation`, `plane_workitem_property`, `plane_workitem_type`,
`plane_get_pql_reference`.

Every tool description lists its actions with required/optional params.
Work item filtering uses PQL — the `plane_get_pql_reference` tool carries the
syntax reference.

## Install

Local dev:

```
pi -e /path/to/plane-pi-extension/index.js
```

Or copy/symlink into `~/.pi/agent/extensions/` for auto-discovery.
