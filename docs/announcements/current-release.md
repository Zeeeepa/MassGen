# MassGen v0.1.63 Release Announcement

<!--
This is the current release announcement. Copy this + feature-highlights.md to LinkedIn/X.
After posting, update the social links below.
-->

## Release Summary

We're excited to release MassGen v0.1.63 — Subagent Ensemble! 🚀 Subagents now run as an ensemble by default: each works independently with lighter refinement before voting, producing more diverse and higher-quality results. Plus: round evaluator transformation pressure & success contracts, and killed agent handling. Skills repo: https://github.com/massgen/skills

## Install

```bash
pip install massgen==0.1.63
```

## Links

- **Release notes:** https://github.com/massgen/MassGen/releases/tag/v0.1.63
- **X post:** [TO BE ADDED AFTER POSTING]
- **LinkedIn post:** [TO BE ADDED AFTER POSTING]

---

## Full Announcement (for LinkedIn)

Copy everything below this line, then append content from `feature-highlights.md`:

---

We're excited to release MassGen v0.1.63 — Subagent Ensemble! 🚀 Subagents now run as an ensemble by default: each works independently with lighter refinement before voting, producing more diverse and higher-quality results. Plus: round evaluator transformation pressure & success contracts, and killed agent handling. Skills repo: https://github.com/massgen/skills

**Key Improvement:**

🎯 **Ensemble Pattern** - Subagents now coordinate as an ensemble by default:
- `disable_injection` and `defer_voting_until_all_answered` default to true — subagents work independently before voting, producing more diverse and higher-quality results
- Lighter refinement prompts reduce token overhead for subagent workflows
- Ensemble defaults apply automatically when spawning subagent orchestrators, no config changes needed

**Plus:**
- 🔄 **Transformation pressure & success contracts** — round evaluator pushes agents toward meaningful structural changes and defines explicit quality gates before convergence
- 🛡️ **Killed agent handling** — graceful management of agents that time out or fail mid-round
- 🔧 **Timeout fallback** — more robust coordination at timeout boundaries

**Getting Started:**

```bash
pip install massgen==0.1.63
# Try the round evaluator with ensemble defaults
uv run massgen --config @examples/features/round_evaluator_example.yaml "Create a polished landing page for an AI product"
```

Release notes: https://github.com/massgen/MassGen/releases/tag/v0.1.63

Feature highlights:

<!-- Paste feature-highlights.md content here -->
