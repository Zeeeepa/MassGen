import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '../../../lib/utils';
import { useMessageStore } from '../../../stores/v2/messageStore';

const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 720;

const STATUS_ICONS: Record<string, string> = {
  pending: '\u00B7',
  in_progress: '\u2192',
  completed: '\u2713',
  verified: '\u2713\u2713',
  blocked: '\u25CB',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-v2-text-muted',
  in_progress: 'text-v2-accent',
  completed: 'text-v2-online',
  verified: 'text-v2-online',
  blocked: 'text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-v2-idle',
  low: 'bg-v2-text-muted',
};

export function TaskPlanPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const taskPlan = useMessageStore((s) => s.taskPlan);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const delta = resizeState.startX - event.clientX;
      const nextWidth = Math.min(
        MAX_PANEL_WIDTH,
        Math.max(MIN_PANEL_WIDTH, resizeState.startWidth + delta)
      );
      setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, []);

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: panelWidth,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (!taskPlan || taskPlan.length === 0) return null;

  const completedCount = taskPlan.filter(
    (t) => t.status === 'completed' || t.status === 'verified'
  ).length;
  const inProgressCount = taskPlan.filter((t) => t.status === 'in_progress').length;
  const totalCount = taskPlan.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={cn(
          'absolute right-3 top-3 z-10',
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-v2-card',
          'bg-v2-surface-raised border border-v2-border shadow-lg',
          'text-xs text-v2-text-muted hover:text-v2-text',
          'transition-colors duration-150'
        )}
      >
        <span className="font-medium">PLAN</span>
        <span className="text-v2-accent">
          {completedCount}/{totalCount}
        </span>
      </button>
    );
  }

  return (
    <div
      data-testid="task-plan-panel"
      className={cn(
        'absolute right-3 top-3 z-10 max-w-[calc(100%-1.5rem)]',
        'bg-v2-surface-raised border border-v2-border rounded-v2-card shadow-lg',
        'animate-v2-fade-in'
      )}
      style={{ width: `${panelWidth}px` }}
    >
      <button
        data-testid="task-plan-resize-handle"
        type="button"
        aria-label="Resize task plan panel"
        onMouseDown={startResize}
        className={cn(
          'absolute left-0 top-0 h-full w-3 -translate-x-1/2',
          'cursor-col-resize rounded-full'
        )}
      >
        <span className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-v2-border" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-v2-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-v2-text">Plan</span>
          <span className="text-[11px] text-v2-accent font-medium">
            {completedCount}/{totalCount}
          </span>
          {inProgressCount > 0 && (
            <span className="text-[10px] text-v2-text-muted">
              ({inProgressCount} active)
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-v2-text-muted hover:text-v2-text text-sm leading-none px-1"
        >
          &times;
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-3 pt-2 pb-1">
        <div className="h-1 rounded-full bg-v2-border-subtle overflow-hidden">
          <div
            className="h-full bg-v2-online rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="py-1 max-h-[45vh] overflow-y-auto v2-scrollbar">
        {taskPlan.map((task, idx) => (
          <div
            key={task.id}
            className={cn(
              'flex items-start gap-2.5 px-3 py-1.5',
              task.status === 'in_progress' && 'bg-v2-accent/5 border-l-2 border-v2-accent',
              task.status !== 'in_progress' && 'border-l-2 border-transparent'
            )}
          >
            {/* Status icon */}
            <span
              className={cn(
                'text-sm font-mono w-4 shrink-0 text-center mt-0.5',
                STATUS_COLORS[task.status] || 'text-v2-text-muted'
              )}
            >
              {STATUS_ICONS[task.status] || '\u00B7'}
            </span>

            {/* Task content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {/* Priority dot */}
                {task.priority && (
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      PRIORITY_COLORS[task.priority] || 'bg-v2-text-muted'
                    )}
                    title={`${task.priority} priority`}
                  />
                )}
                {/* Task number */}
                <span className="text-[10px] text-v2-text-muted shrink-0">
                  {idx + 1}.
                </span>
                {/* Description */}
                <span
                  className={cn(
                    'text-xs leading-relaxed',
                    task.status === 'completed' || task.status === 'verified'
                      ? 'text-v2-text-muted line-through'
                      : task.status === 'in_progress'
                        ? 'text-v2-text font-medium'
                        : task.status === 'blocked'
                          ? 'text-red-400/70'
                          : 'text-v2-text-secondary'
                  )}
                >
                  {task.description}
                </span>
              </div>

              {/* Dependencies */}
              {task.dependencies && task.dependencies.length > 0 && task.status === 'blocked' && (
                <div className="text-[10px] text-v2-text-muted mt-0.5 ml-4">
                  blocked by: {task.dependencies.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
