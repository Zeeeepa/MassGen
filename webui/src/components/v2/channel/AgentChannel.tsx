import { useRef, useEffect, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { useAgentStore } from '../../../stores/agentStore';
import { useMessageStore, type ChannelMessage, type ToolCallMessage } from '../../../stores/v2/messageStore';
import { useTileStore } from '../../../stores/v2/tileStore';
import { getAgentColor } from '../../../utils/agentColors';
import { MessageRenderer } from './messages/MessageRenderer';
import { ToolBatchView } from './messages/ToolBatchView';
import { ModeBar } from './ModeBar';
import { TaskPlanPanel } from './TaskPlanPanel';
import { StreamingIndicator } from './StreamingIndicator';
import { TileDragHandle } from '../tiles/TileDragHandle';
import { useTileDrag } from '../tiles/TileDragContext';

interface AgentChannelProps {
  agentId: string;
}

export function AgentChannel({ agentId }: AgentChannelProps) {
  const agent = useAgentStore((s) => s.agents[agentId]);
  const agentOrder = useAgentStore((s) => s.agentOrder);
  const messages = useMessageStore((s) => s.messages[agentId] || []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el && isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Track if user has scrolled up (disable auto-scroll)
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isAutoScrollRef.current = atBottom;
  };

  // Streaming indicator: show when agent is working and last msg isn't a pending tool call
  const lastMsg = messages[messages.length - 1];
  const lastIsPending = lastMsg?.type === 'tool-call' && lastMsg.result === undefined;
  const showStreaming = agent?.status === 'working' && messages.length > 0 && !lastIsPending;

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-v2-text-muted text-sm">
        Agent not found: {agentId}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <ChannelHeader agentId={agentId} agent={agent} agentOrder={agentOrder} />

      {/* Mode bar */}
      <ModeBar />

      {/* Message stream + plan overlay */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        <TaskPlanPanel />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto v2-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3 animate-v2-welcome-fade-in">
                {/* Pulsing accent ring */}
                <div className="w-12 h-12 mx-auto rounded-full border-2 border-v2-accent/20 flex items-center justify-center">
                  {agent.status === 'working' ? (
                    <div className="w-8 h-8 rounded-full border-2 border-v2-border border-t-v2-accent animate-spin" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-v2-accent/40 animate-pulse" />
                  )}
                </div>
                <p className="text-sm text-v2-text-secondary">
                  {agent.status === 'working' ? 'Preparing response...' : 'Connecting to agent...'}
                </p>
                <div className="flex justify-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-v2-text-muted streaming-dot" style={{ animationDelay: '0s' }} />
                  <span className="w-1 h-1 rounded-full bg-v2-text-muted streaming-dot" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1 h-1 rounded-full bg-v2-text-muted streaming-dot" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <GroupedMessages messages={messages} />
            </div>
          )}

          {/* Active generation indicator */}
          <StreamingIndicator visible={showStreaming} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Channel Header
// ============================================================================

interface ChannelHeaderProps {
  agentId: string;
  agent: { status: string; modelName?: string };
  agentOrder: string[];
}

function ChannelHeader({ agentId, agent, agentOrder }: ChannelHeaderProps) {
  const setAutofitTiles = useTileStore((s) => s.setAutofitTiles);
  const isAutofit = useTileStore((s) => s.autofit);
  const { isDraggable } = useTileDrag();
  const agentColor = getAgentColor(agentId, agentOrder);
  const agentIndex = agentOrder.indexOf(agentId);

  const handleAutofit = () => {
    if (isAutofit) {
      // Toggle back to single view — set first agent
      useTileStore.getState().setTile({
        id: `channel-${agentOrder[0]}`,
        type: 'agent-channel',
        targetId: agentOrder[0],
        label: agentOrder[0],
      });
    } else {
      // Show all agents
      const allTiles = agentOrder.map((id) => ({
        id: `channel-${id}`,
        type: 'agent-channel' as const,
        targetId: id,
        label: id,
      }));
      setAutofitTiles(allTiles);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-v2-border-subtle bg-v2-surface shrink-0"
      style={{ borderLeftWidth: '3px', borderLeftColor: agentColor.hex }}
    >
      {/* Drag handle — before numbered badge */}
      {isDraggable && <TileDragHandle />}

      {/* Numbered color badge */}
      <span
        className="flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold text-white shrink-0"
        style={{ backgroundColor: agentColor.hex }}
      >
        {agentIndex + 1}
      </span>

      {/* Agent name */}
      <span className="font-medium text-sm text-v2-text">
        {agentId.replace(/_/g, ' ')}
      </span>

      {/* Model badge */}
      {agent.modelName && (
        <span className="text-[11px] text-v2-text-muted bg-v2-surface-raised px-1.5 py-0.5 rounded border border-v2-border-subtle">
          {agent.modelName}
        </span>
      )}

      {/* Status */}
      <StatusBadge status={agent.status} />

      <div className="flex-1" />

      {/* Autofit button */}
      {agentOrder.length > 1 && (
        <button
          onClick={handleAutofit}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2 py-1 rounded',
            'text-v2-text-muted hover:text-v2-text hover:bg-v2-sidebar-hover',
            'transition-colors duration-150',
            isAutofit && 'bg-v2-accent/10 text-v2-accent'
          )}
          title={isAutofit ? 'Single agent view' : 'See all agents'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="5" height="12" rx="1" />
            <rect x="9" y="2" width="5" height="12" rx="1" />
          </svg>
          {isAutofit ? 'Single' : 'Autofit'}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Grouped Message Rendering — batches consecutive tool calls
// ============================================================================

/** Planning tools that should be hidden (shown in TaskPlanPanel instead) */
const PLAN_TOOLS = ['create_task_plan', 'update_task_status', 'add_task', 'edit_task'];

function isVisibleToolCall(msg: ChannelMessage): boolean {
  if (msg.type !== 'tool-call') return false;
  return !PLAN_TOOLS.some((pt) => (msg as ToolCallMessage).toolName.endsWith(pt));
}

type RenderItem =
  | { kind: 'message'; message: ChannelMessage }
  | { kind: 'batch'; tools: ToolCallMessage[] };

function GroupedMessages({ messages }: { messages: ChannelMessage[] }) {
  const items = useMemo(() => {
    const result: RenderItem[] = [];
    let toolBatch: ToolCallMessage[] = [];

    const flushBatch = () => {
      if (toolBatch.length === 0) return;
      if (toolBatch.length === 1) {
        result.push({ kind: 'message', message: toolBatch[0] });
      } else {
        result.push({ kind: 'batch', tools: [...toolBatch] });
      }
      toolBatch = [];
    };

    for (const msg of messages) {
      // Skip hidden planning tools
      if (msg.type === 'tool-call' && !isVisibleToolCall(msg)) continue;

      if (msg.type === 'tool-call') {
        toolBatch.push(msg as ToolCallMessage);
      } else {
        flushBatch();
        result.push({ kind: 'message', message: msg });
      }
    }
    flushBatch();

    return result;
  }, [messages]);

  return (
    <>
      {items.map((item) => {
        if (item.kind === 'batch') {
          return <ToolBatchView key={item.tools[0].id} tools={item.tools} />;
        }
        return <MessageRenderer key={item.message.id} message={item.message} />;
      })}
    </>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; pulse?: boolean }> = {
    working: { color: 'bg-v2-online', label: 'Working', pulse: true },
    voting: { color: 'bg-v2-idle', label: 'Voting', pulse: true },
    completed: { color: 'bg-v2-offline', label: 'Done' },
    failed: { color: 'bg-red-500', label: 'Failed' },
    waiting: { color: 'bg-v2-offline', label: 'Waiting' },
  };

  const { color, label, pulse } = config[status] || config.waiting;

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', color, pulse && 'animate-pulse')} />
      <span className="text-xs text-v2-text-muted">{label}</span>
      {pulse && (
        <span className="flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-v2-online streaming-dot" style={{ animationDelay: '0s' }} />
          <span className="w-1 h-1 rounded-full bg-v2-online streaming-dot" style={{ animationDelay: '0.15s' }} />
          <span className="w-1 h-1 rounded-full bg-v2-online streaming-dot" style={{ animationDelay: '0.3s' }} />
        </span>
      )}
    </div>
  );
}
