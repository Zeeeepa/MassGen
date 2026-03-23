import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useMessageStore } from '../../../stores/v2/messageStore'
import { TaskPlanPanel } from './TaskPlanPanel'

describe('TaskPlanPanel', () => {
  beforeEach(() => {
    useMessageStore.getState().reset()
    useMessageStore.setState({
      taskPlan: [
        {
          id: 'task-1',
          description: 'Build the first artifact',
          status: 'in_progress',
          priority: 'high',
        },
        {
          id: 'task-2',
          description: 'Verify the result',
          status: 'pending',
        },
      ],
    })
  })

  it('starts wider and lets the user drag-resize the panel', () => {
    render(<TaskPlanPanel />)

    const panel = screen.getByTestId('task-plan-panel')
    const handle = screen.getByTestId('task-plan-resize-handle')

    expect(panel).toHaveStyle({ width: '420px' })

    fireEvent.mouseDown(handle, { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 40 })
    fireEvent.mouseUp(window)

    expect(panel).toHaveStyle({ width: '480px' })
  })
})
