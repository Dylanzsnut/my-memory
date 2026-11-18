# Documentation map

- Owner: Duy · Last verified: 2026-11-18 · Against HEAD: `d7aa8d2`

Read this file after `README.md` and `AGENTS.md`, before changing code. The
rules for where a fact lives are in `standards/documentation-playbook-v3.1.md`.

| Zone | Path | Authority |
|---|---|---|
| Product brief | `README.md` | Problem, quickstart, current status |
| Agent rules | `AGENTS.md` | Build commands, boundaries, workflow |
| System index | `ARCHITECTURE.md` (root) | Topology, flows, guardrails, links into as-built |
| Task source of truth | `plan/tasks.md` | All pending and completed work |
| Evidence | not present | No `IN-xxx` registered; do not create `inputs/` without evidence |
| Business / requirements | `requirements/` | `OUT`, `CON`, `REQ` with acceptance criteria |
| Historical design | `rfc/` | Frozen concept, CSD and UX spec; not build sources |
| Decisions | `adr/` | One decision per file; append-only |
| As-built truth | `as-built/` | Today's data, UI, verification, deep specs |
| Runbook / operations | `operations/WEB_SETUP.md` | Local setup, Firebase provisioning, deploy |
| Prototypes | `prototypes/` | Historical HTML/PNG design artifacts |
| Playbook | `standards/documentation-playbook-v3.1.md` | Documentation standard |
| Executable contracts | `contracts/README.md` | Pointers to code/rules that are the real source |

Retrieval order for implementation: `AGENTS.md` → `ARCHITECTURE.md` →
`as-built/DATA.md` if touching storage → `as-built/DESIGN.md` if touching UI →
the target module's docstrings. Do not implement from `rfc/` or `prototypes/`.
