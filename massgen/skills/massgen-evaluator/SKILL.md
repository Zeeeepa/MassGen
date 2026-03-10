---
name: massgen-evaluator
description: Get multi-agent evaluation and critical feedback on your current work by invoking MassGen. Use whenever you've iterated enough and need outside perspective, before submitting PRs, or when you want diverse AI evaluators to critique code, documents, or artifacts in your working directory. Use this skill when you've stalled, need a second opinion, want pre-PR review, or need critical evaluation of any work artifact.
---

# MassGen Evaluator

Invoke MassGen's multi-agent evaluation to get diverse, critical feedback on your work. Multiple AI agents independently evaluate your artifacts and converge on the strongest critique through MassGen's checklist-gated voting system.

## When to Use

- After iterating and stalling — need outside perspective
- Before submitting PRs or delivering artifacts
- When wanting diverse AI perspectives on implementation quality
- Whenever you've self-improved as much as you can alone

## Scope

Before starting, determine which deliverables the evaluation covers.
Evaluations are most effective when focused on specific artifacts, not
"everything in the repo."

**When invoking this skill, specify the scope:**

- **Which files/artifacts to evaluate** — e.g., `src/api/handler.ts`,
  `beatles/index.html`, `docs/architecture.md`
- **What to ignore** — e.g., test fixtures, generated files, vendored deps
- **Evaluation focus** (optional) — security, performance, architecture,
  test coverage, code quality, or general

If the user doesn't specify scope, ask them. A scoped evaluation with 1-3
deliverables produces far better critiques than an unscoped "review everything."

The scope flows into three places:
1. **Context file** (Step 1) — "Deliverables in Scope" and "Out of Scope"
2. **Evaluation criteria** (Step 2) — criteria tailored to the scoped deliverables
3. **Prompt** (Step 3) — evaluators know exactly what to inspect

## Prerequisites

1. **Check if massgen is installed**:
   ```bash
   uv run massgen --help 2>/dev/null || massgen --help 2>/dev/null
   ```

2. **If not installed**:
   ```bash
   pip install massgen
   # or
   uv pip install massgen
   ```

3. **If no config exists** (`.massgen/config.yaml`), run headless quickstart:
   ```bash
   uv run massgen --quickstart --headless
   ```
   This auto-detects API keys, selects the best backend, generates config,
   and installs Docker/skills. If no API keys are found, it creates a
   `.env` template for the user to fill in.

## Workflow

### Step 0: Create Evaluation Directory

Create a timestamped subdirectory so parallel evaluations don't conflict:

```bash
EVAL_DIR=".massgen/eval/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVAL_DIR"
```

All evaluation artifacts (context, criteria, prompt, output, logs) go in this directory.

### Step 1: Write the Context File

Write `$EVAL_DIR/context.md` with structured context about the work being evaluated.

The context file has two jobs: (1) orient the evaluators so they don't waste
time discovering basic facts, and (2) stay out of the way so evaluators can
find problems **you don't know about**. Do NOT bias the evaluators toward
your known issues — that's what your own iteration loop is for. The whole
point of MassGen evaluation is fresh eyes finding what you missed.

**What you provide** (evaluators cannot infer this):
- What was built and why (the task, not your assessment of quality)
- Scope — which files to look at, which to ignore
- Factual state — git info, file structure, test output
- Verification evidence already gathered (so evaluators don't re-run it)

**What you explicitly do NOT provide:**
- Your opinion on what's wrong — that biases the evaluators
- Detailed acceptance criteria checklists — the evaluation criteria (Step 2) handle this
- "Areas of concern" — the evaluators should discover concerns independently

**Context file template:**

```markdown
## Deliverables in Scope
<the specific files/artifacts to evaluate — list each file path and what it is>

## Out of Scope
<files/directories evaluators should NOT spend time on>

## Original Task
<what the user asked for — keep factual, not evaluative>

## What Was Done
<summary of implementation work completed — facts, not quality judgments>

## File Structure
<relevant directory tree / key files overview>

## Git Info
<git diff --stat, recent commits, branch info>
<for patches: include actual diff or key changed files>

## Verification Evidence
<test output, build results, lint output — raw facts the evaluators can reuse>

## Known Stuck Points (optional)
<ONLY if you have specific problems you've tried and failed to fix>
<describe what you tried and why it didn't work — evaluators will prescribe
a different strategy. do NOT list general concerns or quality worries here>
```

The context splits into two evaluation modes:

1. **Known stuck points**: You know what's wrong but can't fix it. List what
   you tried and why it failed. The evaluator diagnoses your failure mode and
   prescribes a different approach.

2. **Unknown unknowns** (the primary value): You don't know what's wrong.
   The evaluation criteria (Step 2) express what you *value* at a high level.
   The evaluator discovers specific problems you didn't know existed by
   applying those criteria against the actual deliverables. This is why the
   context file should NOT contain your quality opinions — they anchor the
   evaluator to your blind spots instead of letting it see past them.

### Step 2: Generate Evaluation Criteria

Read the criteria writing guide at `references/eval_criteria_guide.md`
(relative to this skill).

Criteria express **what you value** — the quality dimensions that matter for
this deliverable. They are NOT a list of known problems. The evaluator uses
your criteria as a lens to discover specific issues you haven't seen yet.

Generate 4-7 criteria as a JSON file. Each criterion names a quality axis
and describes what to look for, following the tier system from the guide.

If there's a specific evaluation focus (security, performance, architecture,
test coverage, code quality), weight your criteria toward that focus area.
In Claude Code: use AskUserQuestion to ask the user for focus preference.
In Codex or non-interactive: default to general coverage.

```bash
cat > $EVAL_DIR/criteria.json << 'EOF'
[
  {"text": "...", "category": "must"},
  {"text": "...", "category": "must"},
  {"text": "...", "category": "should"},
  {"text": "...", "category": "should", "verify_by": "..."},
  {"text": "...", "category": "could"}
]
EOF
```

These criteria are passed to MassGen via `--eval-criteria` and used by
the checklist-gated voting system to evaluate agent answers. This is
faster and more precise than MassGen's internal criteria generation
subagent, because you already have the full task context.

### Step 3: Construct the Evaluation Prompt

1. Read the prompt template from `references/evaluation_prompt_template.md` (relative to this skill)
2. Read the context file you wrote in Step 1
3. Replace `{{CONTEXT_FILE_CONTENT}}` with the context file contents
4. Replace `{{CUSTOM_FOCUS}}` with the focus directive (or empty string for General)
5. Write the final prompt to `$EVAL_DIR/prompt.md`

### Step 4: Run MassGen (in background) and Open Viewer

Launch MassGen in the background and open the web viewer so the user
can observe evaluation progress in their browser.

**4a. Start MassGen in background, capturing the log directory:**

Run this command in the background using your agent's native mechanism
(e.g., `run_in_background` in Claude Code):

```bash
uv run massgen --automation \
  --no-parse-at-references \
  --cwd-context ro \
  --eval-criteria $EVAL_DIR/criteria.json \
  --output-file $EVAL_DIR/result.md \
  "$(cat $EVAL_DIR/prompt.md)" \
  > $EVAL_DIR/output.log 2>&1
```

**4b. Extract the log directory and launch the web viewer:**

The automation output's first line is `LOG_DIR: <path>`. Once MassGen
has started (usually within 2 seconds), extract the log directory from
the output and launch the viewer:

```bash
LOG_DIR=$(grep -m1 '^LOG_DIR:' $EVAL_DIR/output.log | cut -d' ' -f2)
```

Then launch the web viewer (also in the background):

```bash
uv run massgen viewer "$LOG_DIR" --web
```

The viewer automatically opens `http://localhost:8000` in the user's
browser, showing live agent rounds, voting, and convergence as they
happen. No need to open the browser yourself — it launches automatically.

**Flags explained:**
- `--automation`: clean parseable output, no TUI
- `--no-parse-at-references`: prevents MassGen from interpreting `@path` in the prompt text
- `--cwd-context ro`: gives evaluators read-only access to the current working directory
- `--eval-criteria`: passes your task-specific criteria JSON (overrides any YAML inline criteria)
- `--output-file`: writes the winning evaluator's answer to a parseable file

No `--config` flag — uses the default config from `.massgen/config.yaml`.

**Timing:** expect 2-10 minutes for standard evaluations, 10-30 minutes for complex tasks.

### Step 5: Parse the Output

The evaluator agents produce three structured files in the winner's workspace.
The workspace path is shown in `$EVAL_DIR/result.md` (look for "Workspace cwd"
or check `status.json` in the log directory for `workspace_paths`).

From the winner's workspace, read:

1. **`verdict.json`** — machine-readable verdict and per-criterion scores
   ```json
   {"schema_version": "1", "verdict": "iterate", "scores": {"E1": 4, "E2": 7}}
   ```
2. **`next_tasks.json`** (when verdict is "iterate") — machine-readable task
   handoff with `objective`, `primary_strategy`, and `tasks[]` each containing
   `implementation_guidance` with concrete step-by-step instructions
3. **`critique_packet.md`** — full prose critique with `improvement_spec`,
   `preserve`, `unexplored_approaches`, and `evidence_gaps`

The `$EVAL_DIR/result.md` file contains a concise summary referencing these files.

### Step 6: Apply the Feedback

Read `verdict.json` first:

- **`"iterate"`**: Read `next_tasks.json` and execute the tasks in order.
  Each task's `implementation_guidance` has specific techniques and steps.
  Pay attention to `prior_attempt_awareness` — if the evaluators identified
  failed approaches, do NOT retry them. Consult `critique_packet.md` for
  the full `improvement_spec` with `concrete_steps` per criterion.
- **`"converged"`**: The work meets the quality bar. Proceed to delivery.

## Output Structure Reference

The evaluator produces three files in the winner's workspace:

| File | Format | Purpose |
|---|---|---|
| `verdict.json` | JSON | Machine-readable verdict (`iterate`/`converged`) + per-criterion scores (E1..EN, 1-10) |
| `next_tasks.json` | JSON | Implementation handoff: `objective`, `primary_strategy`, `tasks[]` with `implementation_guidance` |
| `critique_packet.md` | Markdown | Full prose critique (see sections below) |

**`critique_packet.md` sections:**

| Section | Purpose |
|---|---|
| `criteria_interpretation` | What each requirement really demands |
| `criterion_findings` | Where the work falls short, with evidence |
| `cross_answer_synthesis` | Strongest dimensions, gaps, what improvement looks like |
| `unexplored_approaches` | 1-3 fresh ideas nobody tried yet |
| `preserve` | What must survive into the next revision |
| `improvement_spec` | Design spec with `concrete_steps` per criterion |
| `verification_plan` | Checks to rerun after implementation |
| `evidence_gaps` | Missing evidence that limited the critique |
| **Evaluation Summary** | Quick-reference: verdict, top improvements, preserve, next steps |

## Example Invocations

### Pre-PR Code Review

```bash
# Create eval directory
EVAL_DIR=".massgen/eval/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EVAL_DIR"

# Write context (scope: 2 specific deliverables, no quality opinions)
cat > $EVAL_DIR/context.md << 'EOF'
## Deliverables in Scope
- `massgen/websocket_handler.py` — WebSocket server implementation
- `webui/src/hooks/useAgentStatus.ts` — client-side React hook

## Out of Scope
- Test files, CI config, package.json changes

## Original Task
Add WebSocket support for real-time agent status updates

## What Was Done
Implemented WebSocket server and client hook. Server broadcasts agent state
changes, client subscribes per session. Uses native WebSocket API.

## Git Info
Branch: feat/websocket-status (12 commits ahead of main)
Key files changed: websocket_handler.py, useAgentStatus.ts, types.ts

## Verification Evidence
pytest: 47 passed, 0 failed
vitest: 12 passed, 0 failed
EOF

# Write criteria
cat > $EVAL_DIR/criteria.json << 'EOF'
[
  {"text": "Reconnection reliability: WebSocket auto-reconnects within 5s of disconnect with exponential backoff, no message loss during reconnect window.", "category": "must"},
  {"text": "Latency requirement: status updates arrive at the client within 500ms of agent state change under normal load.", "category": "must"},
  {"text": "Concurrency: system handles 3+ simultaneous agent sessions without message cross-contamination or dropped updates.", "category": "must"},
  {"text": "Error handling: connection failures, malformed messages, and server errors produce clear client-side feedback without crashing the UI.", "category": "should"},
  {"text": "Code quality: WebSocket handler and client hook have clean separation of concerns, no duplicated state management, and consistent error patterns.", "category": "should"}
]
EOF

# Build prompt (fill template, then invoke in background)
# ... (follow Step 3 to construct prompt from template)

# Run in background using your agent's native mechanism
uv run massgen --automation --no-parse-at-references --cwd-context ro \
  --eval-criteria $EVAL_DIR/criteria.json \
  --output-file $EVAL_DIR/result.md \
  "$(cat $EVAL_DIR/prompt.md)" \
  > $EVAL_DIR/output.log 2>&1

# Extract LOG_DIR and open web viewer (also in background)
LOG_DIR=$(grep -m1 '^LOG_DIR:' $EVAL_DIR/output.log | cut -d' ' -f2)
uv run massgen viewer "$LOG_DIR" --web
```

### Architecture Evaluation

Write a context file focused on architecture decisions, generate criteria weighted toward design patterns and extensibility, and invoke as above.

### Post-Implementation Quality Check

After completing a feature, write a context file summarizing what was done and generate general-purpose criteria to catch issues across all dimensions.

## Reference Files

- `references/eval_criteria_guide.md` — how to write good evaluation criteria (format, tiers, examples)
- `references/evaluation_prompt_template.md` — the full prompt template with placeholders
- `massgen/subagent_types/round_evaluator/SUBAGENT.md` — source methodology for the evaluation approach
- `massgen/skills/massgen-develops-massgen/SKILL.md` — reference pattern for invoking MassGen via `--automation`
