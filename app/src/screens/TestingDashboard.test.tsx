import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TestingDashboard } from './TestingDashboard'

describe('TestingDashboard component', () => {
  it('renders summary scorecard and fixtures table', () => {
    render(
      <MemoryRouter>
        <TestingDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByText('Testing & Fixtures Dashboard')).toBeDefined()
    const totalFixturesLabel = screen.getByText('Total Fixtures')
    expect(totalFixturesLabel).toBeDefined()
    expect(totalFixturesLabel.parentElement?.textContent).toContain('14')
    expect(screen.getByText('Automated Test Fixtures (14 Cases)')).toBeDefined()
    expect(screen.getByText('Normal speech')).toBeDefined()
    expect(screen.getByText('False emergency phrases')).toBeDefined()
    expect(screen.getByText('Manual SOS')).toBeDefined()
  })

  it('allows entering a custom utterance and displays interactive pipeline breakdown', () => {
    render(
      <MemoryRouter>
        <TestingDashboard />
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText(/Type any utterance/i)
    fireEvent.change(input, { target: { value: 'Help me with my assignment' } })

    expect(screen.getByText('Pipeline Evaluation:')).toBeDefined()
    expect(screen.getByText(/Model A \(Keyword\):/)).toBeDefined()
    expect(screen.getByText(/Model B \(Intent Classifier\):/)).toBeDefined()
    expect(screen.getByText(/Model C \(Risk Engine\):/)).toBeDefined()
  })
})
