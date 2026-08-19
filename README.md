# plane-pi-tools

A [pi coding agent](https://github.com/earendil-works/pi-coding-agent) extension
for [Plane](https://plane.so) — the project planning tool. Works with **Plane
Cloud** and **self-hosted Plane** through switchable profiles.

Ported from [plane-mcp-server](https://github.com/makeplane/plane-mcp-server):
28 tools (one per Plane resource), 183 actions, dispatched via an `action`
parameter. Work item filtering uses PQL (Plane Query Language); a dedicated
reference tool teaches the model the syntax.

## What you can do with it

Inside a pi session, ask naturally — the model picks tools and actions:

- "Show all urgent work items in the ENG project that are still started"
- "Create a bug `Fix login redirect` in ENG, priority urgent, assign to me"
- "What did PROG-142 change? Pull its activity"
- "Add PROG-142 to the current cycle"
- "List releases for progresify and show the changelog of the latest"
- "Compare open work item counts across our cloud and self-hosted workspaces"

Every tool description embeds its action catalog (required/optional params,
read-only/destructive flags), so the model self-corrects instead of guessing.

## Install

```bash
# from a local checkout
pi install /path/to/plane-pi-extension

# from git (private repo: use an SSH-remote URL you can clone)
pi install git:github.com:phoenixTW/plane-pi-extension

# try without installing
pi -e /path/to/plane-pi-extension/index.js
```

No npm dependencies — plain Node ESM (Node >= 18).

## Profiles

A profile binds one Plane endpoint to one workspace:

| Field | Meaning |
|---|---|
| `name` | Profile key, used by `/plane-profile` and the `profile` tool param |
| `baseUrl` | API root. Empty/omitted = Plane Cloud (`https://api.plane.so`). Self-hosted = your Plane host, e.g. `https://plane.example.com` |
| `apiKey` | API token. Plane → **Workspace Settings → API tokens** |
| `workspaceSlug` | Workspace slug the token belongs to |

Stored at `~/.pi/agent/extensions/plane-pi-tools/settings.json`, written with
mode `0600`. No environment variables are read; the key lives only in the
profile.

Example:

```json
{
  "schemaVersion": 1,
  "defaultProfile": "plane-cloud",
  "profiles": {
    "plane-cloud": {
      "name": "plane-cloud",
      "baseUrl": "https://api.plane.so",
      "apiKey": "paste_token",
      "workspaceSlug": "myteam"
    },
    "progresify": {
      "name": "progresify",
      "baseUrl": "https://plane.progresify.internal",
      "apiKey": "paste_token",
      "workspaceSlug": "progresify"
    }
  }
}
```

### Profile selection rules

1. Tool call with `profile: "progresify"` → uses `progresify`.
2. Tool call without `profile` → uses the default profile.
3. No default set → error naming available profiles (self-correcting).
4. No profiles at all → error pointing at `/plane-profile`.

`plane_get_pql_reference` is the only tool that never touches a profile.

### Managing profiles

```
/plane-profile                interactive menu
/plane-profile add [name]
/plane-profile list
/plane-profile default [name]
/plane-profile remove [name]
/plane-profile test [name]
/plane-profile show [name]
```

`add` prompts for name → base URL (empty = cloud) → API key → workspace slug,
tests the connection (`GET /api/v1/workspaces/{slug}/`), then offers to make
the profile the default. `show` and `list` redact the API key (`abcd...wxyz`).
All prompts use blocking dialogs, so they also work over RPC sessions.

## Tools

| Tool | Resource | Actions |
|---|---|---|
| `plane_workitem` | Work items (issues/tasks/epics) | list, list_archived, retrieve, retrieve_by_identifier, search, count, create, update, delete, archive, manage_assignee, manage_label |
| `plane_project` | Projects + feature flags | list, retrieve, create, update, delete, archive, unarchive, worklog_summary, get_features, update_features |
| `plane_state` | Workflow states | list, retrieve, create, update, delete |
| `plane_label` | Labels | list, retrieve, create, update, delete |
| `plane_cycle` | Cycles | list, retrieve, create, update, delete, list_workitems, manage_workitems, transfer_workitems, complete, archive, unarchive |
| `plane_module` | Modules | list, retrieve, create, update, delete, list_workitems, manage_workitems, archive, unarchive |
| `plane_milestone` | Milestones | list, retrieve, create, update, delete, list_workitems, manage_workitems |
| `plane_page` | Pages | list, retrieve, create, list_workitem_pages, attach_to_workitem, detach_from_workitem |
| `plane_member` | Members and roles | me, list_workspace, list_project, list_roles, retrieve_role |
| `plane_workspace` | Workspace feature settings | get_features, update_features |
| `plane_initiative` | Initiatives | list, retrieve, create, update, delete, list_projects, add_projects, remove_projects |
| `plane_intake` | Intake queue | list, retrieve, create, update, delete |
| `plane_customer` | Customers | list, retrieve, create, update, delete, list_workitems, manage_workitems |
| `plane_customer_property` | Customer properties | list, retrieve, create, update, delete, get_values, set_values |
| `plane_customer_request` | Customer requests | list, retrieve, create, update, delete |
| `plane_release` | Releases | list, retrieve, create, update, delete, get_changelog, update_changelog, list_workitems, manage_workitems |
| `plane_release_label` | Release labels | list, create, update, delete, attach, detach |
| `plane_release_tag` | Release tags | list, retrieve, create, update, delete |
| `plane_project_estimate` | Estimates + points | retrieve, create, update, delete, link, list_points, create_points, update_point, delete_point |
| `plane_work_log` | Work logs | list, create, update, delete |
| `plane_workitem_activity` | Work item history | list, retrieve |
| `plane_workitem_attachment` | Attachments | list, read, download_url, upload_from_url, delete |
| `plane_workitem_comment` | Comments | list, retrieve, create, update, delete |
| `plane_workitem_link` | External links | list, retrieve, create, update, delete |
| `plane_workitem_relation` | Relations + definitions | list, create, delete, list_definitions, create_definition, update_definition, delete_definition |
| `plane_workitem_property` | Work item properties | list, retrieve, create, update, delete, manage_type_properties, list_options, retrieve_option, create_option, update_option, delete_option, get_value, set_value, delete_value |
| `plane_workitem_type` | Work item types | list, retrieve, resolve, create, update, delete, import_to_project |
| `plane_get_pql_reference` | PQL syntax reference | read |

## Usage examples

Query with PQL (model composes the filter itself):

```
> urgent started items in the ENG project
→ plane_workitem action=list project_id=<uuid>
  pql='state__group = "started" AND priority = "urgent"'
```

Look up by human identifier:

```
> what is PROG-142?
→ plane_workitem action=retrieve_by_identifier workitem_identifier=PROG-142
```

Create and organize:

```
> file a bug "Login redirect loops on Safari" in ENG, urgent, then add it to the current cycle
→ plane_workitem action=create ...
→ plane_cycle action=manage_workitems ...
```

Cross-profile comparison (the reason every tool takes `profile`):

```
> how many open items on plane-cloud vs progresify?
→ plane_workitem action=count profile=plane-cloud ...
→ plane_workitem action=count profile=progresify ...
```

PQL self-correction: an invalid filter returns a structured error plus a hint
to consult the reference, so the model retries with corrected syntax instead of
failing the turn.

## Behavior details

- **Endpoints**: `{baseUrl}/api/v1/workspaces/{slug}/...` with `X-Api-Key`
  auth — identical API shape for cloud and self-hosted.
- **Pagination**: actions that take a `cursor` return the full envelope
  (`results`, `next_cursor`, `total_count`, ...) so the model can page through.
- **Validation**: missing required params return `Error: action 'x' requires:
  a, b.` strings — the model's self-correction channel, mirroring the MCP
  server.
- **Plan gates**: HTTP 402 (plan-gated feature) becomes a message naming the
  gated feature, not a raw stack trace.
- **Timeouts**: 30 s per request, aborted cleanly; network failures report the
  cause.
- **Destructive actions** (`delete`, and others) are flagged in tool
  descriptions; pi's confirmation flow still applies at the harness level.

## Development

```
index.js                  entry: registration, profile resolution, error formatting
src/settings.js           profile store (load/save/validate/normalize)
src/plane-client.js       REST client (fetch, X-Api-Key, timeouts)
src/profiles-command.js   /plane-profile interactive command
src/toolkit.js            action catalogs, validation, envelopes, plan gates
src/tools/*.js            28 resource modules, one per Plane resource
```

Adding a resource: copy the matching module from
[plane-mcp-server](https://github.com/makeplane/plane-mcp-server), follow
`TOOLS-CONTRACT.md`, import it in `index.js`. Every module exports `name`,
`title`, `summary`, `actions`, `parameters`, `handler`; `index.js` injects the
`profile` param uniformly.

Test loading without installing:

```bash
pi -e ./index.js -p "Reply with only: ok"
```

## License

MIT
