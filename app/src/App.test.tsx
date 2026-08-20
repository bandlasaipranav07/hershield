import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the HerShield heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /hershield/i })).toBeInTheDocument()
  })

  it('always shows the DEMO/SIMULATION banner', () => {
    render(<App />)
    expect(screen.getByText(/DEMO \/ SIMULATION/i)).toBeInTheDocument()
  })
})