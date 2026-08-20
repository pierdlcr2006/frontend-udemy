import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../src/api/client'
import { CoursePage } from '../src/pages/CoursePage'
import type { Course } from '../src/types'

vi.mock('../src/api/client', () => ({ api: vi.fn() }))
const playback = vi.hoisted(() => ({ openLesson: vi.fn() }))
vi.mock('../src/context/PlaybackContext', () => ({
  PlayerViewport: () => <div>Reproductor global</div>,
  usePlayback: () => ({ openLesson: playback.openLesson }),
}))

const course: Course = {
  id: 'course-1', title: 'Streaming', description: '', published: true, sortOrder: 0,
  stats: { totalLessons: 2, completedLessons: 0, percent: 0 },
  sections: [
    { id: 'section-1', title: 'Fundamentos', sortOrder: 0, lessons: [{ id: 'lesson-1', title: 'Video uno', description: '', s3Key: 'videos/1.mp4', sortOrder: 0, durationSeconds: 60, progress: null }] },
    { id: 'section-2', title: 'Práctica', sortOrder: 1, lessons: [{ id: 'lesson-2', title: 'Video dos', description: '', s3Key: 'videos/2.mp4', sortOrder: 0, durationSeconds: 60, progress: null }] },
  ],
}

describe('CoursePage accordion', () => {
  it('abre la sección actual, cierra la anterior y permite contraerla', async () => {
    playback.openLesson.mockClear()
    vi.mocked(api).mockResolvedValue(course as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/curso/course-1/lesson-2']}><Routes><Route path="/curso/:courseId/:lessonId?" element={<CoursePage />} /></Routes></MemoryRouter></QueryClientProvider>)

    const fundamentos = await screen.findByRole('button', { name: /fundamentos/i })
    const practica = screen.getByRole('button', { name: /práctica/i })
    expect(practica).toHaveAttribute('aria-expanded', 'true')
    expect(fundamentos).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByText('Video dos')[0]).toBeVisible()

    fireEvent.click(fundamentos)
    expect(fundamentos).toHaveAttribute('aria-expanded', 'true')
    expect(practica).toHaveAttribute('aria-expanded', 'false')
    const firstPanel = document.getElementById(fundamentos.getAttribute('aria-controls')!)!
    fireEvent.click(within(firstPanel).getByRole('button', { name: /video uno/i }))
    await waitFor(() => expect(playback.openLesson).toHaveBeenLastCalledWith(expect.objectContaining({ lesson: expect.objectContaining({ id: 'lesson-1' }) })))

    fireEvent.click(fundamentos)
    expect(fundamentos).toHaveAttribute('aria-expanded', 'false')
  })
})
