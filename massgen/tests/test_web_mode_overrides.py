"""Tests for WebUI mode bar override application logic."""

import copy

import pytest


def _make_base_config(num_agents: int = 3) -> dict:
    """Create a minimal config dict for testing."""
    agents = []
    for i in range(num_agents):
        agent_id = f"agent_{chr(97 + i)}"
        agents.append(
            {
                "id": agent_id,
                "backend": {"type": "chat_completions"},
                "backend_params": {"model": "gpt-4o"},
            },
        )
    return {
        "agents": agents,
        "orchestrator": {},
        "execution": {"use_docker": False},
    }


# Import the helper under test — deferred to avoid import errors during collection
@pytest.fixture()
def apply_fn():
    from massgen.frontend.web.server import _apply_mode_overrides

    return _apply_mode_overrides


@pytest.fixture()
def apply_agent_fn():
    from massgen.frontend.web.server import _apply_agent_overrides

    return _apply_agent_overrides


@pytest.fixture()
def apply_docker_fn():
    from massgen.frontend.web.server import _apply_docker_override

    return _apply_docker_override


class TestApplyModeOverrides:
    def test_empty_overrides_no_mutation(self, apply_fn):
        config = _make_base_config()
        original = copy.deepcopy(config)
        apply_fn(config, {})
        assert config == original

    def test_none_overrides_no_mutation(self, apply_fn):
        config = _make_base_config()
        original = copy.deepcopy(config)
        apply_fn(config, None)
        assert config == original

    def test_coordination_mode_override(self, apply_fn):
        config = _make_base_config()
        apply_fn(config, {"coordination_mode": "decomposition"})
        assert config["orchestrator"]["coordination_mode"] == "decomposition"

    def test_quick_mode_multi_agent(self, apply_fn):
        config = _make_base_config()
        overrides = {
            "max_new_answers_per_agent": 1,
            "skip_final_presentation": True,
            "disable_injection": True,
            "defer_voting_until_all_answered": True,
            "final_answer_strategy": "synthesize",
        }
        apply_fn(config, overrides)
        orch = config["orchestrator"]
        assert orch["max_new_answers_per_agent"] == 1
        assert orch["skip_final_presentation"] is True
        assert orch["disable_injection"] is True
        assert orch["defer_voting_until_all_answered"] is True
        assert orch["final_answer_strategy"] == "synthesize"

    def test_quick_mode_single_agent(self, apply_fn):
        config = _make_base_config(num_agents=1)
        overrides = {
            "max_new_answers_per_agent": 1,
            "skip_voting": True,
            "skip_final_presentation": True,
        }
        apply_fn(config, overrides)
        orch = config["orchestrator"]
        assert orch["max_new_answers_per_agent"] == 1
        assert orch["skip_voting"] is True
        assert orch["skip_final_presentation"] is True

    def test_persona_overrides(self, apply_fn):
        config = _make_base_config()
        overrides = {
            "persona_generator_enabled": True,
            "persona_diversity_mode": "methodology",
        }
        apply_fn(config, overrides)
        pg = config["orchestrator"]["coordination"]["persona_generator"]
        assert pg["enabled"] is True
        assert pg["diversity_mode"] == "methodology"

    def test_persona_overrides_disabled(self, apply_fn):
        """When persona_generator_enabled is not in overrides, no persona config is added."""
        config = _make_base_config()
        apply_fn(config, {"coordination_mode": "voting"})
        orch = config["orchestrator"]
        assert "coordination" not in orch or "persona_generator" not in orch.get(
            "coordination",
            {},
        )


class TestApplyAgentOverrides:
    def test_agent_count_increase(self, apply_agent_fn):
        config = _make_base_config(num_agents=2)
        apply_agent_fn(config, {"agent_count": 4})
        assert len(config["agents"]) == 4
        # New agents should have IDs agent_c, agent_d
        ids = [a["id"] for a in config["agents"]]
        assert ids == ["agent_a", "agent_b", "agent_c", "agent_d"]

    def test_agent_count_decrease(self, apply_agent_fn):
        config = _make_base_config(num_agents=5)
        apply_agent_fn(config, {"agent_count": 2})
        assert len(config["agents"]) == 2
        ids = [a["id"] for a in config["agents"]]
        assert ids == ["agent_a", "agent_b"]

    def test_agent_count_same_no_change(self, apply_agent_fn):
        config = _make_base_config(num_agents=3)
        original_ids = [a["id"] for a in config["agents"]]
        apply_agent_fn(config, {"agent_count": 3})
        assert [a["id"] for a in config["agents"]] == original_ids

    def test_agent_model_override(self, apply_agent_fn):
        config = _make_base_config(num_agents=3)
        apply_agent_fn(config, {"agent_model": "claude-sonnet-4-5-20250514"})
        for agent in config["agents"]:
            assert agent["backend_params"]["model"] == "claude-sonnet-4-5-20250514"

    def test_agent_backend_override(self, apply_agent_fn):
        config = _make_base_config(num_agents=2)
        apply_agent_fn(config, {"agent_backend": "anthropic"})
        for agent in config["agents"]:
            assert agent["backend"]["type"] == "anthropic"

    def test_combined_agent_overrides(self, apply_agent_fn):
        config = _make_base_config(num_agents=2)
        apply_agent_fn(
            config,
            {
                "agent_count": 4,
                "agent_model": "gemini-2.5-pro",
                "agent_backend": "gemini",
            },
        )
        assert len(config["agents"]) == 4
        for agent in config["agents"]:
            assert agent["backend_params"]["model"] == "gemini-2.5-pro"
            assert agent["backend"]["type"] == "gemini"

    def test_per_agent_overrides_model(self, apply_agent_fn):
        config = _make_base_config(num_agents=3)
        apply_agent_fn(
            config,
            {
                "agent_overrides": [
                    {"model": "gpt-4o-mini"},
                    {"model": "claude-sonnet-4-5-20250514"},
                    {},
                ],
            },
        )
        assert config["agents"][0]["backend_params"]["model"] == "gpt-4o-mini"
        assert config["agents"][1]["backend_params"]["model"] == "claude-sonnet-4-5-20250514"
        # Third agent unchanged (empty override)
        assert config["agents"][2]["backend_params"]["model"] == "gpt-4o"

    def test_per_agent_overrides_backend(self, apply_agent_fn):
        config = _make_base_config(num_agents=2)
        apply_agent_fn(
            config,
            {"agent_overrides": [{"backend_type": "anthropic"}, {}]},
        )
        assert config["agents"][0]["backend"]["type"] == "anthropic"
        assert config["agents"][1]["backend"]["type"] == "chat_completions"

    def test_per_agent_overrides_partial(self, apply_agent_fn):
        config = _make_base_config(num_agents=3)
        apply_agent_fn(
            config,
            {
                "agent_overrides": [
                    {"model": "gpt-4o-mini", "backend_type": "openai"},
                    {},
                    {},
                ],
            },
        )
        assert config["agents"][0]["backend_params"]["model"] == "gpt-4o-mini"
        assert config["agents"][0]["backend"]["type"] == "openai"
        # Others unchanged
        assert config["agents"][1]["backend_params"]["model"] == "gpt-4o"
        assert config["agents"][2]["backend_params"]["model"] == "gpt-4o"

    def test_per_agent_overrides_excess_ignored(self, apply_agent_fn):
        config = _make_base_config(num_agents=2)
        apply_agent_fn(
            config,
            {
                "agent_overrides": [
                    {"model": "a"},
                    {"model": "b"},
                    {"model": "c"},
                    {"model": "d"},
                ],
            },
        )
        assert len(config["agents"]) == 2
        assert config["agents"][0]["backend_params"]["model"] == "a"
        assert config["agents"][1]["backend_params"]["model"] == "b"

    def test_per_agent_overrides_with_count(self, apply_agent_fn):
        config = _make_base_config(num_agents=2)
        apply_agent_fn(
            config,
            {
                "agent_count": 4,
                "agent_overrides": [
                    {"model": "x"},
                    {},
                    {"model": "y"},
                    {},
                ],
            },
        )
        assert len(config["agents"]) == 4
        assert config["agents"][0]["backend_params"]["model"] == "x"
        assert config["agents"][2]["backend_params"]["model"] == "y"


class TestApplyDockerOverride:
    def test_docker_enable(self, apply_docker_fn):
        config = _make_base_config()
        apply_docker_fn(config, True)
        assert config["execution"]["use_docker"] is True

    def test_docker_disable(self, apply_docker_fn):
        config = _make_base_config()
        config["execution"]["use_docker"] = True
        apply_docker_fn(config, False)
        assert config["execution"]["use_docker"] is False


class TestCombinedOverrides:
    def test_all_override_types_together(self, apply_fn):
        config = _make_base_config(num_agents=2)
        overrides = {
            "coordination_mode": "decomposition",
            "max_new_answers_per_agent": 1,
            "skip_final_presentation": True,
            "persona_generator_enabled": True,
            "persona_diversity_mode": "perspective",
            "agent_count": 4,
            "agent_model": "gpt-4o-mini",
            "docker_override": True,
        }
        apply_fn(config, overrides)

        # Orchestrator
        assert config["orchestrator"]["coordination_mode"] == "decomposition"
        assert config["orchestrator"]["max_new_answers_per_agent"] == 1

        # Personas
        pg = config["orchestrator"]["coordination"]["persona_generator"]
        assert pg["enabled"] is True

        # Agents
        assert len(config["agents"]) == 4
        for agent in config["agents"]:
            assert agent["backend_params"]["model"] == "gpt-4o-mini"

        # Docker
        assert config["execution"]["use_docker"] is True
