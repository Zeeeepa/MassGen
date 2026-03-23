import { beforeEach, describe, expect, it } from 'vitest';
import { useModeStore } from './modeStore';

describe('useModeStore', () => {
  beforeEach(() => {
    useModeStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useModeStore.getState();
      expect(state.coordinationMode).toBe('parallel');
      expect(state.agentMode).toBe('multi');
      expect(state.selectedSingleAgent).toBeNull();
      expect(state.refinementEnabled).toBe(true);
      expect(state.personasMode).toBe('off');
      expect(state.agentCount).toBeNull();
      expect(state.agentConfigs).toEqual([]);
      expect(state.dynamicModels).toEqual({});
      expect(state.loadingModels).toEqual({});
      expect(state.dockerEnabled).toBeNull();
      expect(state.executionLocked).toBe(false);
    });
  });

  describe('getOverrides', () => {
    it('returns parallel + voting for default state', () => {
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.coordination_mode).toBe('voting');
      // Refinement is on by default, so no quick-mode keys
      expect(overrides.max_new_answers_per_agent).toBeUndefined();
      expect(overrides.skip_voting).toBeUndefined();
    });

    it('returns decomposition coordination_mode', () => {
      useModeStore.getState().setCoordinationMode('decomposition');
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.coordination_mode).toBe('decomposition');
    });

    it('falls back to voting when single agent + decomposition', () => {
      useModeStore.getState().setCoordinationMode('decomposition');
      useModeStore.getState().setAgentMode('single');
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.coordination_mode).toBe('voting');
    });

    it('multi + refinement off = quick mode (multi-agent)', () => {
      useModeStore.getState().setRefinementEnabled(false);
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.max_new_answers_per_agent).toBe(1);
      expect(overrides.skip_final_presentation).toBe(true);
      expect(overrides.disable_injection).toBe(true);
      expect(overrides.defer_voting_until_all_answered).toBe(true);
      expect(overrides.final_answer_strategy).toBe('synthesize');
      // Should NOT have skip_voting (that's single-agent only)
      expect(overrides.skip_voting).toBeUndefined();
    });

    it('single + refinement off = quick mode (single-agent)', () => {
      useModeStore.getState().setAgentMode('single');
      useModeStore.getState().setRefinementEnabled(false);
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.max_new_answers_per_agent).toBe(1);
      expect(overrides.skip_final_presentation).toBe(true);
      expect(overrides.skip_voting).toBe(true);
      // Should NOT have multi-agent quick mode keys
      expect(overrides.disable_injection).toBeUndefined();
      expect(overrides.defer_voting_until_all_answered).toBeUndefined();
    });

    it('single + refinement on = voting kept (no quick mode keys)', () => {
      useModeStore.getState().setAgentMode('single');
      useModeStore.getState().setRefinementEnabled(true);
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.coordination_mode).toBe('voting');
      expect(overrides.max_new_answers_per_agent).toBeUndefined();
      expect(overrides.skip_voting).toBeUndefined();
    });

    it('includes persona overrides when enabled', () => {
      useModeStore.getState().setPersonasMode('perspective');
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.persona_generator_enabled).toBe(true);
      expect(overrides.persona_diversity_mode).toBe('perspective');
    });

    it('does not include persona overrides when off', () => {
      useModeStore.getState().setPersonasMode('off');
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.persona_generator_enabled).toBeUndefined();
      expect(overrides.persona_diversity_mode).toBeUndefined();
    });

    it('includes agent_count when set', () => {
      useModeStore.getState().setAgentCount(5);
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.agent_count).toBe(5);
    });

    it('includes docker_override when set', () => {
      useModeStore.getState().setDockerEnabled(true);
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.docker_override).toBe(true);
    });

    it('does not include null agent config overrides', () => {
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.agent_count).toBeUndefined();
      expect(overrides.agent_overrides).toBeUndefined();
      expect(overrides.docker_override).toBeUndefined();
    });

    it('combines orchestrator and agent overrides', () => {
      useModeStore.getState().setRefinementEnabled(false);
      useModeStore.getState().setAgentCount(4);
      useModeStore.getState().setAgentConfig(0, 'openai', 'gpt-4o');
      const overrides = useModeStore.getState().getOverrides();
      // Orchestrator overrides
      expect(overrides.coordination_mode).toBe('voting');
      expect(overrides.max_new_answers_per_agent).toBe(1);
      // Agent overrides
      expect(overrides.agent_count).toBe(4);
      expect(overrides.agent_overrides).toBeDefined();
      expect((overrides.agent_overrides as Array<Record<string, string>>)[0].model).toBe('gpt-4o');
    });

    it('includes agent_overrides when configs have values', () => {
      useModeStore.getState().setAgentCount(3);
      useModeStore.getState().setAgentConfig(1, 'anthropic', 'claude-sonnet-4-5-20250514');
      const overrides = useModeStore.getState().getOverrides();
      const agentOverrides = overrides.agent_overrides as Array<Record<string, string>>;
      expect(agentOverrides).toBeDefined();
      expect(agentOverrides).toHaveLength(3);
      // Index 0: all null → empty object
      expect(agentOverrides[0]).toEqual({});
      // Index 1: has values
      expect(agentOverrides[1]).toEqual({ backend_type: 'anthropic', model: 'claude-sonnet-4-5-20250514' });
      // Index 2: all null → empty object
      expect(agentOverrides[2]).toEqual({});
    });

    it('omits agent_overrides when all configs are null', () => {
      useModeStore.getState().setAgentCount(3);
      // No setAgentConfig calls — all entries have null provider/model
      const overrides = useModeStore.getState().getOverrides();
      expect(overrides.agent_overrides).toBeUndefined();
    });

    it('agent_overrides only includes non-null fields', () => {
      useModeStore.getState().setAgentCount(2);
      // Provider only
      useModeStore.getState().setAgentConfig(0, 'openai', null);
      // Model only
      useModeStore.getState().setAgentConfig(1, null, 'gpt-4o');
      const overrides = useModeStore.getState().getOverrides();
      const agentOverrides = overrides.agent_overrides as Array<Record<string, string>>;
      expect(agentOverrides[0]).toEqual({ backend_type: 'openai' });
      expect(agentOverrides[1]).toEqual({ model: 'gpt-4o' });
    });
  });

  describe('setAgentCount', () => {
    it('grows agentConfigs array', () => {
      useModeStore.getState().setAgentCount(3);
      const state = useModeStore.getState();
      expect(state.agentConfigs).toHaveLength(3);
      expect(state.agentConfigs).toEqual([
        { provider: null, model: null },
        { provider: null, model: null },
        { provider: null, model: null },
      ]);
    });

    it('shrinks agentConfigs array', () => {
      useModeStore.getState().setAgentCount(3);
      useModeStore.getState().setAgentCount(1);
      const state = useModeStore.getState();
      expect(state.agentConfigs).toHaveLength(1);
    });

    it('clears agentConfigs when set to null', () => {
      useModeStore.getState().setAgentCount(3);
      useModeStore.getState().setAgentCount(null);
      const state = useModeStore.getState();
      expect(state.agentConfigs).toEqual([]);
      expect(state.agentCount).toBeNull();
    });

    it('preserves existing configs when growing', () => {
      useModeStore.getState().setAgentCount(2);
      useModeStore.getState().setAgentConfig(0, 'openai', 'gpt-4o');
      useModeStore.getState().setAgentCount(4);
      const state = useModeStore.getState();
      expect(state.agentConfigs).toHaveLength(4);
      expect(state.agentConfigs[0]).toEqual({ provider: 'openai', model: 'gpt-4o' });
      expect(state.agentConfigs[2]).toEqual({ provider: null, model: null });
    });
  });

  describe('setAgentConfig', () => {
    it('updates specific agent', () => {
      useModeStore.getState().setAgentCount(3);
      useModeStore.getState().setAgentConfig(1, 'anthropic', 'claude-sonnet-4-5-20250514');
      const state = useModeStore.getState();
      expect(state.agentConfigs[0]).toEqual({ provider: null, model: null });
      expect(state.agentConfigs[1]).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-5-20250514' });
      expect(state.agentConfigs[2]).toEqual({ provider: null, model: null });
    });

    it('ignores out-of-bounds index', () => {
      useModeStore.getState().setAgentCount(2);
      useModeStore.getState().setAgentConfig(5, 'openai', 'gpt-4o');
      const state = useModeStore.getState();
      expect(state.agentConfigs).toHaveLength(2);
      expect(state.agentConfigs[0]).toEqual({ provider: null, model: null });
    });
  });

  describe('lock / unlock', () => {
    it('locks and unlocks', () => {
      useModeStore.getState().lock();
      expect(useModeStore.getState().executionLocked).toBe(true);
      useModeStore.getState().unlock();
      expect(useModeStore.getState().executionLocked).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all state to defaults', () => {
      const store = useModeStore.getState();
      store.setCoordinationMode('decomposition');
      store.setAgentMode('single');
      store.setRefinementEnabled(false);
      store.setAgentCount(5);
      store.setAgentConfig(0, 'openai', 'gpt-4o');
      store.lock();

      store.reset();

      const state = useModeStore.getState();
      expect(state.coordinationMode).toBe('parallel');
      expect(state.agentMode).toBe('multi');
      expect(state.refinementEnabled).toBe(true);
      expect(state.agentCount).toBeNull();
      expect(state.agentConfigs).toEqual([]);
      expect(state.dynamicModels).toEqual({});
      expect(state.loadingModels).toEqual({});
      expect(state.executionLocked).toBe(false);
    });
  });

  describe('setters', () => {
    it('setCoordinationMode', () => {
      useModeStore.getState().setCoordinationMode('decomposition');
      expect(useModeStore.getState().coordinationMode).toBe('decomposition');
    });

    it('setAgentMode', () => {
      useModeStore.getState().setAgentMode('single');
      expect(useModeStore.getState().agentMode).toBe('single');
    });

    it('setSelectedSingleAgent', () => {
      useModeStore.getState().setSelectedSingleAgent('agent_b');
      expect(useModeStore.getState().selectedSingleAgent).toBe('agent_b');
    });

    it('setPersonasMode cycles through modes', () => {
      useModeStore.getState().setPersonasMode('methodology');
      expect(useModeStore.getState().personasMode).toBe('methodology');
    });

    it('setDockerEnabled', () => {
      useModeStore.getState().setDockerEnabled(false);
      expect(useModeStore.getState().dockerEnabled).toBe(false);
    });
  });
});
