---
name: massgen
description: Invoke MassGen's multi-agent system for evaluation, planning, or spec writing. Use whenever you need outside perspective on your work, a thoroughly refined plan, or a well-specified set of requirements. Perfect for: pre-PR review, complex project planning, feature specification, architecture decisions, or any task where multi-agent iteration produces better results than working alone.
---

# MassGen

Invoke MassGen for multi-agent iteration on evaluation, planning, or spec writing. Multiple AI agents independently work on the problem and converge on the strongest result through MassGen's checklist-gated voting system.

## When to Use

**Evaluate** — get diverse, critical feedback on existing work:
- After iterating and stalling — need outside perspective
- Before submitting PRs or delivering artifacts
- When wanting diverse AI perspectives on implementation quality

**Plan** — create or refine a structured project plan:
- When starting a complex feature or project that needs task decomposition
- When an existing plan has gaps, is too vague, or needs restructuring
- When you need a valid task DAG with verification criteria

**Spec** — create or refine a requirements specification:
- When starting a feature that needs precise requirements before implementation
- When an existing spec has ambiguities, missing edge cases, or gaps
- When you need EARS-formatted requirements with acceptance criteria

## Mode Selection

| Mode | Purpose | Input | Output | Default Criteria Preset |
|------|---------|-------|--------|------------------------|
| evaluate | Critique existing work | Artifacts to evaluate | `critique_packet.md`, `verdict.json`, `next_tasks.json` | `"evaluation"` |
| plan | Create or refine a plan | Goal + constraints (+ existing plan) | `project_plan.json` (tasks, chunks, deps, verification) | `"planning"` |
| spec | Create or refine a spec | Problem + needs (+ existing spec) | `project_spec.json` (EARS requirements, chunks, rationale) | `"spec"` |

## Scope

Before starting, determine what the MassGen invocation covers. Focused invocations
produce far better results than unscoped "do everything" runs.

**When invoking this skill, specify the scope:**

- **Evaluate**: which files/artifacts to evaluate, what to ignore, evaluation focus
- **Plan**: the goal/objective, constraints, what context to include
- **Spec**: the problem to specify, user needs, system boundaries

If the user doesn't specify scope, ask them.

## Prerequisites

### 1. Check if massgen is installed

```bash
uv run massgen --help 2>/dev/null || massgen --help 2>/dev/null
```

If not installed:
```bash
pip install massgen
# or
uv pip install massgen
```

### 2. Resolve configuration

Ask the user (via AskUserQuestion in interactive environments):

> Do you have an existing MassGen config you'd like to use?
> If so, provide the path. Otherwise I'll use `.massgen/config.yaml`
> (or set one up if it doesn't exist).

- **User provides a config path**: use it with `--config <path>` in Step 4
- **User says no / default**: check if `.massgen/config.yaml` exists
  - If it exists: use it (no `--config` flag needed)
  - If it doesn't exist: proceed to **Setup** below

### 3. Setup (only if no config exists)

Ask the user two things:

**Question 1 — Execution mode** (recommend Docker):

> Should MassGen agents run in **Docker containers** (recommended — isolated
> and safer for code execution) or **locally**?

**Question 2 — AI provider(s) and model(s):**

To see all supported backends, models, capabilities, and auth requirements:
```bash
uv run massgen --list-backends
```

Ask the user which provider(s) and model(s) to use. They can pick one
provider for all agents, or mix providers for diversity.

Once the user picks, ensure authentication is set up. Agent-based backends
(`claude_code`, `codex`, `copilot`) support local login as an alternative
to API keys:

- **Login-based**: tell the user to run the provider's login command
  (e.g., `claude login`, `codex login`) if not already logged in
- **API key-based**: check if the relevant env var is set (visible in the
  `--list-backends` output). If not, help create a `.env` file with the
  appropriate variable and tell the user to fill in their key

**Generate the config** using headless quickstart with the user's choices:

```bash
# Single provider (3 agents, all same backend):
uv run massgen --quickstart --headless \
  --config-backend <backend_type> \
  --config-model <model> \
  --config-docker  # include only if user chose Docker

# Multi-provider (one agent per backend, diverse perspectives):
uv run massgen --quickstart --headless \
  --config-backend claude,openai,gemini \
  --config-model claude-opus-4-6,gpt-5.4,gemini-3-flash-preview \
  --config-docker
```

This generates `.massgen/config.yaml`, installs default skills, and
pulls the Docker image if Docker was selected. If an API key is missing,
it creates a `.env` template for the user to fill in.

## Workflow

### Step 0: Create Working Directory

Create a timestamped subdirectory so parallel invocations don't conflict:

```bash
MODE="evaluate"  # or "plan" or "spec"
WORK_DIR=".massgen/$MODE/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"
```

All artifacts (context, criteria, prompt, output, logs) go in this directory.

### Step 1: Clarify & Write Context File

Read `references/<mode>/workflow.md` (relative to this skill) for the context
file template specific to your mode.

Write `$WORK_DIR/context.md` using the template from the workflow file.

**Key principle for all modes**: provide factual context that orients the MassGen
agents. Do NOT bias them with your opinions about quality — let them discover
issues independently. That's the whole point of multi-agent evaluation.

- **Evaluate**: describe what was built, scope, git info, verification evidence
- **Plan**: describe the goal, constraints, existing context, success criteria
- **Spec**: describe the problem, user needs, system boundaries, constraints

### Step 2: Generate Criteria

Each mode has a default criteria preset that is applied automatically when no
`--eval-criteria` flag is provided:

| Mode | Preset | Criteria Count |
|------|--------|---------------|
| evaluate | `"evaluation"` | Generated per-task |
| plan | `"planning"` | 5 must + 3 should |
| spec | `"spec"` | 3 must + 1 should + 1 could |

**To use the default preset**: omit the `--eval-criteria` flag entirely. MassGen
will use the preset matching the prompt content.

**To use custom criteria**: read `references/criteria_guide.md` for the format
and writing guide, then write criteria JSON to `$WORK_DIR/criteria.json`.

If there's a specific focus area, weight your criteria toward that focus.
In Claude Code: use AskUserQuestion to ask the user for focus preference.
In Codex or non-interactive: default to general coverage.

```bash
cat > $WORK_DIR/criteria.json << 'EOF'
[
  {"text": "...", "category": "must"},
  {"text": "...", "category": "must"},
  {"text": "...", "category": "should"},
  {"text": "...", "category": "could"}
]
EOF
```

### Step 3: Construct the Prompt

1. Read the prompt template from `references/<mode>/prompt_template.md` (relative to this skill)
2. Read the context file you wrote in Step 1
3. Replace `{{CONTEXT_FILE_CONTENT}}` with the context file contents
4. Replace `{{CUSTOM_FOCUS}}` with the focus directive (or empty string if none)
5. Write the final prompt to `$WORK_DIR/prompt.md`

### Step 4: Run MassGen (in background) and Open Viewer

Launch MassGen in the background and open the web viewer so the user
can observe progress in their browser.

**4a. Start MassGen in background, capturing the log directory:**

Run this command in the background using your agent's native mechanism
(e.g., `run_in_background` in Claude Code):

```bash
uv run massgen --automation \
  --no-parse-at-references \
  --cwd-context ro \
  --eval-criteria $WORK_DIR/criteria.json \
  --output-file $WORK_DIR/result.md \
  "$(cat $WORK_DIR/prompt.md)" \
  > $WORK_DIR/output.log 2>&1
```

If using default criteria (no custom criteria file), omit the `--eval-criteria` flag.

**4b. Extract the log directory and launch the web viewer:**

The automation output's first line is `LOG_DIR: <path>`. Once MassGen
has started (usually within 2 seconds), extract the log directory from
the output and launch the viewer:

```bash
LOG_DIR=$(grep -m1 '^LOG_DIR:' $WORK_DIR/output.log | cut -d' ' -f2)
```

Then launch the web viewer (also in the background):

```bash
uv run massgen viewer "$LOG_DIR" --web
```

The viewer automatically opens `http://localhost:8000` in the user's
browser, showing live agent rounds, voting, and convergence as they
happen.

**Flags explained:**
- `--automation`: clean parseable output, no TUI
- `--no-parse-at-references`: prevents MassGen from interpreting `@path` in the prompt text
- `--cwd-context ro`: gives agents read-only access to the current working directory
- `--eval-criteria`: passes your task-specific criteria JSON (overrides presets)
- `--output-file`: writes the winning agent's answer to a parseable file

No `--config` flag — uses the default config from `.massgen/config.yaml`.

**Timing:** expect 2-10 minutes for standard tasks, 10-30 minutes for complex ones.

### Step 5: Parse the Output

The output depends on the mode. The winner's workspace path is shown in
`$WORK_DIR/result.md` (look for "Workspace cwd" or check `status.json` in
the log directory for `workspace_paths`).

**Evaluate mode**: three files — `verdict.json`, `next_tasks.json`, `critique_packet.md`.
Read `verdict.json` first to determine iterate vs converged.
See `references/evaluate/workflow.md` for full output structure.

**Plan mode**: `project_plan.json` — structured task list with chunks,
dependencies, and verification. May include auxiliary files in `research/`,
`framework/`, `risks/` subdirectories.
See `references/plan/workflow.md` for full output structure.

**Spec mode**: `project_spec.json` — EARS requirements with chunks,
rationale, and verification. May include auxiliary files in `research/`,
`design/`, `decisions/` subdirectories.
See `references/spec/workflow.md` for full output structure.

### Step 6: Ground in Your Native Task System

**This is the most critical step.** MassGen produced a structured result —
now you must internalize it by entering your native task/plan mode and
enumerating every task or requirement as a tracked item. Without this,
the plan is just text that fades from context as you work.

**Why this matters**: agents that skip this step tend to execute the first
few tasks, then drift — forgetting verification steps, skipping later
tasks, or losing track of dependencies. Grounding forces you to commit
to the full scope before executing anything.

**For all modes:**

1. **Enter your task planning mode** (e.g., TodoWrite in Claude Code,
   task tracking in Codex, or whatever native tracking your environment
   provides)
2. **Create one tracked task per item** from the MassGen output:
   - **Evaluate**: each task from `next_tasks.json` becomes a tracked task,
     preserving `implementation_guidance`, `depends_on`, and `verification`
   - **Plan**: each task from `project_plan.json` becomes a tracked task,
     preserving chunk ordering, dependencies, and verification criteria
   - **Spec**: each requirement from `project_spec.json` becomes a tracked
     task (implement + verify), preserving priority, dependencies, and
     acceptance criteria
3. **Preserve the dependency order** — don't flatten the DAG. Tasks in
   chunk C01 must complete before C02 tasks begin
4. **Include verification as explicit tasks** — don't just track "implement
   X", also track "verify X meets [criteria]". Verification that isn't
   tracked doesn't happen
5. **Mark each task's status** as you work: pending → in_progress → completed

**Then execute in order**, updating status as you go. When you complete a
task, check it off and move to the next one. This creates an execution
trace that keeps you honest about what's done and what remains.

### Step 7: Execute and Iterate

**Evaluate**: read `verdict.json` — if `"iterate"`, work through the
tasks you just grounded from `next_tasks.json`. If `"converged"`,
proceed to delivery.

**Plan / Spec**: store the result as a living document (see below),
then execute the grounded tasks chunk by chunk.

## Living Document Protocol (Plan & Spec Modes)

This is the most important section for plan/spec modes — it defines how
the output is used after MassGen produces it.

### Store

Adopt the MassGen output into `.massgen/plans/` using the existing
`PlanStorage` infrastructure:

```
.massgen/plans/plan_<timestamp>/
├── workspace/          # Mutable working copy
│   ├── plan.json       # (renamed from project_plan.json) or spec.json
│   └── research/       # Auxiliary files from MassGen output
├── frozen/             # Immutable snapshot (identical to workspace/ at creation)
│   ├── plan.json       # or spec.json
│   └── research/
└── plan_metadata.json  # artifact_type, status, chunk_order, context_paths
```

Copy `project_plan.json` → `workspace/plan.json` (or `project_spec.json` →
`workspace/spec.json`). Copy any auxiliary directories. Create `frozen/` as
an identical snapshot.

### Read on Restart

**FIRST ACTION** in every new session: read `workspace/plan.json` (or
`workspace/spec.json`). This is the source of truth for what's done and
what's next.

### Update Continuously

As tasks complete (plan) or requirements are implemented (spec), update
the workspace copy. Mark status, add notes, record discoveries.
The workspace copy is a living document.

### Check Drift

Periodically compare `workspace/` against `frozen/`. The existing
`PlanSession.compute_plan_diff()` returns a `divergence_score`
(0.0 = no drift, 1.0 = complete rewrite). High drift means re-evaluate
whether the plan/spec is still valid.

### Refine When Stuck

If the plan/spec proves wrong or incomplete, re-invoke this skill with
the workspace copy as "What Already Exists" to get multi-agent refinement.
This creates a new plan directory with a fresh `frozen/` snapshot.

### Don't Drift Silently

If you deviate from the plan/spec, update the workspace copy first.
An outdated plan is worse than no plan.

## Mode Overviews

### Evaluate

Critique existing work artifacts. Evaluator agents inspect your code,
documents, or deliverables and produce a structured critique with
machine-readable verdict, per-criterion scores, and actionable
improvement tasks. The checklist-gated voting system ensures agents
converge on the strongest critique.

See `references/evaluate/workflow.md` for the full context template,
output structure, and examples.

### Plan

Create or refine a structured project plan. Planning agents decompose
the goal into a task DAG with chunks, dependencies, verification
criteria, and technology choices. Each round of MassGen iteration
improves task quality — descriptions get more actionable, verification
gets more specific, sequencing gets tighter.

See `references/plan/workflow.md` for the full context template,
output format, and lifecycle.

### Spec

Create or refine a requirements specification. Spec agents produce
EARS-formatted requirements with acceptance criteria, rationale,
and verification. Iteration focuses on precision — each round
eliminates ambiguities, fills gaps, and strengthens edge case coverage.

See `references/spec/workflow.md` for the full context template,
output format, and lifecycle.

## Condensed Examples

### Evaluate: Pre-PR Review

```bash
WORK_DIR=".massgen/evaluate/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"

# Write context (scope: specific deliverables, no quality opinions)
cat > $WORK_DIR/context.md << 'EOF'
## Deliverables in Scope
- `src/api/handler.ts` — API request handler
- `src/hooks/useAuth.ts` — authentication hook

## Out of Scope
- Test files, CI config

## Original Task
Add JWT authentication to the API layer

## What Was Done
Implemented JWT validation in handler and auth hook for React components.

## Verification Evidence
pytest: 24 passed, 0 failed
EOF

# Write criteria (or omit --eval-criteria to use default preset)
cat > $WORK_DIR/criteria.json << 'EOF'
[
  {"text": "Auth security: JWT validation covers expiration, signature, and audience checks.", "category": "must"},
  {"text": "Error handling: invalid/expired tokens produce clear error responses.", "category": "must"},
  {"text": "Code quality: clean separation between auth logic and business logic.", "category": "should"}
]
EOF

# Build prompt from template, then run
uv run massgen --automation --no-parse-at-references --cwd-context ro \
  --eval-criteria $WORK_DIR/criteria.json \
  --output-file $WORK_DIR/result.md \
  "$(cat $WORK_DIR/prompt.md)" > $WORK_DIR/output.log 2>&1
```

### Plan: New Feature Planning

```bash
WORK_DIR=".massgen/plan/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"

cat > $WORK_DIR/context.md << 'EOF'
## Goal
Add real-time collaboration to the document editor — multiple users
editing the same document simultaneously with cursor presence.

## Constraints
- Must work with existing PostgreSQL database
- Timeline: 2 weeks
- Team: 2 engineers

## Existing Context
Express.js backend, React frontend, WebSocket already used for notifications.

## Success Criteria
Two users can edit the same document with <500ms sync latency and no data loss.
EOF

# Uses default "planning" preset — no --eval-criteria needed
# Build prompt from references/plan/prompt_template.md, then run
uv run massgen --automation --no-parse-at-references --cwd-context ro \
  --output-file $WORK_DIR/result.md \
  "$(cat $WORK_DIR/prompt.md)" > $WORK_DIR/output.log 2>&1
```

### Spec: Feature Specification

```bash
WORK_DIR=".massgen/spec/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$WORK_DIR"

cat > $WORK_DIR/context.md << 'EOF'
## Problem Statement
Users cannot recover deleted items — deletion is permanent and irreversible.

## User Needs / Personas
- End users: accidentally delete items, need easy recovery
- Admins: need to purge items for compliance after retention period

## Constraints
- PostgreSQL database, soft-delete pattern preferred
- 30-day retention before permanent purge
- Must not break existing API consumers
EOF

# Uses default "spec" preset — no --eval-criteria needed
# Build prompt from references/spec/prompt_template.md, then run
uv run massgen --automation --no-parse-at-references --cwd-context ro \
  --output-file $WORK_DIR/result.md \
  "$(cat $WORK_DIR/prompt.md)" > $WORK_DIR/output.log 2>&1
```

## Reference Files

- `references/criteria_guide.md` — how to write quality criteria (format, tiers, examples)
- `references/evaluate/workflow.md` — evaluate mode context template, output structure, examples
- `references/evaluate/prompt_template.md` — evaluation prompt template with placeholders
- `references/plan/workflow.md` — plan mode context template, output format, lifecycle
- `references/plan/prompt_template.md` — planning prompt template with placeholders
- `references/spec/workflow.md` — spec mode context template, output format, lifecycle
- `references/spec/prompt_template.md` — spec prompt template with placeholders
- `massgen/subagent_types/round_evaluator/SUBAGENT.md` — source methodology for evaluation
- `massgen/skills/massgen-develops-massgen/SKILL.md` — reference pattern for `--automation`
