import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../src/api/client'
import { LibraryPage } from '../src/pages/LibraryPage'
import type { Course } from '../src/types'

vi.mock('../src/api/client', () => ({ api: vi.fn() }))
vi.mock('../src/components/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Piero' } }) }))

const courses: Course[] = [
  {
    id: 'started', title: 'NestJS práctico', description: 'Backend profesional', published: true, sortOrder: 0,
    stats: { totalLessons: 2, completedLessons: 0, percent: 30 },
    sections: [{ id: 's1', title: 'Inicio', sortOrder: 0, lessons: [{ id: 'l1', title: 'API', description: '', s3Key: 'api.mp4', sortOrder: 0, durationSeconds: 100, progress: { lessonId: 'l1', positionSeconds: 30, maxPositionSeconds: 30, durationSeconds: 100, completed: false, completionMode: 'AUTO', lastWatchedAt: '2026-07-14T10:00:00Z' } }] }],
  },
  {
    id: 'done', title: 'React completo', description: 'Interfaces modernas', published: true, sortOrder: 1,
    stats: { totalLessons: 1, completedLessons: 1, percent: 100 },
    sections: [{ id: 's2', title: 'UI', sortOrder: 0, lessons: [{ id: 'l2', title: 'Componentes', description: '', s3Key: 'ui.mp4', sortOrder: 0, durationSeconds: 80, progress: { lessonId: 'l2', positionSeconds: 80, maxPositionSeconds: 80, durationSeconds: 80, completed: true, completionMode: 'AUTO', lastWatchedAt: '2026-07-13T10:00:00Z' } }] }],
  },
]

describe('LibraryPage', () => {
  it('busca y filtra cursos, incluyendo un estado sin resultados', async () => {
    vi.mocked(api).mockResolvedValue(courses as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><LibraryPage /></MemoryRouter></QueryClientProvider>)

    expect(await screen.findAllByText('NestJS práctico')).not.toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Completados' }))
    const catalog = screen.getByRole('region', { name: 'Todos tus cursos' })
    expect(within(catalog).getByText('React completo')).toBeInTheDocument()
    expect(within(catalog).queryByText('NestJS práctico')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar cursos' }), { target: { value: 'inexistente' } })
    expect(screen.getByText('No encontramos cursos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(within(catalog).getByText('React completo')).toBeInTheDocument()
  })
})
