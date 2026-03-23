import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import { useModeStore } from '../../../stores/v2/modeStore';
import type { CoordinationMode, AgentMode, PersonasMode } from '../../../stores/v2/modeStore';
import type { ProviderInfo } from '../../../stores/wizardStore';

/** A pill-group toggle for selecting between options */
function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-v2-input bg-[var(--v2-input-bg)] p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-v2-input transition-colors duration-100',
            value === opt.value
              ? 'bg-v2-accent text-white shadow-sm'
              : 'text-v2-text-secondary hover:text-v2-text hover:bg-v2-main/80'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Stepper control for agent count: [ − ] N [ + ] */
function AgentCountStepper() {
  const agentCount = useModeStore((s) => s.agentCount);
  const setAgentCount = useModeStore((s) => s.setAgentCount);

  const decrement = () => {
    if (agentCount === null || agentCount <= 1) {
      setAgentCount(null);
    } else {
      setAgentCount(agentCount - 1);
    }
  };

  const increment = () => {
    if (agentCount === null) {
      setAgentCount(1);
    } else if (agentCount < 8) {
      setAgentCount(agentCount + 1);
    }
  };

  return (
    <div
      data-testid="agent-count-stepper"
      className="inline-flex items-center rounded-v2-input bg-[var(--v2-input-bg)] border border-v2-border"
    >
      <button
        type="button"
        data-testid="agent-count-decrement"
        onClick={decrement}
        className="px-2 py-1.5 text-xs text-v2-text-secondary hover:text-v2-text transition-colors"
      >
        −
      </button>
      <span
        data-testid="agent-count-value"
        className="px-2 py-1.5 text-xs font-medium text-v2-text min-w-[2.5rem] text-center"
      >
        {agentCount ?? 'Config'}
      </span>
      <button
        type="button"
        data-testid="agent-count-increment"
        onClick={increment}
        className="px-2 py-1.5 text-xs text-v2-text-secondary hover:text-v2-text transition-colors"
      >
        +
      </button>
    </div>
  );
}

/** Popover for configuring a single agent's provider/model */
function AgentChipPopover({
  index,
  onClose,
}: {
  index: number;
  onClose: () => void;
}) {
  const providers = useModeStore((s) => s.providers);
  const agentConfigs = useModeStore((s) => s.agentConfigs);
  const dynamicModels = useModeStore((s) => s.dynamicModels);
  const loadingModels = useModeStore((s) => s.loadingModels);
  const setAgentConfig = useModeStore((s) => s.setAgentConfig);
  const fetchDynamicModels = useModeStore((s) => s.fetchDynamicModels);

  const config = agentConfigs[index];
  const [modelFilter, setModelFilter] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedProvider = config?.provider ?? null;
  const selectedModel = config?.model ?? null;

  const models = selectedProvider ? (dynamicModels[selectedProvider] ?? []) : [];
  const isLoadingModels = selectedProvider ? (loadingModels[selectedProvider] ?? false) : false;

  const filteredModels = modelFilter
    ? models.filter((m) => m.toLowerCase().includes(modelFilter.toLowerCase()))
    : models;

  const handleProviderSelect = async (provider: ProviderInfo) => {
    setAgentConfig(index, provider.id, null);
    await fetchDynamicModels(provider.id);
  };

  const handleModelSelect = (model: string) => {
    setAgentConfig(index, selectedProvider, model);
    onClose();
  };

  const handleApplyToAll = () => {
    const configs = useModeStore.getState().agentConfigs;
    for (let i = 0; i < configs.length; i++) {
      if (i !== index) {
        setAgentConfig(i, selectedProvider, selectedModel);
      }
    }
  };

  const handleClear = () => {
    setAgentConfig(index, null, null);
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      data-testid="agent-chip-popover"
      className="absolute bottom-full mb-2 bg-v2-surface-raised border border-v2-border rounded-v2-card shadow-lg w-72 z-50"
    >
      <div className="p-3 space-y-3">
        {/* Provider list */}
        <div>
          <div className="text-xs font-medium text-v2-text-secondary mb-1.5">Provider</div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!p.has_api_key}
                onClick={() => handleProviderSelect(p)}
                className={cn(
                  'w-full text-left px-2.5 py-1.5 text-xs rounded-v2-input transition-colors',
                  selectedProvider === p.id
                    ? 'bg-v2-accent/15 text-v2-accent'
                    : p.has_api_key
                      ? 'text-v2-text hover:bg-[var(--v2-channel-hover)]'
                      : 'text-v2-text-muted/50 cursor-not-allowed'
                )}
              >
                {p.name}
                {!p.has_api_key && <span className="ml-1 text-[10px]">(no key)</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Model list — only when a provider is selected */}
        {selectedProvider && (
          <div>
            <div className="text-xs font-medium text-v2-text-secondary mb-1.5">Model</div>
            <input
              type="text"
              placeholder="Filter models…"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className={cn(
                'w-full rounded-v2-input bg-[var(--v2-input-bg)] border border-v2-border',
                'px-2.5 py-1.5 text-xs text-v2-text placeholder:text-v2-text-muted',
                'focus:outline-none focus:ring-1 focus:ring-v2-accent/50 mb-1.5'
              )}
            />
            {isLoadingModels ? (
              <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-v2-text-muted">
                <span className="w-3 h-3 border-2 border-v2-accent/30 border-t-v2-accent rounded-full animate-spin" />
                Loading…
              </div>
            ) : (
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {filteredModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModelSelect(m)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 text-xs rounded-v2-input transition-colors',
                      selectedModel === m
                        ? 'bg-v2-accent/15 text-v2-accent'
                        : 'text-v2-text hover:bg-[var(--v2-channel-hover)]'
                    )}
                  >
                    {m}
                  </button>
                ))}
                {filteredModels.length === 0 && !isLoadingModels && (
                  <div className="px-2.5 py-1.5 text-xs text-v2-text-muted">
                    No models found
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-3 pt-1 border-t border-v2-border">
          {(selectedProvider || selectedModel) && (
            <>
              <button
                type="button"
                data-testid="apply-to-all-btn"
                onClick={handleApplyToAll}
                className="text-[11px] text-v2-accent hover:underline"
              >
                Apply to all
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-v2-text-muted hover:text-v2-text"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Horizontal strip of per-agent config chips */
function AgentChipStrip() {
  const agentCount = useModeStore((s) => s.agentCount);
  const agentConfigs = useModeStore((s) => s.agentConfigs);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (agentCount === null) {
    return (
      <span className="text-v2-text-muted text-xs">from config</span>
    );
  }

  const chipLabel = (index: number) => {
    const letter = String.fromCharCode(65 + index); // A, B, C…
    const config = agentConfigs[index];
    if (!config || (config.provider === null && config.model === null)) {
      return `${letter}: default`;
    }
    const parts: string[] = [];
    if (config.provider) parts.push(config.provider);
    if (config.model) {
      // Truncate long model names
      const short = config.model.length > 16 ? config.model.slice(0, 14) + '…' : config.model;
      parts.push(short);
    }
    return `${letter}: ${parts.join('/')}`;
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {Array.from({ length: agentCount }, (_, i) => (
        <div key={i} className="relative">
          <button
            type="button"
            data-testid={`agent-chip-${i}`}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium rounded-v2-input transition-colors whitespace-nowrap',
              'bg-[var(--v2-input-bg)] border',
              openIndex === i
                ? 'border-v2-accent ring-1 ring-v2-accent/30'
                : 'border-v2-border hover:border-v2-accent/50'
            )}
          >
            {chipLabel(i)}
          </button>
          {openIndex === i && (
            <AgentChipPopover
              index={i}
              onClose={() => setOpenIndex(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ModeConfigBar() {
  const coordinationMode = useModeStore((s) => s.coordinationMode);
  const agentMode = useModeStore((s) => s.agentMode);
  const refinementEnabled = useModeStore((s) => s.refinementEnabled);
  const personasMode = useModeStore((s) => s.personasMode);
  const dockerEnabled = useModeStore((s) => s.dockerEnabled);
  const executionLocked = useModeStore((s) => s.executionLocked);
  const providers = useModeStore((s) => s.providers);

  const setCoordinationMode = useModeStore((s) => s.setCoordinationMode);
  const setAgentMode = useModeStore((s) => s.setAgentMode);
  const setRefinementEnabled = useModeStore((s) => s.setRefinementEnabled);
  const setPersonasMode = useModeStore((s) => s.setPersonasMode);
  const setDockerEnabled = useModeStore((s) => s.setDockerEnabled);
  const fetchProviders = useModeStore((s) => s.fetchProviders);

  const isParallel = coordinationMode === 'parallel';

  // Fetch providers on mount if not already loaded
  useEffect(() => {
    if (providers.length === 0) fetchProviders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      data-testid="mode-config-bar"
      className={cn(
        'border-t border-v2-border bg-v2-surface px-4 py-2 space-y-1.5',
        executionLocked && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Row 1: Mode toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <SegmentedToggle<CoordinationMode>
          options={[
            { label: 'Parallel', value: 'parallel' },
            { label: 'Decomp', value: 'decomposition' },
          ]}
          value={coordinationMode}
          onChange={setCoordinationMode}
        />

        <SegmentedToggle<AgentMode>
          options={[
            { label: 'Multi', value: 'multi' },
            { label: 'Single', value: 'single' },
          ]}
          value={agentMode}
          onChange={setAgentMode}
        />

        <SegmentedToggle<string>
          options={[
            { label: 'Refine', value: 'on' },
            { label: 'Quick', value: 'off' },
          ]}
          value={refinementEnabled ? 'on' : 'off'}
          onChange={(v) => setRefinementEnabled(v === 'on')}
        />

        {isParallel && (
          <div data-testid="personas-group">
            <SegmentedToggle<PersonasMode>
              options={[
                { label: 'No Personas', value: 'off' },
                { label: 'Perspective', value: 'perspective' },
                { label: 'Implement', value: 'implementation' },
                { label: 'Method', value: 'methodology' },
              ]}
              value={personasMode}
              onChange={setPersonasMode}
            />
          </div>
        )}
      </div>

      {/* Row 2: Agent config — stepper + chips + docker */}
      <div className="flex items-center gap-2 flex-wrap">
        <AgentCountStepper />
        <AgentChipStrip />

        {/* Docker toggle */}
        <button
          type="button"
          data-testid="docker-toggle"
          onClick={() => setDockerEnabled(dockerEnabled === true ? false : true)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-v2-input text-xs font-medium',
            'border transition-colors duration-100',
            dockerEnabled === true
              ? 'bg-v2-accent/10 text-v2-accent border-v2-accent/30'
              : 'bg-[var(--v2-input-bg)] text-v2-text-secondary border-v2-border hover:text-v2-text'
          )}
        >
          <span>Docker</span>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            dockerEnabled === true ? 'bg-v2-online' : 'bg-v2-text-muted/40'
          )} />
        </button>
      </div>
    </div>
  );
}
