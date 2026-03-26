import { useState, useEffect } from 'react';
import { cn } from '../../../lib/utils';
import { useAgentStore } from '../../../stores/agentStore';
import { useStatusStore } from '../../../stores/v2/statusStore';

const MAX_DISPLAY_LENGTH = 80;

function truncateQuestion(q: string): string {
  const single = q.replace(/\n/g, ' ').trim();
  if (single.length <= MAX_DISPLAY_LENGTH) return single;
  return single.slice(0, MAX_DISPLAY_LENGTH - 1) + '\u2026';
}

export function PromptBanner() {
  const question = useAgentStore((s) => s.question);
  const turnNumber = useAgentStore((s) => s.turnNumber);
  const logDir = useAgentStore((s) => s.logDir);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  if (!question) return null;

  return (
    <div className="relative shrink-0">
      {/* Thin inline bar with two click zones */}
      <div
        data-testid="prompt-banner"
        className={cn(
          'flex items-center gap-2 px-4 py-1',
          'bg-v2-surface border-b border-v2-border-subtle',
          'text-[11px] text-v2-text-muted',
        )}
      >
        {/* LEFT ZONE — click to expand prompt */}
        <button
          className="flex items-center gap-2 min-w-0 hover:bg-v2-surface-raised/50 rounded px-1 -ml-1 py-0.5 transition-colors"
          onClick={() => { setPromptExpanded(!promptExpanded); setMetricsExpanded(false); }}
        >
          <span className="text-v2-accent font-semibold shrink-0">
            Turn {turnNumber}
          </span>
          <span className="text-v2-border-subtle">|</span>
          <span className="italic truncate min-w-0">
            {truncateQuestion(question)}
          </span>
        </button>

        <div className="flex-1" />

        {/* RIGHT ZONE — click to expand metrics detail */}
        <MetricsSummary
          expanded={metricsExpanded}
          onToggle={() => { setMetricsExpanded(!metricsExpanded); setPromptExpanded(false); }}
        />
      </div>

      {/* Prompt expanded overlay */}
      {promptExpanded && (
        <div
          data-testid="prompt-expanded"
          className={cn(
            'absolute top-full left-0 right-0 z-20',
            'border-b border-v2-border shadow-lg',
            'bg-v2-surface-raised',
            'animate-v2-fade-in'
          )}
        >
          <div className="px-4 py-2.5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-v2-text whitespace-pre-wrap break-words flex-1 max-h-48 overflow-y-auto v2-scrollbar">
                {question}
              </p>
              <button
                data-testid="prompt-expanded-close"
                onClick={(e) => { e.stopPropagation(); setPromptExpanded(false); }}
                className={cn(
                  'flex items-center justify-center w-5 h-5 rounded shrink-0 ml-2',
                  'text-v2-text-muted hover:text-v2-text hover:bg-v2-sidebar-hover',
                  'transition-colors duration-150'
                )}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ContextPaths logDir={logDir} />
          </div>
        </div>
      )}

      {/* Metrics expanded overlay */}
      {metricsExpanded && (
        <div
          data-testid="metrics-expanded"
          className={cn(
            'absolute top-full right-0 z-20 w-72',
            'border border-v2-border rounded-b-lg shadow-lg',
            'bg-v2-surface-raised',
            'animate-v2-fade-in'
          )}
        >
          <MetricsDetail onClose={() => setMetricsExpanded(false)} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Metrics Summary (inline in top bar, clickable)
// ============================================================================

function MetricsSummary({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const elapsedAtLastFetch = useStatusStore((s) => s.elapsedAtLastFetch);
  const lastFetchTime = useStatusStore((s) => s.lastFetchTime);
  const totalCost = useStatusStore((s) => s.totalCost);
  const totalInputTokens = useStatusStore((s) => s.totalInputTokens);
  const totalOutputTokens = useStatusStore((s) => s.totalOutputTokens);
  const isComplete = useAgentStore((s) => s.isComplete);

  const [displayElapsed, setDisplayElapsed] = useState(0);

  useEffect(() => {
    if (!lastFetchTime) return;
    const update = () => {
      if (isComplete) { setDisplayElapsed(elapsedAtLastFetch); return; }
      const since = (Date.now() - lastFetchTime) / 1000;
      setDisplayElapsed(elapsedAtLastFetch + since);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastFetchTime, elapsedAtLastFetch, isComplete]);

  if (!lastFetchTime) return null;

  const totalTokens = totalInputTokens + totalOutputTokens;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 shrink-0 tabular-nums px-1.5 py-0.5 rounded',
        'hover:bg-v2-surface-raised/50 transition-colors',
        expanded && 'bg-v2-surface-raised/50'
      )}
    >
      <span className="text-v2-text-muted/70">{formatElapsedTime(displayElapsed)}</span>
      {totalCost > 0 && (
        <>
          <span className="text-v2-border-subtle">·</span>
          <span className="text-v2-text-muted/70">{formatCost(totalCost)}</span>
        </>
      )}
      {totalTokens > 0 && (
        <>
          <span className="text-v2-border-subtle">·</span>
          <span className="text-v2-text-muted/70">{formatTokens(totalTokens)}</span>
        </>
      )}
    </button>
  );
}

// ============================================================================
// Metrics Detail (popover panel)
// ============================================================================

function MetricsDetail({ onClose }: { onClose: () => void }) {
  const elapsedAtLastFetch = useStatusStore((s) => s.elapsedAtLastFetch);
  const lastFetchTime = useStatusStore((s) => s.lastFetchTime);
  const totalCost = useStatusStore((s) => s.totalCost);
  const totalInputTokens = useStatusStore((s) => s.totalInputTokens);
  const totalOutputTokens = useStatusStore((s) => s.totalOutputTokens);
  const phase = useStatusStore((s) => s.phase);
  const completionPercentage = useStatusStore((s) => s.completionPercentage);
  const isComplete = useAgentStore((s) => s.isComplete);

  const [displayElapsed, setDisplayElapsed] = useState(0);

  useEffect(() => {
    if (!lastFetchTime) return;
    const update = () => {
      if (isComplete) { setDisplayElapsed(elapsedAtLastFetch); return; }
      const since = (Date.now() - lastFetchTime) / 1000;
      setDisplayElapsed(elapsedAtLastFetch + since);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastFetchTime, elapsedAtLastFetch, isComplete]);

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-v2-text-muted">
          Run Metrics
        </span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-v2-text-muted hover:text-v2-text hover:bg-v2-sidebar-hover transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Time */}
      <MetricRow label="Elapsed" value={formatElapsedTime(displayElapsed)} />

      {/* Phase */}
      {phase && (
        <MetricRow
          label="Phase"
          value={phase.replace(/_/g, ' ')}
          extra={completionPercentage > 0 ? `${completionPercentage}%` : undefined}
        />
      )}

      {/* Divider */}
      <div className="h-px bg-v2-border" />

      {/* Cost */}
      <MetricRow label="Estimated cost" value={formatCost(totalCost)} />

      {/* Tokens */}
      <MetricRow label="Input tokens" value={totalInputTokens.toLocaleString()} />
      <MetricRow label="Output tokens" value={totalOutputTokens.toLocaleString()} />
      <MetricRow
        label="Total tokens"
        value={(totalInputTokens + totalOutputTokens).toLocaleString()}
      />
    </div>
  );
}

function MetricRow({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-v2-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-v2-text tabular-nums font-medium">{value}</span>
        {extra && <span className="text-v2-text-muted/60 tabular-nums">{extra}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Context Paths (in prompt expanded overlay)
// ============================================================================

function ContextPaths({ logDir }: { logDir?: string }) {
  const orchestratorPaths = useStatusStore((s) => s.orchestratorPaths);
  const paths = Object.entries(orchestratorPaths);
  if (paths.length === 0 && !logDir) return null;

  return (
    <div className="mt-2 pt-2 border-t border-v2-border-subtle">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-v2-text-muted">
        {paths.map(([key, value]) => (
          <span key={key}>
            <span className="text-v2-text-secondary">{formatPathKey(key)}:</span>{' '}
            <span className="font-mono opacity-70">{shortenPath(String(value))}</span>
          </span>
        ))}
        {logDir && (
          <span>
            <span className="text-v2-text-secondary">Log dir:</span>{' '}
            <span className="font-mono opacity-70">{shortenPath(logDir)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Formatters
// ============================================================================

function formatElapsedTime(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.001';
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count < 1000) return `${count} tok`;
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K tok`;
  return `${(count / 1_000_000).toFixed(1)}M tok`;
}

function formatPathKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortenPath(path: string): string {
  const home = '/Users/';
  if (path.startsWith(home)) {
    const rest = path.slice(home.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx >= 0) return '~' + rest.slice(slashIdx);
  }
  return path;
}
