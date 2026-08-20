import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackProvider, usePlayback } from '../src/context/PlaybackContext'
import type { Lesson } from '../src/types'

const control = vi.hoisted(() => ({ playing: true, mounts: 0, saves: 0, pauses: 0, closes: 0 }))

vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', role: 'ADMIN' }, loading: false }) }))
vi.mock('../src/components/VideoPlayer', async () => {
  const React = await import('react')
  function MockPersistentPlayer() {
    React.useEffect(() => { control.mounts += 1 }, [])
    return <div>Instancia persistente</div>
  }
  return { default: MockPersistentPlayer }
})

const lesson: Lesson = { id: 'lesson-1', title: 'Video uno', description: '', s3Key: 'videos/1.mp4', sortOrder: 0, durationSeconds: 60, progress: null }
const nextLesson: Lesson = { ...lesson, id: 'lesson-2', title: 'Video dos', s3Key: 'videos/2.mp4' }

function Harness() {
  const player = usePlayback()
  const navigate = useNavigate()
  useEffect(() => {
    player.registerController({
      save: () => { control.saves += 1 },
      pause: () => { control.pauses += 1 },
      close: async () => { control.closes += 1 },
      isPlaying: () => control.playing,
    })
    return () => player.registerController(null)
  }, [player])
  return <>
    <span data-testid="mode">{player.session ? player.mode : 'closed'}</span>
    <button onClick={() => player.openLesson({ courseId: 'course-1', courseTitle: 'Streaming', lesson, lessons: [lesson, nextLesson] })}>Abrir lección</button>
    <button onClick={player.minimize}>Minimizar</button>
    <button onClick={player.expand}>Expandir</button>
    <button onClick={() => { control.playing = false }}>Pausar estado</button>
    <button onClick={() => navigate('/')}>Ir a biblioteca</button>
    <button onClick={() => navigate('/admin')}>Ir a administración</button>
  </>
}

describe('PlaybackProvider', () => {
  beforeEach(() => Object.assign(control, { playing: true, mounts: 0, saves: 0, pauses: 0, closes: 0 }))

  it('mantiene una sola instancia y minimiza al navegar por la plataforma', async () => {
    render(<MemoryRouter initialEntries={['/curso/course-1/lesson-1']}><PlaybackProvider><Harness /></PlaybackProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lección' }))
    expect(await screen.findByText('Instancia persistente')).toBeInTheDocument()
    expect(screen.getByTestId('mode')).toHaveTextContent('expanded')

    fireEvent.click(screen.getByRole('button', { name: 'Ir a administración' }))
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('mini'))
    expect(control.mounts).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Expandir' }))
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('expanded'))
    expect(control.mounts).toBe(1)
  })

  it('guarda y cierra al abandonar una lección pausada sin minimización manual', async () => {
    render(<MemoryRouter initialEntries={['/curso/course-1/lesson-1']}><PlaybackProvider><Harness /></PlaybackProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lección' }))
    await screen.findByText('Instancia persistente')
    fireEvent.click(screen.getByRole('button', { name: 'Pausar estado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ir a biblioteca' }))
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('closed'))
    expect(control.saves).toBeGreaterThan(0)
    expect(control.pauses).toBeGreaterThan(0)
  })
})
