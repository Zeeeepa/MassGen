/**
 * v2 Status Store
 *
 * Polls the /api/sessions/{sessionId}/status endpoint to surface
 * cost, timing, and context path data in the WebUI top bar.
 */

import { create } from 'zustand';

interface StatusStoreState {
  /** Total elapsed seconds for the session */
  elapsedSeconds: number;
  /** Total estimated cost in USD */
  totalCost: number;
  /** Total LLM input tokens */
  totalInputTokens: number;
  /** Total LLM output tokens */
  totalOutputTokens: number;
  /** Orchestrator config/log paths */
  orchestratorPaths: Record<string, string>;
  /** Current coordination phase */
  phase: string;
  /** Completion percentage (0-100) */
  completionPercentage: number;
  /** Whether polling is active */
  isPolling: boolean;
  /** Timestamp of last successful fetch (for local elapsed interpolation) */
  lastFetchTime: number;
  /** The elapsed value at lastFetchTime (for interpolation) */
  elapsedAtLastFetch: number;
}

interface StatusStoreActions {
  startPolling: (sessionId: string) => void;
  stopPolling: () => void;
  fetchOnce: (sessionId: string) => Promise<void>;
  reset: () => void;
}

const initialState: StatusStoreState = {
  elapsedSeconds: 0,
  totalCost: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  orchestratorPaths: {},
  phase: '',
  completionPercentage: 0,
  isPolling: false,
  lastFetchTime: 0,
  elapsedAtLastFetch: 0,
};

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useStatusStore = create<StatusStoreState & StatusStoreActions>(
  (set, get) => ({
    ...initialState,

    fetchOnce: async (sessionId: string) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.status;
        if (!status) return;

        const meta = status.meta || {};
        const costs = status.costs || {};
        const coordination = status.coordination || {};

        set({
          elapsedSeconds: meta.elapsed_seconds || 0,
          totalCost: costs.total_estimated_cost || 0,
          totalInputTokens: costs.total_input_tokens || 0,
          totalOutputTokens: costs.total_output_tokens || 0,
          orchestratorPaths: meta.orchestrator_paths || {},
          phase: coordination.phase || '',
          completionPercentage: coordination.completion_percentage || 0,
          lastFetchTime: Date.now(),
          elapsedAtLastFetch: meta.elapsed_seconds || 0,
        });
      } catch {
        // Silently ignore fetch errors (status.json may not exist yet)
      }
    },

    startPolling: (sessionId: string) => {
      const state = get();
      if (state.isPolling) return;

      set({ isPolling: true });

      // Initial fetch
      get().fetchOnce(sessionId);

      // Poll every 3 seconds
      pollInterval = setInterval(() => {
        get().fetchOnce(sessionId);
      }, 3000);
    },

    stopPolling: () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      set({ isPolling: false });
    },

    reset: () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      set(initialState);
    },
  })
);
