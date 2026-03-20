"""Tests for MassGen step mode.

Step mode runs one agent for one step (new_answer or vote), then exits.
Prior answers/workspaces are loaded from a session directory.

TDD: These tests are written first, then implementation follows.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from massgen.orchestrator import Orchestrator

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_answer(session_dir: Path, agent_id: str, step: int, answer_text: str, timestamp: str = "2026-03-18T12:00:00Z") -> Path:
    """Write an answer.json into the session dir at the correct step."""
    step_dir = session_dir / "agents" / agent_id / f"{step:03d}"
    step_dir.mkdir(parents=True, exist_ok=True)
    answer_file = step_dir / "answer.json"
    answer_file.write_text(
        json.dumps(
            {
                "agent_id": agent_id,
                "answer": answer_text,
                "timestamp": timestamp,
            },
        ),
    )
    return step_dir


def _write_vote(session_dir: Path, agent_id: str, step: int, target: str, seen_steps: dict[str, int], reason: str = "Better approach") -> Path:
    """Write a vote.json into the session dir at the correct step."""
    step_dir = session_dir / "agents" / agent_id / f"{step:03d}"
    step_dir.mkdir(parents=True, exist_ok=True)
    vote_file = step_dir / "vote.json"
    vote_file.write_text(
        json.dumps(
            {
                "voter": agent_id,
                "target": target,
                "reason": reason,
                "seen_steps": seen_steps,
            },
        ),
    )
    return step_dir


def _write_workspace(session_dir: Path, agent_id: str, step: int, files: dict[str, str] | None = None) -> Path:
    """Create a workspace directory with optional files."""
    ws_dir = session_dir / "agents" / agent_id / f"{step:03d}" / "workspace"
    ws_dir.mkdir(parents=True, exist_ok=True)
    if files:
        for name, content in files.items():
            (ws_dir / name).write_text(content)
    return ws_dir


# ---------------------------------------------------------------------------
# A0.1: StepModeConfig dataclass
# ---------------------------------------------------------------------------


class TestStepModeConfig:
    """Tests for the StepModeConfig dataclass."""

    def test_import(self) -> None:
        """StepModeConfig is importable from agent_config."""
        from massgen.agent_config import StepModeConfig

        assert StepModeConfig is not None

    def test_defaults(self) -> None:
        """StepModeConfig has sensible defaults."""
        from massgen.agent_config import StepModeConfig

        cfg = StepModeConfig()
        assert cfg.enabled is False
        assert cfg.session_dir == ""

    def test_enabled(self) -> None:
        """StepModeConfig can be created with enabled=True."""
        from massgen.agent_config import StepModeConfig

        cfg = StepModeConfig(enabled=True, session_dir="/tmp/test_session")
        assert cfg.enabled is True
        assert cfg.session_dir == "/tmp/test_session"


# ---------------------------------------------------------------------------
# A0.2: Session directory loading
# ---------------------------------------------------------------------------


class TestSessionDirLoading:
    """Tests for loading session directory state into orchestrator."""

    def test_load_empty_session_dir(self, tmp_path: Path) -> None:
        """Empty session dir (no agents/) is valid — first round, no prior context."""
        from massgen.agent_config import StepModeConfig

        session_dir = tmp_path / "session"
        session_dir.mkdir()
        (session_dir / "agents").mkdir()

        cfg = StepModeConfig(enabled=True, session_dir=str(session_dir))
        # Should load without error — result is no virtual agents
        from massgen.step_mode import load_session_dir_inputs

        inputs = load_session_dir_inputs(cfg.session_dir)
        assert inputs.virtual_agents == {}

    def test_load_single_agent_answer(self, tmp_path: Path) -> None:
        """Load a single agent's answer from session dir."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "Hello world")

        inputs = load_session_dir_inputs(str(session_dir))
        assert "agent_a" in inputs.virtual_agents
        assert inputs.virtual_agents["agent_a"].latest_answer == "Hello world"
        assert inputs.virtual_agents["agent_a"].latest_step == 1

    def test_load_multiple_agents(self, tmp_path: Path) -> None:
        """Load multiple agents from session dir."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "Answer A")
        _write_answer(session_dir, "agent_b", 1, "Answer B")
        _write_answer(session_dir, "agent_c", 1, "Answer C")

        inputs = load_session_dir_inputs(str(session_dir))
        assert len(inputs.virtual_agents) == 3
        assert inputs.virtual_agents["agent_a"].latest_answer == "Answer A"
        assert inputs.virtual_agents["agent_b"].latest_answer == "Answer B"
        assert inputs.virtual_agents["agent_c"].latest_answer == "Answer C"

    def test_load_agent_at_multiple_steps(self, tmp_path: Path) -> None:
        """Latest step is used when agent has multiple steps."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "First answer")
        _write_answer(session_dir, "agent_a", 2, "Revised answer")
        _write_answer(session_dir, "agent_a", 3, "Final answer")

        inputs = load_session_dir_inputs(str(session_dir))
        assert inputs.virtual_agents["agent_a"].latest_answer == "Final answer"
        assert inputs.virtual_agents["agent_a"].latest_step == 3

    def test_load_agents_at_independent_step_counts(self, tmp_path: Path) -> None:
        """Agents can be at different step counts."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        # agent_a at step 5
        _write_answer(session_dir, "agent_a", 1, "A v1")
        _write_answer(session_dir, "agent_a", 2, "A v2")
        _write_vote(session_dir, "agent_a", 3, "agent_b", {"agent_a": 2, "agent_b": 1})
        _write_answer(session_dir, "agent_a", 4, "A v3")
        _write_vote(session_dir, "agent_a", 5, "agent_b", {"agent_a": 4, "agent_b": 2})
        # agent_b at step 2
        _write_answer(session_dir, "agent_b", 1, "B v1")
        _write_answer(session_dir, "agent_b", 2, "B v2")

        inputs = load_session_dir_inputs(str(session_dir))
        # agent_a's latest answer is at step 4 (step 5 is a vote)
        assert inputs.virtual_agents["agent_a"].latest_answer == "A v3"
        assert inputs.virtual_agents["agent_a"].latest_step == 5
        # agent_b's latest answer is at step 2
        assert inputs.virtual_agents["agent_b"].latest_answer == "B v2"
        assert inputs.virtual_agents["agent_b"].latest_step == 2

    def test_vote_step_not_loaded_as_answer(self, tmp_path: Path) -> None:
        """Vote files are tracked but not loaded as answers."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "My answer")
        _write_vote(session_dir, "agent_a", 2, "agent_b", {"agent_a": 1, "agent_b": 1})

        inputs = load_session_dir_inputs(str(session_dir))
        # Latest answer should still be step 1's answer, not the vote
        assert inputs.virtual_agents["agent_a"].latest_answer == "My answer"
        assert inputs.virtual_agents["agent_a"].latest_step == 2

    def test_workspace_paths_loaded(self, tmp_path: Path) -> None:
        """Workspace directories are associated with answer steps."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "My answer")
        _write_workspace(session_dir, "agent_a", 1, {"index.html": "<html>test</html>"})

        inputs = load_session_dir_inputs(str(session_dir))
        assert inputs.virtual_agents["agent_a"].latest_workspace is not None
        assert (Path(inputs.virtual_agents["agent_a"].latest_workspace) / "index.html").exists()

    def test_no_agents_dir_creates_empty(self, tmp_path: Path) -> None:
        """Session dir without agents/ subdir is valid (first round)."""
        from massgen.step_mode import load_session_dir_inputs

        session_dir = tmp_path / "session"
        session_dir.mkdir()

        inputs = load_session_dir_inputs(str(session_dir))
        assert inputs.virtual_agents == {}


# ---------------------------------------------------------------------------
# A0.3: Step mode output writing
# ---------------------------------------------------------------------------


class TestStepModeOutput:
    """Tests for writing step mode outputs."""

    def test_save_answer_output(self, tmp_path: Path) -> None:
        """Saving an answer creates the correct directory structure."""
        from massgen.step_mode import save_step_mode_output

        session_dir = tmp_path / "session"
        (session_dir / "agents" / "agent_a").mkdir(parents=True)

        save_step_mode_output(
            session_dir=str(session_dir),
            agent_id="agent_a",
            action="new_answer",
            answer_text="My new answer",
            vote_target=None,
            vote_reason=None,
            seen_steps=None,
            duration_seconds=45.2,
            cost={"input_tokens": 5000, "output_tokens": 3000, "estimated_cost": 0.08},
        )

        # Check answer.json was written in step 001
        answer_file = session_dir / "agents" / "agent_a" / "001" / "answer.json"
        assert answer_file.exists()
        data = json.loads(answer_file.read_text())
        assert data["agent_id"] == "agent_a"
        assert data["answer"] == "My new answer"
        assert "timestamp" in data

        # Check last_action.json
        last_action = session_dir / "last_action.json"
        assert last_action.exists()
        action_data = json.loads(last_action.read_text())
        assert action_data["action"] == "new_answer"
        assert action_data["agent_id"] == "agent_a"
        assert action_data["answer_text"] == "My new answer"
        assert action_data["duration_seconds"] == 45.2

    def test_save_vote_output(self, tmp_path: Path) -> None:
        """Saving a vote creates vote.json with seen_steps."""
        from massgen.step_mode import save_step_mode_output

        session_dir = tmp_path / "session"
        # Pre-existing answer at step 1
        _write_answer(session_dir, "agent_a", 1, "Prior answer")

        save_step_mode_output(
            session_dir=str(session_dir),
            agent_id="agent_a",
            action="vote",
            answer_text=None,
            vote_target="agent_b",
            vote_reason="Better approach",
            seen_steps={"agent_a": 1, "agent_b": 2},
            duration_seconds=30.0,
            cost={"input_tokens": 3000, "output_tokens": 1000, "estimated_cost": 0.04},
        )

        # Vote should be at step 002 (next after existing step 001)
        vote_file = session_dir / "agents" / "agent_a" / "002" / "vote.json"
        assert vote_file.exists()
        data = json.loads(vote_file.read_text())
        assert data["voter"] == "agent_a"
        assert data["target"] == "agent_b"
        assert data["seen_steps"] == {"agent_a": 1, "agent_b": 2}

    def test_save_increments_step_number(self, tmp_path: Path) -> None:
        """Each save increments the step number."""
        from massgen.step_mode import save_step_mode_output

        session_dir = tmp_path / "session"
        # Pre-existing steps 1, 2, 3
        _write_answer(session_dir, "agent_a", 1, "v1")
        _write_answer(session_dir, "agent_a", 2, "v2")
        _write_vote(session_dir, "agent_a", 3, "agent_b", {"agent_a": 2, "agent_b": 1})

        save_step_mode_output(
            session_dir=str(session_dir),
            agent_id="agent_a",
            action="new_answer",
            answer_text="v3",
            vote_target=None,
            vote_reason=None,
            seen_steps=None,
            duration_seconds=50.0,
            cost={},
        )

        # Should be at step 004
        answer_file = session_dir / "agents" / "agent_a" / "004" / "answer.json"
        assert answer_file.exists()

    def test_save_first_step_with_no_prior(self, tmp_path: Path) -> None:
        """First save when agent has no prior steps creates step 001."""
        from massgen.step_mode import save_step_mode_output

        session_dir = tmp_path / "session"
        session_dir.mkdir(parents=True)

        save_step_mode_output(
            session_dir=str(session_dir),
            agent_id="agent_x",
            action="new_answer",
            answer_text="First answer",
            vote_target=None,
            vote_reason=None,
            seen_steps=None,
            duration_seconds=20.0,
            cost={},
        )

        answer_file = session_dir / "agents" / "agent_x" / "001" / "answer.json"
        assert answer_file.exists()


# ---------------------------------------------------------------------------
# A0.4: Config validation for step mode
# ---------------------------------------------------------------------------


class TestStepModeConfigValidation:
    """Tests for step mode configuration validation."""

    def test_step_mode_requires_single_agent_config(self) -> None:
        """Step mode config must define exactly one agent."""
        from massgen.step_mode import validate_step_mode_config

        # Single agent — valid
        config = {"agents": [{"id": "agent_a", "backend": {"type": "openai", "model": "gpt-5.4"}}]}
        assert validate_step_mode_config(config) is True

        # Multiple agents — invalid
        config_multi = {
            "agents": [
                {"id": "agent_a", "backend": {"type": "openai", "model": "gpt-5.4"}},
                {"id": "agent_b", "backend": {"type": "gemini", "model": "gemini-3-flash"}},
            ],
        }
        with pytest.raises(ValueError, match="exactly one agent"):
            validate_step_mode_config(config_multi)

        # No agents — invalid
        config_none = {"agents": []}
        with pytest.raises(ValueError, match="exactly one agent"):
            validate_step_mode_config(config_none)

    def test_step_mode_accepts_single_agent_key(self) -> None:
        """Step mode also accepts the 'agent' key (single agent shorthand)."""
        from massgen.step_mode import validate_step_mode_config

        config = {"agent": {"id": "agent_a", "backend": {"type": "openai", "model": "gpt-5.4"}}}
        assert validate_step_mode_config(config) is True


# ---------------------------------------------------------------------------
# A0.5: Stale vote detection
# ---------------------------------------------------------------------------


class TestStaleVoteDetection:
    """Tests for detecting stale votes based on seen_steps."""

    def test_fresh_vote_is_valid(self, tmp_path: Path) -> None:
        """A vote that has seen the latest steps is valid."""
        from massgen.step_mode import is_vote_stale

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "A answer")
        _write_answer(session_dir, "agent_b", 1, "B answer")
        _write_vote(session_dir, "agent_a", 2, "agent_b", {"agent_a": 1, "agent_b": 1})

        assert is_vote_stale(str(session_dir), "agent_a", 2) is False

    def test_stale_vote_detected(self, tmp_path: Path) -> None:
        """A vote becomes stale when a new answer arrives after it was cast."""
        from massgen.step_mode import is_vote_stale

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "A v1")
        _write_answer(session_dir, "agent_b", 1, "B v1")
        # agent_a votes having seen agent_b at step 1
        _write_vote(session_dir, "agent_a", 2, "agent_b", {"agent_a": 1, "agent_b": 1})
        # agent_b submits a new answer at step 2
        _write_answer(session_dir, "agent_b", 2, "B v2")

        # agent_a's vote is now stale — it hasn't seen agent_b's step 2
        assert is_vote_stale(str(session_dir), "agent_a", 2) is True

    def test_vote_without_seen_steps_is_stale(self, tmp_path: Path) -> None:
        """A vote without seen_steps field is treated as stale for safety."""
        from massgen.step_mode import is_vote_stale

        session_dir = tmp_path / "session"
        _write_answer(session_dir, "agent_a", 1, "A answer")
        # Write a malformed vote without seen_steps
        step_dir = session_dir / "agents" / "agent_a" / "002"
        step_dir.mkdir(parents=True)
        (step_dir / "vote.json").write_text(
            json.dumps(
                {
                    "voter": "agent_a",
                    "target": "agent_b",
                    "reason": "test",
                },
            ),
        )

        assert is_vote_stale(str(session_dir), "agent_a", 2) is True


# ---------------------------------------------------------------------------
# A0.6: CLI flag parsing
# ---------------------------------------------------------------------------


class TestCLIStepModeFlags:
    """Tests for --step and --session-dir CLI flags."""

    def test_step_flag_parsed(self) -> None:
        """--step flag is recognized by the parser."""
        from massgen.cli import main_parser

        parser = main_parser()
        args = parser.parse_args(["--step", "--session-dir", "/tmp/session", "--config", "test.yaml", "test question"])
        assert args.step is True
        assert args.session_dir == "/tmp/session"

    def test_step_flag_default_false(self) -> None:
        """--step defaults to False when not provided."""
        from massgen.cli import main_parser

        parser = main_parser()
        args = parser.parse_args(["--config", "test.yaml", "test question"])
        assert args.step is False
        assert args.session_dir is None

    def test_step_requires_session_dir(self) -> None:
        """--step without --session-dir should fail validation."""
        from massgen.step_mode import validate_step_mode_args

        # Simulate args
        class Args:
            step = True
            session_dir = None
            config = "test.yaml"

        with pytest.raises(ValueError, match="--session-dir"):
            validate_step_mode_args(Args())

    def test_step_requires_config(self) -> None:
        """--step without --config should fail validation."""
        from massgen.step_mode import validate_step_mode_args

        class Args:
            step = True
            session_dir = "/tmp/session"
            config = None
            backend = None

        with pytest.raises(ValueError, match="--config"):
            validate_step_mode_args(Args())


# ---------------------------------------------------------------------------
# A0.7: Orchestrator wiring — virtual agent answers visible to real agents
# ---------------------------------------------------------------------------


def _make_step_mode_orchestrator(
    session_dir: Path,
    real_agent_id: str = "agent_x",
    virtual_answers: dict[str, list[tuple[int, str]]] | None = None,
) -> Orchestrator:
    """Create a minimal Orchestrator wired for step mode.

    Args:
        session_dir: Session directory path.
        real_agent_id: ID of the single real agent.
        virtual_answers: Map of agent_id -> [(step, answer_text), ...] to pre-populate.

    Returns:
        Orchestrator with step mode enabled and virtual agents loaded.
    """
    from unittest.mock import Mock

    from massgen.agent_config import StepModeConfig
    from massgen.orchestrator import Orchestrator

    # Write virtual answers to session dir
    if virtual_answers:
        for va_id, steps in virtual_answers.items():
            for step_num, answer_text in steps:
                _write_answer(session_dir, va_id, step_num, answer_text)

    # Create a mock agent for the real agent
    mock_agent = Mock()
    mock_agent.backend = Mock()
    mock_agent.backend.filesystem_manager = None
    mock_agent.backend.backend_params = {}

    step_config = StepModeConfig(enabled=True, session_dir=str(session_dir))

    orchestrator = Orchestrator(
        agents={real_agent_id: mock_agent},
        step_mode=step_config,
    )

    return orchestrator


class TestStepModeAnswerVisibility:
    """Tests that virtual agent answers are visible to the real agent."""

    def test_snapshot_includes_virtual_agents(self, tmp_path: Path) -> None:
        """_get_current_answers_snapshot() includes virtual agent answers."""
        session_dir = tmp_path / "session"
        orch = _make_step_mode_orchestrator(
            session_dir,
            real_agent_id="agent_x",
            virtual_answers={
                "agent_a": [(1, "Answer from A")],
                "agent_b": [(1, "Answer from B")],
            },
        )

        snapshot = orch._get_current_answers_snapshot()
        assert "agent_a" in snapshot
        assert snapshot["agent_a"] == "Answer from A"
        assert "agent_b" in snapshot
        assert snapshot["agent_b"] == "Answer from B"

    def test_snapshot_prefers_real_agent_answer(self, tmp_path: Path) -> None:
        """Real agent's answer takes precedence if same ID appears in session dir."""
        session_dir = tmp_path / "session"
        orch = _make_step_mode_orchestrator(
            session_dir,
            real_agent_id="agent_x",
            virtual_answers={"agent_x": [(1, "Old answer from session")]},
        )

        # Simulate the real agent submitting an answer
        orch.agent_states["agent_x"].answer = "Fresh answer from real agent"

        snapshot = orch._get_current_answers_snapshot()
        assert snapshot["agent_x"] == "Fresh answer from real agent"

    def test_snapshot_excludes_virtual_when_step_mode_off(self, tmp_path: Path) -> None:
        """Without step mode, snapshot only contains real agent answers."""
        from unittest.mock import Mock

        from massgen.orchestrator import Orchestrator

        mock_agent = Mock()
        mock_agent.backend = Mock()
        mock_agent.backend.filesystem_manager = None
        mock_agent.backend.backend_params = {}

        orch = Orchestrator(agents={"agent_x": mock_agent})
        # No step mode — _step_inputs is None
        assert orch._get_current_answers_snapshot() == {}

    def test_virtual_agents_in_coordination_tracker(self, tmp_path: Path) -> None:
        """Virtual agents are registered in coordination_tracker for anonymization."""
        session_dir = tmp_path / "session"
        orch = _make_step_mode_orchestrator(
            session_dir,
            real_agent_id="agent_x",
            virtual_answers={"agent_a": [(1, "Answer A")]},
        )

        # Virtual agent should be in the coordination tracker's agent_ids
        assert "agent_a" in orch.coordination_tracker.agent_ids
        assert "agent_x" in orch.coordination_tracker.agent_ids

    def test_virtual_agents_pre_marked_as_seen(self, tmp_path: Path) -> None:
        """Real agent has virtual agents in known_answer_ids after init."""
        session_dir = tmp_path / "session"
        orch = _make_step_mode_orchestrator(
            session_dir,
            real_agent_id="agent_x",
            virtual_answers={
                "agent_a": [(1, "Answer A")],
                "agent_b": [(1, "Answer B")],
            },
        )

        known = orch.agent_states["agent_x"].known_answer_ids
        assert "agent_a" in known
        assert "agent_b" in known

    def test_snapshot_with_multiple_virtual_steps(self, tmp_path: Path) -> None:
        """Snapshot uses the latest answer from virtual agents with multiple steps."""
        session_dir = tmp_path / "session"
        orch = _make_step_mode_orchestrator(
            session_dir,
            real_agent_id="agent_x",
            virtual_answers={
                "agent_a": [(1, "First draft"), (2, "Revised draft")],
            },
        )

        snapshot = orch._get_current_answers_snapshot()
        assert snapshot["agent_a"] == "Revised draft"
