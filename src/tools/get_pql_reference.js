export const name = "plane_get_pql_reference";
export const title = "PQL reference";
export const noProfile = true;
export const summary =
  "Plane Query Language (PQL) syntax reference. Call this before composing a `pql` " +
  "filter for the workitem list, list_archived or count actions.";

export const actions = [
  { name: "read", requires: [], optional: ["detail"], note: "this tool has no action parameter", read: true },
];

export const footer =
  "detail 'full' gives operators, functions, common mistakes and worked examples; " +
  "'brief' gives the compact field and operator quick reference.";

export const parameters = {
  type: "object",
  properties: {
    detail: {
      type: "string",
      enum: ["full", "brief"],
      description: "'full' for the complete reference, 'brief' for the compact quick reference (default full)",
    },
  },
  required: [],
};

const BRIEF = `Plane Query Language (PQL) filter string for work items in a project. Output ONLY valid PQL.

FIELDS
  priority          = "urgent" | "high" | "medium" | "low" | "none"
  stateGroup        = "backlog" | "unstarted" | "started" | "completed" | "cancelled"
  isDraft           = true | false   (also usable as predicate: isDraft() means isDraft = true)
  isArchived        = true | false   (also usable as predicate: isArchived() means isArchived = true)
  title             ~ "keyword"          (title search — use for most text queries)
  text              ~ "keyword"          (title + description — only when user asks to search body/content too)
  id                = "WEB-11"           (work item's own sequence identifier, e.g. "SHO-5")
  id                ~ "WEB"              (prefix search on the work item's sequence identifier)
  dueDate           date field
  startDate         date field
  createdAt         datetime field
  updatedAt         datetime field
  assignee          UUID  — use currentUser() for current user, or a member UUID
  state             UUID  — a state UUID
  label             UUID  — a label UUID
  cycle             UUID  — a cycle UUID, or activeCycle() / completedCycles() / upcomingCycles()
  module            UUID  — a module UUID
  project           UUID  — a project UUID
  createdBy         UUID  — a member UUID
  type              UUID  — a work item type UUID
  milestone         UUID  — a milestone UUID
  mention           UUID  — a member UUID
  subscriber        UUID  — a member UUID
  teamspaceProject  UUID  — a team project UUID

CUSTOM PROPERTIES  (cf["<property-uuid>"] syntax)
  cf["<property-uuid>"] = "<value>"
  cf["<property-uuid>"] IN ("<opt-uuid-1>", "<opt-uuid-2>")
  cf["<property-uuid>"] IS NULL

  To get property UUID and option UUIDs: call the work item types tool then the properties tool.
  Value rules: OPTION → option UUID (not display name); DECIMAL → bare number; BOOLEAN → bare true/false
  Skip EMAIL, FILE, FORMULA properties — they cannot be filtered.

OPERATORS
  =  !=  >  >=  <  <=  ~(contains)  IN(...)  NOT IN(...)
  IS NULL  IS NOT NULL  IS EMPTY  IS NOT EMPTY
  BETWEEN value AND value
  Logical: AND  OR  NOT   (precedence: NOT > AND > OR)

DATE FUNCTIONS
  today()  now()
  startOfDay()  endOfDay()  startOfWeek()  endOfWeek()
  startOfMonth()  endOfMonth()  startOfYear()  endOfYear()
  daysAgo(n)  daysFromNow(n)  weeksAgo(n)  weeksFromNow(n)
  monthsAgo(n)  monthsFromNow(n)
  ⚠ No date arithmetic: never today()-7 or startOfWeek()+1

USER FUNCTIONS
  currentUser()                        — resolved from OAuth token
  membersOf("project:<uuid>")          — list of user UUIDs in project
  workspaceMembers()                   — all workspace member UUIDs

CYCLE FUNCTIONS
  activeCycle()    completedCycles()    upcomingCycles()

STATE GROUP FUNCTIONS
  openStates()   →  ["backlog","unstarted","started"]
  closedStates() →  ["completed","cancelled"]
  activeStates() →  ["unstarted","started"]

PREDICATE FUNCTIONS  (standalone — no comparison needed)
  isOverdue()          hasNoAssignee()      hasNoLabel()
  isTopLevel()         isSubWorkItem()      isEpic()
  hasChildren()        hasStartAndDueDates()
  isDraft()            isArchived()         isIntake()

RELATION FUNCTIONS   (standalone — argument is work item id or UUID)
  childOf("WEB-5")     parentOf("WEB-5")    linkedTo("WEB-5")
  blockedBy("WEB-5")   blocks("WEB-5")      duplicateOf("WEB-5")

LIMITS
  Max 5 conditions. Each field comparison, predicate, or relation call = 1 condition.
  IN(...) and BETWEEN...AND... each count as 1.

EXAMPLES
  priority = "high" AND assignee = currentUser()
  isOverdue()
  stateGroup IN openStates() AND updatedAt < daysAgo(30)
  cycle IN activeCycle() AND stateGroup IN closedStates()
  title ~ "capex" AND priority IN ("high","urgent")
  dueDate BETWEEN (daysAgo(7), today())
  createdAt >= startOfWeek()
  hasNoAssignee() AND priority = "urgent"
  isEpic() AND hasChildren()
  childOf("WEB-5")
  id = "WEB-11"
  cf["<prop-uuid>"] = "<option-uuid>"

UUID fields (assignee, state, label, cycle, module, project, type, milestone, createdBy)
require a UUID — call the relevant list tool first if you only have a name.
Custom property UUIDs: call the work item types tool then the properties tool.

NOT SUPPORTED in PQL: history queries (wasEver, changedFrom, changedTo, commentedBy, etc.)
`;

const FULL = `## PQL (Plane Query Language) Reference

### Fields

| Field            | Type     | Valid Values / Notes                                               |
|---|---|---|
| priority         | string   | "urgent" "high" "medium" "low" "none"                              |
| stateGroup       | string   | "backlog" "unstarted" "started" "completed" "cancelled"            |
| isDraft          | boolean  | true / false (unquoted); isDraft() is shorthand for isDraft = true  |
| isArchived       | boolean  | true / false (unquoted); isArchived() is shorthand for isArchived = true |
| title            | string   | work item name — use ~ for contains                                |
| text             | string   | title + description — only when user explicitly asks to search body |
| id               | string   | work item's own sequence ID e.g. "SHO-5"                          |
| dueDate          | date     | "YYYY-MM-DD" or date function                                      |
| startDate        | date     | "YYYY-MM-DD" or date function                                      |
| createdAt        | datetime | "YYYY-MM-DD" or date function                                      |
| updatedAt        | datetime | "YYYY-MM-DD" or date function                                      |
| assignee         | UUID     | user UUID or currentUser()                                         |
| state            | UUID     | state UUID                                                         |
| label            | UUID     | label UUID                                                         |
| cycle            | UUID     | cycle UUID or activeCycle() / completedCycles() / upcomingCycles() |
| module           | UUID     | module UUID                                                        |
| project          | UUID     | project UUID                                                       |
| createdBy        | UUID     | user UUID                                                          |
| type             | UUID     | issue type UUID                                                    |
| milestone        | UUID     | milestone UUID                                                     |
| mention          | UUID     | user UUID                                                          |
| subscriber       | UUID     | user UUID                                                          |
| teamspaceProject | UUID     | team project UUID                                                  |

### Operators

| Operator              | Example                                          |
|---|---|
| =                     | priority = "high"                                |
| !=                    | stateGroup != "completed"                        |
| >  >=  <  <=          | dueDate < today()                                |
| ~ (contains)          | title ~ "capex"                                  |
| IN (...)              | priority IN ("high","urgent")                    |
| NOT IN (...)          | stateGroup NOT IN ("completed","cancelled")       |
| IS NULL               | dueDate IS NULL                                  |
| IS NOT NULL           | assignee IS NOT NULL                             |
| IS EMPTY              | label IS EMPTY                                   |
| IS NOT EMPTY          | label IS NOT EMPTY                               |
| BETWEEN val AND val   | dueDate BETWEEN (daysAgo(7), today())            |
| AND  OR  NOT          | priority = "high" AND NOT isArchived = true      |

Precedence: NOT > AND > OR. Use parentheses to override.

### Date Functions

\`\`\`
today()           now()
startOfDay()      endOfDay()
startOfWeek()     endOfWeek()
startOfMonth()    endOfMonth()
startOfYear()     endOfYear()
daysAgo(n)        daysFromNow(n)
weeksAgo(n)       weeksFromNow(n)
monthsAgo(n)      monthsFromNow(n)
\`\`\`
⚠ Date arithmetic NOT supported. Never: \`today() - 7\` or \`startOfWeek() + 1\`

### User Functions

\`\`\`
currentUser()                          — current authenticated user
membersOf("project:<uuid>")            — user UUIDs in project
membersOf("teamspace:<uuid>")          — user UUIDs in teamspace
workspaceMembers()                     — all workspace members
\`\`\`

### Cycle / State Group Functions

\`\`\`
activeCycle()        — cycles where start_date ≤ today ≤ end_date
completedCycles()    — cycles where end_date < today
upcomingCycles()     — cycles where start_date > today

openStates()         → ["backlog","unstarted","started"]
closedStates()       → ["completed","cancelled"]
activeStates()       → ["unstarted","started"]
\`\`\`

### Predicate Functions (standalone — no comparison needed)

\`\`\`
isOverdue()                — dueDate < today AND state in open states
hasNoAssignee()            — no assignee
hasNoLabel()               — no label
isTopLevel()               — no parent
isSubWorkItem()            — has a parent (any parent, not specific)
isEpic()                   — issue type is epic
hasChildren()              — has sub-items
hasStartAndDueDates()      — both startDate and dueDate are set
isDraft()                  — is a draft
isArchived()               — is archived
isIntake()                 — is an intake item
\`\`\`

### Relation Functions (standalone — pass work item id or UUID)

\`\`\`
childOf("WEB-5")           — sub-items OF a specific work item
parentOf("WEB-5")          — work items that are parent of a specific item
linkedTo("WEB-5")          — issues related to WEB-5 (both directions)
blockedBy("WEB-5")         — issues blocked by WEB-5
blocks("WEB-5")            — issues that block WEB-5
duplicateOf("WEB-5")       — issues that duplicate WEB-5
\`\`\`
Argument must be a work item identifier (e.g. "WEB-5") or UUID. Never a title.

### Custom Properties

Custom properties use \`cf["<property-uuid>"]\` as the field name.

**Workflow to get UUIDs:**
1. Call \`plane_workitem_type list\` with project_id → get \`type_id\`
2. Call \`plane_workitem_property list\` with type_id and project_id → get property UUID + option UUIDs
3. Use those UUIDs in the PQL expression

**Syntax:**
\`\`\`
cf["<property-uuid>"] = "<value>"
cf["<property-uuid>"] IN ("<opt-uuid-1>", "<opt-uuid-2>")
cf["<property-uuid>"] IS NULL
cf["<property-uuid>"] IS NOT NULL
\`\`\`

**Operator matrix — pick operators matching the property's type:**

| Property type   | Allowed operators                                              | Value shape                        |
|-----------------|----------------------------------------------------------------|------------------------------------|
| TEXT, URL       | =, !=, ~, IS NULL, IS NOT NULL, IS EMPTY, IS NOT EMPTY        | quoted string                      |
| OPTION          | =, !=, IN, NOT IN, IS NULL, IS NOT NULL                        | option UUID (quoted)               |
| RELATION        | =, !=, IN, NOT IN, IS NULL, IS NOT NULL                        | entity UUID (quoted)               |
| DECIMAL         | =, !=, >, >=, <, <=, BETWEEN...AND..., IS NULL, IS NOT NULL   | bare number (never quoted)         |
| DATETIME        | =, !=, >, >=, <, <=, BETWEEN...AND..., IS NULL, IS NOT NULL   | quoted "YYYY-MM-DD" or date fn     |
| BOOLEAN         | =, IS NULL, IS NOT NULL                                        | bare true / false (never quoted)   |
| EMAIL, FILE, FORMULA | — omit this condition entirely —                          | not filterable                     |

**Value typing rules:**
- OPTION: use the option's UUID, NEVER its display name
- DECIMAL: bare number — \`cf["uuid"] = 42\`, never \`cf["uuid"] = "42"\`
- BOOLEAN: bare \`true\`/\`false\` — \`cf["uuid"] = true\`, never \`cf["uuid"] = "true"\`
- DATETIME: quoted string or date function — \`cf["uuid"] >= daysAgo(7)\`
- Do NOT use IN/NOT IN on TEXT, URL, DECIMAL, DATETIME, or BOOLEAN properties

### Limits

- **Max 5 conditions** per query
- Each field comparison = 1 condition
- Each IN(...) = 1 condition (not one per value)
- Each BETWEEN...AND... = 1 condition
- Each predicate/relation function call = 1 condition

### UUID Fields — How to get UUIDs

UUID fields (assignee, state, label, cycle, module, project, createdBy, type, milestone,
mention, subscriber, teamspaceProject) require actual UUIDs. If you don't have a UUID,
call the matching list tool first:
  project    → \`plane_project list\`  then: project = "<uuid>"
  assignee   → \`plane_member list_workspace\`  then: assignee = "<uuid>"
  createdBy  → \`plane_member list_workspace\`  then: createdBy = "<uuid>"
  state      → \`plane_state list\`  then: state = "<uuid>"
  label      → \`plane_label list\`  then: label = "<uuid>"
  type       → \`plane_workitem_type list\`  then: type = "<uuid>"
  cycle      → \`plane_cycle list\`  then: cycle = "<uuid>"
  module     → \`plane_module list\`  then: module = "<uuid>"
  milestone  → \`plane_milestone list\`  then: milestone = "<uuid>"
  mention    → \`plane_member list_workspace\`  then: mention = "<uuid>"
  subscriber → \`plane_member list_workspace\`  then: subscriber = "<uuid>"

For custom property UUIDs:
  1. \`plane_workitem_type list\` with project_id               → get type_id
  2. \`plane_workitem_property list\` with type_id, project_id → property UUID + option UUIDs

Exception — these resolve without UUIDs:
- \`assignee = currentUser()\`
- \`cycle IN activeCycle()\`
- \`cycle IN completedCycles()\`
- \`stateGroup IN openStates()\` / \`closedStates()\` / \`activeStates()\`

### NOT Supported

History/activity queries are NOT available in PQL:
wasEver(), changedFrom(), changedTo(), changed(), updatedBy(), commentedBy(),
fieldChangedBy(), wasAssignedTo(), changedAfter(), changedBefore(), etc.

### Common Examples

\`\`\`pql
priority = "high" AND assignee = currentUser()
isOverdue()
stateGroup IN openStates() AND updatedAt < daysAgo(30)
cycle IN activeCycle() AND stateGroup IN closedStates()
title ~ "capex" AND priority IN ("high","urgent")
dueDate BETWEEN (daysAgo(7), today())
hasNoAssignee() AND priority = "urgent"
isEpic() AND hasChildren()
isSubWorkItem() AND hasStartAndDueDates()
childOf("WEB-5")
id = "WEB-11"
id ~ "WEB"
createdAt >= startOfWeek()
stateGroup NOT IN ("completed","cancelled") AND isOverdue()
assignee = currentUser() AND label = "<label-uuid>" AND stateGroup = "started"
cf["<prop-uuid>"] = "<option-uuid>"
cf["<prop-uuid>"] IN ("<opt-uuid-1>", "<opt-uuid-2>")
cf["<prop-uuid>"] IS NULL
cf["<decimal-prop-uuid>"] >= 5
cf["<bool-prop-uuid>"] = true
\`\`\`
`;

export async function handler(args) {
  if (args.detail === "brief") {
    return { detail: "brief", reference: BRIEF };
  }
  return { detail: "full", reference: FULL };
}
