# plane-pi-tools

A [pi coding agent](https://github.com/earendil-works/pi-coding-agent) extension
for [Plane](https://plane.so) — bring your Plane projects, work items, cycles,
releases and more directly into your coding agent. Works with **Plane Cloud**
and **self-hosted Plane** through switchable profiles.

28 tools, one per Plane resource, 183 actions — a port of the official
[plane-mcp-server](https://github.com/makeplane/plane-mcp-server) tool surface
for pi.

## Quickstart

### 1. Install

```bash
pi install git:github.com/phoenixTW/plane-pi-extension
```

That is the whole installation. Pi clones the repo, registers the extension,
and the tools are available in every new `pi` session.

<details>
<summary>Other install options</summary>

```bash
# HTTPS URL
pi install https://github.com/phoenixTW/plane-pi-extension

# SSH (if you prefer SSH credentials)
pi install git:git@github.com:phoenixTW/plane-pi-extension

# Try it once without installing
pi -e git:github.com/phoenixTW/plane-pi-extension

# From a local checkout
pi install /path/to/plane-pi-extension

# Project-local install (shared with your team via .pi/settings.json)
pi install -l git:github.com/phoenixTW/plane-pi-extension
```

</details>

> The repository is currently **private**. Anyone who can clone it can install
> it. Make it public first if you want truly external users to install without
> repo access.

To update later: `pi update --extensions`. To remove: `pi remove` and pick the
package from the list.

### 2. Get a Plane API key

In Plane: **Workspace Settings → API tokens → Create token**.

Both token kinds work:

| Token | Where | Scope |
|---|---|---|
| Workspace API token | Workspace Settings → API tokens | One workspace |
| Personal access token (PAT) | Your profile settings | Your account; starts with `plane_api_` |

Either is passed the same way — the extension only needs the string.

### 3. Create a profile

Start `pi` and run:

```
/plane-profile
```

Pick `add` and answer the prompts:

- **Profile name** — any short name, e.g. `cloud`, `progresify`
- **Base URL** — press Enter for Plane Cloud, or type your self-hosted URL
  (e.g. `https://plane.example.com`)
- **API key** — paste the token
- **Workspace slug** — the slug in your Plane URL, e.g. `acme` in
  `plane.so/acme`

The extension tests the connection immediately: a green message confirms the
workspace; a red one tells you whether the **key** was rejected or the
**workspace slug** is wrong, so you know exactly what to fix.

First profile becomes the default automatically. Add as many as you like:

```
/plane-profile add mycompany      # self-hosted
/plane-profile default mycompany  # switch default
/plane-profile list               # see them all
```

### 4. Use it

Just ask in a pi session:

```
> list my plane projects
> show all urgent started work items in PLAT
> create a bug "Fix login redirect" in PLAT, priority urgent
> what did PROG-142 change? pull its activity
> add PROG-142 to the current cycle
```

The agent picks the right tool and action. No special syntax to learn.

## Profiles

A profile binds one Plane endpoint to one workspace:

| Field | Meaning |
|---|---|
| `name` | Profile key, used by `/plane-profile` and the `profile` tool param |
| `baseUrl` | API root. Empty = Plane Cloud (`https://api.plane.so`). Self-hosted = your Plane host |
| `apiKey` | API token (workspace token or PAT, both work) |
| `workspaceSlug` | Workspace slug the token belongs to |

Stored at `~/.pi/agent/extensions/plane-pi-tools/settings.json`, file mode
`0600`. Keys never leave your machine; the extension reads no environment
variables and makes no telemetry calls.

### Profile selection

1. Tool call with `profile: "progresify"` → uses that profile.
2. Tool call without `profile` → uses the default profile.
3. No default, or unknown name → the agent gets an error naming the available
   profiles and self-corrects on the next call.

This enables cross-instance questions:

```
> how many open items on cloud vs mycompany?
```

The agent runs one count per profile and compares.

### /plane-profile reference

```
/plane-profile                interactive menu
/plane-profile add [name]
/plane-profile list
/plane-profile default [name]
/plane-profile remove [name]
/plane-profile test [name]
/plane-profile show [name]    # API key redacted
```

All prompts use blocking dialogs, so they also work over RPC/headless sessions
with a UI attached.

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

Work item filtering uses **PQL** (Plane Query Language). The
`plane_get_pql_reference` tool carries the full syntax reference, so the agent
composes filters itself — and when a filter is invalid, the error response
points at the reference for a corrected retry.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `API key rejected` during `/plane-profile add` or on calls | Token wrong, expired, or deactivated. Create a fresh one in Workspace Settings → API tokens. |
| `API key is valid but workspace X is not reachable` | Wrong workspace slug — copy it from your Plane URL. |
| `no Plane profiles configured` | Run `/plane-profile` and add one. |
| `no default profile set` | `/plane-profile default <name>`, or pass `profile` explicitly. |
| `... is not available on this workspace's plan` | Feature is plan-gated on Plane Cloud or your self-hosted license. |
| 404 on a resource | Some resources need feature flags enabled for the project (e.g. releases). |
| Requests hang | 30 s timeout per request; check the base URL is reachable from your machine. |

## Development

```
index.js                  entry: registration, profile resolution, error formatting
src/settings.js           profile store (load/save/validate/normalize)
src/plane-client.js       REST client (fetch, X-Api-Key, timeouts)
src/profiles-command.js   /plane-profile interactive command
src/toolkit.js            action catalogs, validation, envelopes, plan gates
src/tools/*.js            28 resource modules, one per Plane resource
```

No dependencies — plain Node ESM, Node >= 18. Adding a resource: follow
`TOOLS-CONTRACT.md`, port the matching module from
[plane-mcp-server](https://github.com/makeplane/plane-mcp-server), import it in
`index.js`.

Test without installing:

```bash
pi -e /path/to/plane-pi-extension/index.js -p "Reply with only: ok"
```

## License

MIT
