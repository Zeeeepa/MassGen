# Project Context

## Purpose
MassGen (Multi-Agent Scaling System for GenAI) is a cutting-edge multi-agent orchestration framework that leverages collaborative AI to solve complex tasks. It assigns tasks to multiple AI agents who work in parallel, observe each other's progress, and refine their approaches to converge on the best solution. The system implements "threads of thought" and "iterative refinement" patterns, enabling cross-model synergy between different LLM providers.

### Key Goals
- Enable parallel multi-agent collaboration across diverse frontier models (Claude, GPT, Gemini, Grok, etc.)
- Provide real-time intelligence sharing between agents during task execution
- Build consensus through voting and evaluation mechanisms
- Support Model Context Protocol (MCP) for extensible tool integrations
- Deliver comprehensive logging and visualization of agent interactions

## Tech Stack
- **Language**: Python 3.12+
- **Package Manager**: uv (preferred over pip)
- **Build System**: setuptools with pyproject.toml
- **LLM SDKs**: anthropic, openai, google-genai, xai-sdk, cerebras-cloud-sdk, litellm
- **Agent Frameworks**: claude-agent-sdk, ag2, pyautogen, agentscope, smolagents, langgraph
- **CLI/TUI**: rich, textual, questionary
- **MCP Support**: mcp, fastmcp
- **Async/HTTP**: aiohttp, nest-asyncio, fastapi, uvicorn
- **Documentation**: Sphinx with sphinx-book-theme (published to ReadTheDocs)
- **Testing**: pytest, pytest-asyncio, pytest-cov
- **Linting/Formatting**: black, isort, flake8, autoflake, mypy, bandit
- **Pre-commit**: pre-commit hooks for code quality enforcement

## Project Conventions

### Code Style
- **Formatter**: Black with line-length=200 (configured in pre-commit)
- **Imports**: isort with black profile, all imports at top of file
- **Line Length**: 200 characters max
- **Naming**: Standard Python conventions (snake_case for functions/variables, PascalCase for classes)
- **Docstrings**: Google-style docstrings (auto-generate into API docs)
- **Type Hints**: Encouraged but not strictly enforced (mypy configured but not blocking)

### Architecture Patterns
- **Backend Pattern**: Abstract base class (`base.py`) with provider-specific implementations (claude.py, gemini.py, grok.py, etc.)
- **Orchestration**: Central `orchestrator.py` coordinates multiple `chat_agent.py` instances
- **Configuration**: YAML-based config files in `massgen/configs/`
- **Tool System**: Code-based tools in `massgen/tool/` with TOOL.md metadata files
- **MCP Integration**: `massgen/mcp_tools/` for Model Context Protocol support
- **Memory Management**: `massgen/memory/` for conversation context and compression
- **Formatting**: Provider-specific formatters in `massgen/formatter/`

### Testing Strategy
- **Test Location**: `massgen/tests/`
- **Framework**: pytest with pytest-asyncio for async tests
- **Markers**: `@pytest.mark.slow`, `@pytest.mark.integration`, `@pytest.mark.docker`, `@pytest.mark.expensive`
- **Test-Driven Development**: Write tests first when possible
- **Running Tests**: Always use `uv run pytest ...`

### Git Workflow
- **Main Branch**: `main`
- **Staging**: Use `git add -u .` for modified tracked files
- **Commits**: Conventional commit style encouraged
- **PR Reviews**: Use `pr-review-toolkit:review-pr` skill
- **Pre-commit**: Hooks run black, isort, flake8, autoflake, pyroma

## Domain Context

### Multi-Agent Orchestration
- **Agents**: Independent LLM-powered workers that process tasks in parallel
- **Broadcast Channel**: Agents share progress/insights via `_broadcast_channel.py`
- **Convergence**: System detects when agents reach consensus on a solution
- **Voting**: Post-execution voting mechanism to select best answer
- **Turns/Attempts**: Configurable iteration limits for refinement

### LLM Backend Abstraction
- Each provider (Claude, GPT, Gemini, Grok) has a backend class inheriting from `base.py`
- Backends handle: API calls, streaming, tool execution, context compression
- `litellm_provider.py` provides unified interface for additional models

### Tool Ecosystem
- **Code-based Tools**: Python functions in `massgen/tool/` directories
- **MCP Tools**: External tools via Model Context Protocol
- **Workflow Tools**: Special tools for voting (`vote.py`), answers (`new_answer.py`)
- **Docker Execution**: Sandboxed code execution support

## Important Constraints

### Runtime Requirements
- **Always use `uv` prefix**: `uv run python`, `uv run pytest`, `uv run pre-commit`
- **Always use `--automation` flag**: When running MassGen itself for testing/automation
- **API Keys**: Required for each provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)

### Documentation Requirements
- **Primary docs**: Sphinx in `docs/source/` (published to ReadTheDocs)
- **Design docs**: Internal notes in `docs/dev_notes/`
- **PR tracking**: Maintain `PR_DRAFT.md` for feature development
- **Tool docs**: Each tool needs `TOOL.md` with YAML frontmatter

### Code Quality
- Pre-commit hooks must pass before commits
- Avoid over-engineering and unnecessary abstractions
- Keep solutions focused on the requested task
- Security: Avoid OWASP top 10 vulnerabilities

## External Dependencies

### LLM Providers
- **Anthropic Claude**: anthropic SDK (claude-3-5-sonnet, claude-3-opus, etc.)
- **OpenAI GPT**: openai SDK (gpt-4o, gpt-4-turbo, o1, etc.)
- **Google Gemini**: google-genai SDK (gemini-2.0-flash, gemini-1.5-pro, etc.)
- **xAI Grok**: xai-sdk (grok-2, grok-beta)
- **Cerebras**: cerebras-cloud-sdk
- **LM Studio**: lmstudio SDK for local models
- **LiteLLM**: Unified proxy for 100+ providers

### External Services
- **MCP Servers**: Various MCP-compatible tool servers
- **Docker**: Optional sandboxed execution environment
- **ReadTheDocs**: Documentation hosting at docs.massgen.ai

### Key Internal Modules
- `massgen/orchestrator.py`: Main coordination logic (~298K bytes)
- `massgen/cli.py`: Command-line interface (~282K bytes)
- `massgen/config_builder.py`: YAML config parsing (~220K bytes)
- `massgen/chat_agent.py`: Individual agent implementation (~54K bytes)
- `massgen/backend/`: Provider-specific LLM implementations
