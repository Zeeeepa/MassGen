import { useState } from 'react';
import { cn } from '../../../lib/utils';
import { useAgentStore } from '../../../stores/agentStore';
import { useMessageStore, type AnswerMessage } from '../../../stores/v2/messageStore';
import { useTileStore } from '../../../stores/v2/tileStore';
import { getAgentColor } from '../../../utils/agentColors';

interface AnswerBrowserTileProps {
  /** If set, auto-expand this answer label on mount */
  focusAnswerLabel?: string;
}

export function AnswerBrowserTile({ focusAnswerLabel }: AnswerBrowserTileProps) {
  const allMessages = useMessageStore((s) => s.messages);
  const agentOrder = useAgentStore((s) => s.agentOrder);
  const agentModels = useMessageStore((s) => s.agentModels);
  const answers = useAgentStore((s) => s.answers);
  const addTile = useTileStore((s) => s.addTile);

  const [expandedAnswer, setExpandedAnswer] = useState<string | null>(focusAnswerLabel || null);

  // Collect all answers across agents, sorted newest-first
  const allAnswers: (AnswerMessage & { agentModel?: string })[] = [];
  for (const agentId of agentOrder) {
    const messages = allMessages[agentId] || [];
    for (const msg of messages) {
      if (msg.type === 'answer') {
        allAnswers.push({
          ...(msg as AnswerMessage),
          agentModel: agentModels[agentId],
        });
      }
    }
  }
  allAnswers.sort((a, b) => b.timestamp - a.timestamp);

  const handleViewWorkspace = (answerMsg: AnswerMessage) => {
    const matchingAnswer = answers.find(
      (a) => a.agentId === answerMsg.agentId && a.answerNumber === answerMsg.answerNumber
    );
    if (matchingAnswer?.workspacePath) {
      addTile({
        id: `workspace-${answerMsg.answerLabel}`,
        type: 'workspace-browser',
        targetId: matchingAnswer.workspacePath,
        label: `Files · ${answerMsg.answerLabel}`,
      });
    }
  };

  if (allAnswers.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-v2-base">
        <div className="text-center space-y-2">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" className="mx-auto text-yellow-500/30">
            <path d="M8 1l2.1 4.2L15 6l-3.5 3.4.8 4.8L8 12l-4.3 2.2.8-4.8L1 6l4.9-.8L8 1z" />
          </svg>
          <p className="text-sm text-v2-text-muted italic">No answers submitted yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto v2-scrollbar bg-v2-base p-3 space-y-2">
      {allAnswers.map((answer) => {
        const isExpanded = expandedAnswer === answer.answerLabel;
        const agentColor = getAgentColor(answer.agentId, agentOrder);
        const agentName = answer.agentId.replace(/_/g, ' ');
        const displayContent = answer.fullContent || answer.contentPreview;
        const matchingStoreAnswer = answers.find(
          (a) => a.agentId === answer.agentId && a.answerNumber === answer.answerNumber
        );
        const hasWorkspace = !!matchingStoreAnswer?.workspacePath;

        return (
          <div
            key={answer.id}
            className={cn(
              'rounded-lg border transition-colors duration-150',
              isExpanded
                ? 'bg-v2-surface border-yellow-500/30'
                : 'bg-v2-surface/50 border-v2-border hover:border-yellow-500/20 hover:bg-v2-surface'
            )}
          >
            {/* Header — always visible */}
            <button
              onClick={() => setExpandedAnswer(isExpanded ? null : answer.answerLabel)}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2.5"
            >
              {/* Agent color dot */}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: agentColor.hex }}
              />

              {/* Answer label */}
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 shrink-0">
                {answer.answerLabel}
              </span>

              {/* Agent name */}
              <span className="text-xs text-v2-text-secondary">
                {agentName}
                {answer.agentModel && (
                  <span className="text-v2-text-muted"> · {answer.agentModel}</span>
                )}
              </span>

              <div className="flex-1" />

              {/* Workspace icon */}
              {hasWorkspace && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-v2-text-muted/50 shrink-0">
                  <path d="M2 4.5A1.5 1.5 0 013.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5V4.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}

              {/* Expand chevron */}
              <svg
                className={cn(
                  'w-3 h-3 text-v2-text-muted transition-transform duration-150 shrink-0',
                  isExpanded && 'rotate-90'
                )}
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Preview — collapsed */}
            {!isExpanded && answer.contentPreview && (
              <div className="px-3 pb-2.5 -mt-1">
                <p className="text-xs text-v2-text-muted line-clamp-2 pl-5">
                  {answer.contentPreview}
                </p>
              </div>
            )}

            {/* Full content — expanded */}
            {isExpanded && (
              <div className="px-3 pb-3 animate-v2-fade-in">
                <div className="text-sm text-v2-text whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto v2-scrollbar pl-5 border-l-2 border-yellow-500/20 ml-0.5">
                  {displayContent}
                </div>

                {/* Actions */}
                {hasWorkspace && (
                  <div className="mt-2 pl-5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleViewWorkspace(answer); }}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs',
                        'bg-yellow-500/10 text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-500/15',
                        'transition-colors duration-150'
                      )}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4.5A1.5 1.5 0 013.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5V4.5z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      View workspace files
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
