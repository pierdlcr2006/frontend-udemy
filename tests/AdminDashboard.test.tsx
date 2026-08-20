import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../src/api/client'
import { AdminDashboard } from '../src/components/AdminDashboard'

vi.mock('../src/api/client', () => ({ api: vi.fn() }))

const summary = {
  counts: { students: { total: 5, active: 4, activeLast7Days: 2 }, courses: { total: 3, published: 2 }, sections: 6, lessons: 12 },
  storage: { available: true, objectCount: 12, totalBytes: 1_500_000_000 },
  learning: { progressRecords: 5, completedRecords: 3, completionRate: 60, topCourses: [], recentActivity: [] },
}

describe('AdminDashboard', () => {
  it('muestra métricas y costos reales por servicio', async () => {
    vi.mocked(api).mockImplementation(async path => path.endsWith('/aws-costs') ? {
      available: true, currency: 'USD', currentMonth: { amount: 1.25, estimated: true }, previousMonthAmount: 1,
      changePercent: 25, monthly: [{ month: '2026-07-01', amount: 1.25, estimated: true }], services: [{ name: 'Amazon Simple Storage Service', amount: 1.25 }],
      refreshedAt: '2026-07-14T12:00:00Z', stale: false,
    } as never : summary as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><AdminDashboard /></QueryClientProvider>)
    expect(await screen.findByText('Estudiantes activos')).toBeInTheDocument()
    expect(await screen.findByText('Amazon Simple Storage Service')).toBeInTheDocument()
    expect(screen.getAllByText(/USD.*1\.25/).length).toBeGreaterThan(0)
  })

  it('explica cuando falta autorización sin ocultar las métricas locales', async () => {
    vi.mocked(api).mockImplementation(async path => path.endsWith('/aws-costs') ? { available: false, reason: 'NOT_AUTHORIZED', refreshedAt: '', stale: false } as never : summary as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><AdminDashboard /></QueryClientProvider>)
    expect(await screen.findByText(/ce:GetCostAndUsage/)).toBeInTheDocument()
    expect(screen.getByText('Cursos publicados')).toBeInTheDocument()
  })
})
