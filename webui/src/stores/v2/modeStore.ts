/**
 * Mode Configuration Store
 *
 * Manages runtime mode overrides for coordination, agent mode, refinement,
 * personas, agent count, per-agent provider/model selection, and docker toggle.
 * Mirrors TuiModeState from massgen/frontend/displays/tui_modes.py.
 */

import { create } from 'zustand';
import type { ProviderInfo } from '../wizardStore';

export type CoordinationMode = 'parallel' | 'decomposition';
export type AgentMode = 'multi' | 'single';
export type PersonasMode = 'off' | 'perspective' | 'implementation' | 'methodology';

export interface AgentConfigOverride {
  provider: string | null;  // null = use config default
  model: string | null;     // null = use config default
}

interface ModeState {
  // Row 1: Mode toggles
  coordinationMode: CoordinationMode;
  agentMode: AgentMode;
  selectedSingleAgent: string | null;
  refinementEnabled: boolean;
  personasMode: PersonasMode;

  // Row 2: Agent config overrides (null = use YAML config as-is)
  agentCount: number | null;
  agentConfigs: AgentConfigOverride[];       // empty = use config as-is
  dynamicModels: Record<string, string[]>;   // provider_id → model list cache
  loadingModels: Record<string, boolean>;    // loading state per provider
  dockerEnabled: boolean | null;

  // Execution lock
  executionLocked: boolean;

  // Available providers (fetched from /api/providers)
  providers: ProviderInfo[];
}

interface ModeActions {
  setCoordinationMode: (mode: CoordinationMode) => void;
  setAgentMode: (mode: AgentMode) => void;
  setSelectedSingleAgent: (agentId: string | null) => void;
  setRefinementEnabled: (enabled: boolean) => void;
  setPersonasMode: (mode: PersonasMode) => void;
  setAgentCount: (count: number | null) => void;
  setAgentConfig: (index: number, provider: string | null, model: string | null) => void;
  setDockerEnabled: (enabled: boolean | null) => void;
  lock: () => void;
  unlock: () => void;
  reset: () => void;
  fetchProviders: () => Promise<void>;
  fetchDynamicModels: (providerId: string) => Promise<string[]>;

  /** Produce overrides dict to send over WebSocket */
  getOverrides: () => Record<string, unknown>;
}

const initialState: ModeState = {
  coordinationMode: 'parallel',
  agentMode: 'multi',
  selectedSingleAgent: null,
  refinementEnabled: true,
  personasMode: 'off',
  agentCount: null,
  agentConfigs: [],
  dynamicModels: {},
  loadingModels: {},
  dockerEnabled: null,
  executionLocked: false,
  providers: [],
};

export const useModeStore = create<ModeState & ModeActions>()((set, get) => ({
  ...initialState,

  setCoordinationMode: (mode) => set({ coordinationMode: mode }),
  setAgentMode: (mode) => set({ agentMode: mode }),
  setSelectedSingleAgent: (agentId) => set({ selectedSingleAgent: agentId }),
  setRefinementEnabled: (enabled) => set({ refinementEnabled: enabled }),
  setPersonasMode: (mode) => set({ personasMode: mode }),

  setAgentCount: (count) => {
    const { agentConfigs } = get();
    if (count === null) {
      set({ agentCount: null, agentConfigs: [] });
    } else if (count > agentConfigs.length) {
      const newConfigs = [...agentConfigs];
      for (let i = agentConfigs.length; i < count; i++) {
        newConfigs.push({ provider: null, model: null });
      }
      set({ agentCount: count, agentConfigs: newConfigs });
    } else if (count < agentConfigs.length) {
      set({ agentCount: count, agentConfigs: agentConfigs.slice(0, count) });
    } else {
      set({ agentCount: count });
    }
  },

  setAgentConfig: (index, provider, model) => {
    const { agentConfigs } = get();
    if (index < 0 || index >= agentConfigs.length) return;
    const newConfigs = [...agentConfigs];
    newConfigs[index] = { provider, model };
    set({ agentConfigs: newConfigs });
  },

  setDockerEnabled: (enabled) => set({ dockerEnabled: enabled }),
  lock: () => set({ executionLocked: true }),
  unlock: () => set({ executionLocked: false }),
  reset: () => set(initialState),

  fetchProviders: async () => {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) return;
      const data = await response.json();
      set({ providers: data.providers || [] });
    } catch {
      // Silently ignore — providers are optional enhancement
    }
  },

  fetchDynamicModels: async (providerId: string) => {
    const { dynamicModels, loadingModels } = get();

    if (dynamicModels[providerId]) {
      return dynamicModels[providerId];
    }

    if (loadingModels[providerId]) {
      return [];
    }

    set({ loadingModels: { ...loadingModels, [providerId]: true } });

    try {
      const response = await fetch(`/api/providers/${providerId}/models`);
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      const models = data.models || [];

      set({
        dynamicModels: { ...get().dynamicModels, [providerId]: models },
        loadingModels: { ...get().loadingModels, [providerId]: false },
      });

      return models;
    } catch {
      set({ loadingModels: { ...get().loadingModels, [providerId]: false } });
      return [];
    }
  },

  getOverrides: () => {
    const state = get();
    const overrides: Record<string, unknown> = {};

    // --- Orchestrator overrides (ported from TuiModeState.get_orchestrator_overrides) ---

    // Coordination mode: decomposition requires multi-agent
    let effectiveCoordination = state.coordinationMode;
    if (state.agentMode === 'single' && effectiveCoordination === 'decomposition') {
      effectiveCoordination = 'parallel';
    }
    overrides.coordination_mode =
      effectiveCoordination === 'decomposition' ? 'decomposition' : 'voting';

    // Refinement disabled = quick mode
    if (!state.refinementEnabled) {
      overrides.max_new_answers_per_agent = 1;
      overrides.skip_final_presentation = true;

      if (state.agentMode === 'single') {
        overrides.skip_voting = true;
      } else {
        overrides.disable_injection = true;
        overrides.defer_voting_until_all_answered = true;
        overrides.final_answer_strategy = 'synthesize';
      }
    }

    // Persona overrides
    if (state.personasMode !== 'off') {
      overrides.persona_generator_enabled = true;
      overrides.persona_diversity_mode = state.personasMode;
    }

    // --- Agent config overrides ---

    if (state.agentCount !== null) {
      overrides.agent_count = state.agentCount;
    }

    // Per-agent overrides
    const hasOverrides = state.agentConfigs.some(
      (c) => c.provider !== null || c.model !== null
    );
    if (hasOverrides) {
      overrides.agent_overrides = state.agentConfigs.map((c) => ({
        ...(c.provider && { backend_type: c.provider }),
        ...(c.model && { model: c.model }),
      }));
    }

    if (state.dockerEnabled !== null) {
      overrides.docker_override = state.dockerEnabled;
    }

    return overrides;
  },
}));
