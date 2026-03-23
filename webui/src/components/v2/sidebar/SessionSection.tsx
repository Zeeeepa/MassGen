import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../../lib/utils';
import { useAgentStore } from '../../../stores/agentStore';
import { useMessageStore } from '../../../stores/v2/messageStore';
import { useTileStore } from '../../../stores/v2/tileStore';
import type { SessionInfo } from '../../../types';

// localStorage key for custom session names
const SESSION_NAMES_KEY = 'massgen_session_names';

function getCustomNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SESSION_NAMES_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCustomName(sessionId: string, name: string) {
  const names = getCustomNames();
  names[sessionId] = name;
  localStorage.setItem(SESSION_NAMES_KEY, JSON.stringify(names));
}

function removeCustomName(sessionId: string) {
  const names = getCustomNames();
  delete names[sessionId];
  localStorage.setItem(SESSION_NAMES_KEY, JSON.stringify(names));
}

interface SessionSectionProps {
  collapsed: boolean;
  onSessionChange?: (sessionId: string) => void;
  onNewSession?: () => void;
}

export function SessionSection({ collapsed, onSessionChange, onNewSession }: SessionSectionProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [customNames, setCustomNames] = useState<Record<string, string>>(getCustomNames);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const currentSessionId = useAgentStore((s) => s.sessionId);
  const question = useAgentStore((s) => s.question);

  const handleSwitchSession = useCallback((sessionId: string) => {
    if (!onSessionChange || sessionId === currentSessionId) return;
    useMessageStore.getState().reset();
    useTileStore.getState().reset();
    onSessionChange(sessionId);
  }, [onSessionChange, currentSessionId]);

  const fetchSessions = useCallback(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data: { sessions: SessionInfo[] }) => {
        setSessions(data.sessions || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId, fetchSessions]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuSessionId) return;
    const handleClick = () => setMenuSessionId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuSessionId]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setMenuSessionId(null);
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      removeCustomName(sessionId);
      setCustomNames(getCustomNames());
    } catch {
      // Silently fail — session may already be gone
    }
  }, []);

  const handleStartRename = useCallback((sessionId: string, currentLabel: string) => {
    setMenuSessionId(null);
    setEditingSessionId(sessionId);
    setEditValue(customNames[sessionId] || currentLabel);
  }, [customNames]);

  const handleCommitRename = useCallback(() => {
    if (!editingSessionId) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      setCustomName(editingSessionId, trimmed);
    } else {
      removeCustomName(editingSessionId);
    }
    setCustomNames(getCustomNames());
    setEditingSessionId(null);
  }, [editingSessionId, editValue]);

  const handleCancelRename = useCallback(() => {
    setEditingSessionId(null);
  }, []);

  const getDisplayLabel = useCallback((session: SessionInfo) => {
    const custom = customNames[session.session_id];
    if (custom) return custom;
    const base = session.question || session.session_id.slice(0, 8);
    return base.length > 30 ? base.slice(0, 30) + '...' : base;
  }, [customNames]);

  return (
    <div className="py-1">
      {!collapsed && (
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-v2-text-muted">
            Sessions
          </span>
          <button
            onClick={onNewSession}
            className={cn(
              'flex items-center justify-center w-4 h-4 rounded',
              'text-v2-text-muted hover:text-v2-text',
              'transition-colors duration-150'
            )}
            title="New session"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="space-y-0.5">
        {/* Current session always shown at top */}
        {question && (
          <SidebarItem
            icon={<span className="w-2 h-2 rounded-full bg-v2-online" />}
            label={
              customNames[currentSessionId] ||
              (question.length > 30 ? question.slice(0, 30) + '...' : question)
            }
            active
            collapsed={collapsed}
          />
        )}

        {/* Other sessions from API */}
        {sessions
          .filter((s) => s.session_id !== currentSessionId)
          .slice(0, 10)
          .map((session) => {
            const label = getDisplayLabel(session);
            const isEditing = editingSessionId === session.session_id;
            const showMenu = menuSessionId === session.session_id;

            return (
              <div key={session.session_id} className="relative group">
                {isEditing ? (
                  <div className="px-2 py-1">
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onBlur={handleCommitRename}
                      className={cn(
                        'w-full text-sm px-2 py-1 rounded',
                        'bg-v2-surface border border-v2-accent/50',
                        'text-v2-text outline-none'
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div
                      className="flex-1 min-w-0"
                      onDoubleClick={() => handleStartRename(session.session_id, label)}
                    >
                      <SidebarItem
                        icon={
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              session.is_running ? 'bg-v2-online' : 'bg-v2-offline'
                            )}
                          />
                        }
                        label={label}
                        collapsed={collapsed}
                        onClick={() => handleSwitchSession(session.session_id)}
                      />
                    </div>
                    {/* Kebab menu button — visible on hover */}
                    {!collapsed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuSessionId(showMenu ? null : session.session_id);
                        }}
                        className={cn(
                          'shrink-0 flex items-center justify-center w-5 h-5 rounded mr-1',
                          'text-v2-text-muted hover:text-v2-text hover:bg-v2-sidebar-hover',
                          'transition-opacity duration-100',
                          showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                        title="Session options"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                          <circle cx="5" cy="2" r="1" />
                          <circle cx="5" cy="5" r="1" />
                          <circle cx="5" cy="8" r="1" />
                        </svg>
                      </button>
                    )}
                    {/* Dropdown menu */}
                    {showMenu && !collapsed && (
                      <div
                        className={cn(
                          'absolute right-0 top-full z-50 mt-0.5',
                          'bg-v2-surface-raised border border-v2-border rounded-v2-card shadow-lg',
                          'py-1 min-w-[120px]'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleStartRename(session.session_id, label)}
                          className="w-full text-left px-3 py-1.5 text-xs text-v2-text-secondary hover:bg-[var(--v2-channel-hover)] hover:text-v2-text"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.session_id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {!question && sessions.length === 0 && !collapsed && (
          <p className="text-xs text-v2-text-muted px-2 py-2 italic">
            No sessions
          </p>
        )}
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

export function SidebarItem({ icon, label, active, collapsed, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm',
        'transition-colors duration-100',
        active
          ? 'bg-[var(--v2-channel-active)] text-v2-text'
          : 'text-v2-text-secondary hover:bg-[var(--v2-channel-hover)] hover:text-v2-text',
        collapsed && 'justify-center px-0'
      )}
      title={collapsed ? label : undefined}
    >
      <span className="shrink-0 flex items-center justify-center w-5 h-5">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
