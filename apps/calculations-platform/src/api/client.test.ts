import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkApiHealth } from './client'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    }),
  },
}))

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export fetchTemplates function', async () => {
    const { fetchTemplates } = await import('./client')
    expect(typeof fetchTemplates).toBe('function')
  })

  it('should export fetchTemplate function', async () => {
    const { fetchTemplate } = await import('./client')
    expect(typeof fetchTemplate).toBe('function')
  })

  it('should export executeCalculation function', async () => {
    const { executeCalculation } = await import('./client')
    expect(typeof executeCalculation).toBe('function')
  })

  it('should export validateCalculation function', async () => {
    const { validateCalculation } = await import('./client')
    expect(typeof validateCalculation).toBe('function')
  })

  it('should export checkApiHealth function', async () => {
    expect(typeof checkApiHealth).toBe('function')
  })
})
