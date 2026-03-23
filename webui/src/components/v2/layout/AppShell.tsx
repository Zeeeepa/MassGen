import { useState, useEffect, useRef } from 'react';
import { cn } from '../../../lib/utils';
import { useAgentStore } from '../../../stores/agentStore';
import { useMessageStore } from '../../../stores/v2/messageStore';
import { useThemeStore } from '../../../stores/themeStore';
import { useTileStore } from '../../../stores/v2/tileStore';
import { useWizardStore } from '../../../stores/wizardStore';
import { useSetupStore } from '../../../stores/setupStore';
import { useV2KeyboardShortcuts } from '../../../hooks/useV2KeyboardShortcuts';
import type { ConnectionStatus } from '../../../hooks/useWebSocket';
import { useModeStore } from '../../../stores/v2/modeStore';
import { Sidebar } from '../sidebar/Sidebar';
import { TileContainer } from '../tiles/TileContainer';
import { GlobalInputBar } from './GlobalInputBar';
import { FinalAnswerOverlay } from './FinalAnswerOverlay';
import { ModeConfigBar } from './ModeConfigBar';
import { V2QuickstartWizard } from './V2QuickstartWizard';
import { V2SetupOverlay } from './V2SetupOverlay';
import { LaunchIndicator } from './LaunchIndicator';

interface AppShellProps {
  wsStatus: ConnectionStatus;
  startCoordination: (question: string, configPath?: string) => void;
  continueConversation: (question: string) => void;
  cancelCoordination?: () => void;
  selectedConfig: string | null;
  onConfigChange: (configPath: string) => void;
  onSessionChange?: (sessionId: string) => void;
  onNewSession?: () => void;
  broadcastMessage?: (message: string, targets: string[] | null) => void;
}

export function AppShell({
  wsStatus,
  startCoordination,
  continueConversation,
  cancelCoordination,
  selectedConfig,
  onConfigChange,
  onSessionChange,
  onNewSession,
  broadcastMessage,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showFinalAnswer, setShowFinalAnswer] = useState(false);
  const [configRefreshTrigger, setConfigRefreshTrigger] = useState(0);

  // Wizard state
  const isWizardOpen = useWizardStore((s) => s.isOpen);
  const openWizard = useWizardStore((s) => s.openWizard);

  // Setup overlay state
  const isSetupOpen = useSetupStore((s) => s.isOpen);
  const openSetup = useSetupStore((s) => s.openSetup);

  // Check if first-time setup is needed, or if wizard/setup URL params are set
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('setup') === 'open') {
      openSetup();
      return;
    }
    if (urlParams.get('wizard') === 'open') {
      openWizard();
      return;
    }

    fetch('/api/setup/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.needs_setup) {
          openSetup();
        }
      })
      .catch(() => {});
  }, [openWizard, openSetup]);

  // Determine temporary mode from URL
  const initialTemporaryQuickstart = new URLSearchParams(window.location.search).get('temporary') === '1';

  const handleWizardConfigSaved = (configPath: string) => {
    onConfigChange(configPath);
    setConfigRefreshTrigger((n) => n + 1);
  };

  // Keyboard shortcuts
  useV2KeyboardShortcuts();

  // Theme sync
  const getEffectiveTheme = useThemeStore((s) => s.getEffectiveTheme);
  const themeMode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const effectiveTheme = getEffectiveTheme();
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [getEffectiveTheme, themeMode]);

  // Auto-select first agent channel when agents initialize
  const agentOrder = useAgentStore((s) => s.agentOrder);
  const tiles = useTileStore((s) => s.tiles);
  const setTile = useTileStore((s) => s.setTile);
  const prevAgentCountRef = useRef(0);

  useEffect(() => {
    // When agents first appear and no tile is open, auto-open the first agent
    if (agentOrder.length > 0 && prevAgentCountRef.current === 0 && tiles.length === 0) {
      const firstAgent = agentOrder[0];
      const agents = useAgentStore.getState().agents;
      setTile({
        id: `channel-${firstAgent}`,
        type: 'agent-channel',
        targetId: firstAgent,
        label: agents[firstAgent]?.modelName || firstAgent,
      });
    }
    prevAgentCountRef.current = agentOrder.length;
  }, [agentOrder, tiles.length, setTile]);

  // Show final answer overlay when consensus is reached
  const viewMode = useAgentStore((s) => s.viewMode);

  useEffect(() => {
    if (viewMode === 'finalComplete') {
      setShowFinalAnswer(true);
    }
  }, [viewMode]);

  const question = useAgentStore((s) => s.question);
  const isComplete = useAgentStore((s) => s.isComplete);
  const hasRenderableActivity = useMessageStore((s) =>
    Object.values(s.messages).some((agentMessages) =>
      agentMessages.some((message) => message.type !== 'round-divider')
    )
  );

  // Keep the launch sequence visible until the first meaningful agent activity arrives.
  const isLaunching = !!question && !isComplete && !hasRenderableActivity;

  // Lock/unlock mode bar during coordination execution
  const isRunning = !!question && !isComplete;
  const prevIsRunningRef = useRef(false);
  useEffect(() => {
    if (isRunning && !prevIsRunningRef.current) {
      useModeStore.getState().lock();
    } else if (!isRunning && prevIsRunningRef.current) {
      useModeStore.getState().unlock();
    }
    prevIsRunningRef.current = isRunning;
  }, [isRunning]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-v2-main text-v2-text font-sans">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSessionChange={onSessionChange}
        onNewSession={onNewSession}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Crossfade the launch sequence into the tile view instead of hard-swapping */}
        <div className="relative flex-1 min-h-0">
          <div
            data-testid="launch-layer"
            className={cn(
              'absolute inset-0 flex transition-opacity duration-300',
              isLaunching ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <LaunchIndicator
              configName={selectedConfig?.split('/').pop()?.replace('.yaml', '') || undefined}
            />
          </div>
          <div
            data-testid="tiles-layer"
            className={cn(
              'absolute inset-0 transition-opacity duration-300',
              isLaunching ? 'opacity-0 pointer-events-none' : 'opacity-100'
            )}
          >
            <TileContainer />
          </div>
        </div>

        {/* Mode configuration bar */}
        <ModeConfigBar />

        {/* Global input bar — start session or broadcast */}
        <GlobalInputBar
          wsStatus={wsStatus}
          startCoordination={startCoordination}
          continueConversation={continueConversation}
          cancelCoordination={cancelCoordination}
          selectedConfig={selectedConfig}
          onConfigChange={onConfigChange}
          hasActiveSession={!!question}
          isComplete={isComplete}
          isLaunching={isLaunching}
          broadcastMessage={broadcastMessage}
          refreshTrigger={configRefreshTrigger}
        />
      </div>

      {/* V2 Setup Overlay */}
      {isSetupOpen && <V2SetupOverlay />}

      {/* V2 Quickstart Wizard */}
      {isWizardOpen && (
        <V2QuickstartWizard
          onConfigSaved={handleWizardConfigSaved}
          temporaryMode={initialTemporaryQuickstart}
        />
      )}

      {/* Final Answer Overlay */}
      {showFinalAnswer && (
        <FinalAnswerOverlay
          onDismiss={() => setShowFinalAnswer(false)}
        />
      )}
    </div>
  );
}
