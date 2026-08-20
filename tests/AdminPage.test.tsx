import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../src/api/client'
import { AdminDashboardPage } from '../src/pages/AdminPage'

vi.mock('../src/api/client', () => ({ api: vi.fn(), ApiError: class ApiError extends Error {} }))

describe('AdminDashboardPage', () => {
  it('presenta Resumen como una página completa, sin pestañas internas', async () => {
    vi.mocked(api).mockImplementation(async path => path.endsWith('/aws-costs') ? { available: false, reason: 'NOT_AUTHORIZED', refreshedAt: '', stale: false } as never : {
      counts: { students: { total: 0, active: 0, activeLast7Days: 0 }, courses: { total: 0, published: 0 }, sections: 0, lessons: 0 },
      storage: { available: true, objectCount: 0, totalBytes: 0 },
      learning: { progressRecords: 0, completedRecords: 0, completionRate: 0, topCourses: [], recentActivity: [] },
    } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><AdminDashboardPage /></QueryClientProvider>)
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /contenido/i })).not.toBeInTheDocument()
    expect(await screen.findByText('Costos reales de AWS')).toBeInTheDocument()
  })
})
