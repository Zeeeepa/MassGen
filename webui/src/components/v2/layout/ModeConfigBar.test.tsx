import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeConfigBar } from './ModeConfigBar';
import { useModeStore } from '../../../stores/v2/modeStore';

describe('ModeConfigBar', () => {
  beforeEach(() => {
    useModeStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders row 1 mode toggles', () => {
    render(<ModeConfigBar />);
    expect(screen.getByText('Parallel')).toBeDefined();
    expect(screen.getByText('Decomp')).toBeDefined();
    expect(screen.getByText('Multi')).toBeDefined();
    expect(screen.getByText('Single')).toBeDefined();
    expect(screen.getByText('Refine')).toBeDefined();
    expect(screen.getByText('Quick')).toBeDefined();
  });

  it('renders row 2 agent config controls', () => {
    render(<ModeConfigBar />);
    // Agent count stepper
    expect(screen.getByTestId('agent-count-stepper')).toBeDefined();
    // Docker toggle
    expect(screen.getByText('Docker')).toBeDefined();
  });

  it('clicking coordination toggle updates store', () => {
    render(<ModeConfigBar />);
    expect(useModeStore.getState().coordinationMode).toBe('parallel');

    fireEvent.click(screen.getByText('Decomp'));
    expect(useModeStore.getState().coordinationMode).toBe('decomposition');

    fireEvent.click(screen.getByText('Parallel'));
    expect(useModeStore.getState().coordinationMode).toBe('parallel');
  });

  it('clicking agent mode toggle updates store', () => {
    render(<ModeConfigBar />);
    fireEvent.click(screen.getByText('Single'));
    expect(useModeStore.getState().agentMode).toBe('single');

    fireEvent.click(screen.getByText('Multi'));
    expect(useModeStore.getState().agentMode).toBe('multi');
  });

  it('clicking refinement toggle updates store', () => {
    render(<ModeConfigBar />);
    fireEvent.click(screen.getByText('Quick'));
    expect(useModeStore.getState().refinementEnabled).toBe(false);

    fireEvent.click(screen.getByText('Refine'));
    expect(useModeStore.getState().refinementEnabled).toBe(true);
  });

  it('execution lock dims controls', () => {
    useModeStore.getState().lock();
    render(<ModeConfigBar />);
    const bar = screen.getByTestId('mode-config-bar');
    expect(bar.className).toContain('opacity-50');
    expect(bar.className).toContain('pointer-events-none');
  });

  it('personas row hidden in decomposition mode', () => {
    render(<ModeConfigBar />);
    // In parallel mode, persona options should be visible
    expect(screen.getByTestId('personas-group')).toBeDefined();

    // Switch to decomposition
    fireEvent.click(screen.getByText('Decomp'));
    // Personas group should be hidden
    expect(screen.queryByTestId('personas-group')).toBeNull();
  });

  describe('agent count stepper', () => {
    it('clicking + increments agent count from null to 1', () => {
      render(<ModeConfigBar />);
      expect(useModeStore.getState().agentCount).toBeNull();

      fireEvent.click(screen.getByTestId('agent-count-increment'));
      expect(useModeStore.getState().agentCount).toBe(1);
    });

    it('clicking + increments count', () => {
      useModeStore.getState().setAgentCount(3);
      render(<ModeConfigBar />);

      fireEvent.click(screen.getByTestId('agent-count-increment'));
      expect(useModeStore.getState().agentCount).toBe(4);
    });

    it('clicking - at null stays null', () => {
      render(<ModeConfigBar />);
      expect(useModeStore.getState().agentCount).toBeNull();

      fireEvent.click(screen.getByTestId('agent-count-decrement'));
      expect(useModeStore.getState().agentCount).toBeNull();
    });

    it('clicking - at 1 goes to null', () => {
      useModeStore.getState().setAgentCount(1);
      render(<ModeConfigBar />);

      fireEvent.click(screen.getByTestId('agent-count-decrement'));
      expect(useModeStore.getState().agentCount).toBeNull();
    });

    it('shows "Config" when agentCount is null', () => {
      render(<ModeConfigBar />);
      expect(screen.getByTestId('agent-count-value').textContent).toBe('Config');
    });

    it('shows number when agentCount is set', () => {
      useModeStore.getState().setAgentCount(5);
      render(<ModeConfigBar />);
      expect(screen.getByTestId('agent-count-value').textContent).toBe('5');
    });
  });

  describe('agent chips', () => {
    it('shows "from config" when agentCount is null', () => {
      render(<ModeConfigBar />);
      expect(screen.getByText('from config')).toBeDefined();
    });

    it('agent chips appear when agentCount is set', () => {
      useModeStore.getState().setAgentCount(3);
      render(<ModeConfigBar />);
      expect(screen.getByTestId('agent-chip-0')).toBeDefined();
      expect(screen.getByTestId('agent-chip-1')).toBeDefined();
      expect(screen.getByTestId('agent-chip-2')).toBeDefined();
    });

    it('agent chips disappear when agentCount is null', () => {
      useModeStore.getState().setAgentCount(3);
      render(<ModeConfigBar />);
      expect(screen.getByTestId('agent-chip-0')).toBeDefined();

      // Set back to null
      useModeStore.getState().setAgentCount(null);
      // Re-render with updated state
      cleanup();
      render(<ModeConfigBar />);
      expect(screen.queryByTestId('agent-chip-0')).toBeNull();
      expect(screen.getByText('from config')).toBeDefined();
    });

    it('chips show default label when no config set', () => {
      useModeStore.getState().setAgentCount(2);
      render(<ModeConfigBar />);
      expect(screen.getByTestId('agent-chip-0').textContent).toBe('A: default');
      expect(screen.getByTestId('agent-chip-1').textContent).toBe('B: default');
    });

    it('chips show provider/model when config set', () => {
      useModeStore.getState().setAgentCount(2);
      useModeStore.getState().setAgentConfig(0, 'openai', 'gpt-4o');
      render(<ModeConfigBar />);
      expect(screen.getByTestId('agent-chip-0').textContent).toBe('A: openai/gpt-4o');
    });

    it('clicking agent chip opens popover', () => {
      useModeStore.getState().setAgentCount(2);
      // Seed providers so popover has content
      useModeStore.setState({
        providers: [
          { id: 'openai', name: 'OpenAI', models: [], default_model: 'gpt-4o', env_var: null, has_api_key: true, is_agent_framework: false, capabilities: [], notes: '' },
        ],
      });
      render(<ModeConfigBar />);

      fireEvent.click(screen.getByTestId('agent-chip-0'));
      expect(screen.getByTestId('agent-chip-popover')).toBeDefined();
    });
  });

  it('docker toggle changes store', () => {
    render(<ModeConfigBar />);
    const dockerBtn = screen.getByTestId('docker-toggle');
    fireEvent.click(dockerBtn);
    expect(useModeStore.getState().dockerEnabled).toBe(true);
  });
});
