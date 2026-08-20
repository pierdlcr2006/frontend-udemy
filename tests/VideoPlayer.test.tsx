import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api/client'
import { blocksToThumbnails, PersistentVideoPlayer } from '../src/components/VideoPlayer'
import type { Lesson } from '../src/types'

vi.mock('../src/api/client', () => ({ api: vi.fn() }))
vi.mock('react-draggable', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))

const media = vi.hoisted(() => ({
  instance: undefined as undefined | { currentTime: number; duration: number; muted: boolean; volume: number; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; exitPictureInPicture: ReturnType<typeof vi.fn> },
}))

const playback = vi.hoisted(() => ({
  value: undefined as unknown as Record<string, unknown>,
}))

vi.mock('../src/context/PlaybackContext', () => ({ usePlayback: () => playback.value }))

vi.mock('@vidstack/react', async () => {
  const React = await import('react')
  type PlayerProps = { autoPlay?: boolean; muted?: boolean; volume?: number; onCanPlay?: () => void; onEnded?: () => void; children?: React.ReactNode }
  const MediaPlayer = React.forwardRef((props: PlayerProps, ref: React.ForwardedRef<unknown>) => {
    const instance = React.useMemo(() => ({ currentTime: 0, duration: 120, muted: props.muted ?? true, volume: props.volume ?? 1, play: vi.fn(async () => undefined), pause: vi.fn(), exitPictureInPicture: vi.fn(async () => undefined) }), [props.muted, props.volume])
    media.instance = instance
    React.useImperativeHandle(ref, () => instance)
    return <div data-testid="media-player" data-autoplay={String(props.autoPlay)}><button onClick={props.onCanPlay}>Simular video listo</button><button onClick={props.onEnded}>Simular final</button>{props.children}</div>
  })
  return {
    MediaPlayer,
    MediaProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Poster: ({ src, alt }: { src?: string; alt?: string }) => src ? <img src={src} alt={alt} /> : null,
  }
})

vi.mock('@vidstack/react/player/layouts/default', () => ({
  DefaultVideoLayout: ({ thumbnails }: { thumbnails?: Array<{ url: string }> }) => <div data-testid="player-controls" data-count={thumbnails?.length ?? 0} data-urls={thumbnails?.map(item => item.url).join(',')} />,
  defaultLayoutIcons: {},
}))

const lesson: Lesson = {
  id: 'lesson-1', title: 'Fundamentos del streaming', description: '', s3Key: 'videos/fundamentos.mp4',
  sortOrder: 0, durationSeconds: 120,
  progress: { lessonId: 'lesson-1', positionSeconds: 42, maxPositionSeconds: 110, durationSeconds: 120, completed: true, completionMode: 'AUTO', lastWatchedAt: new Date().toISOString() },
}
const nextLesson: Lesson = { ...lesson, id: 'lesson-2', title: 'Siguiente nivel', progress: null }

describe('PersistentVideoPlayer', () => {
  beforeEach(() => {
    window.localStorage.clear()
    playback.value = {
      session: { courseId: 'course-1', courseTitle: 'Streaming', lesson, lessons: [lesson, nextLesson] },
      mode: 'expanded', viewport: null,
      minimize: vi.fn(), expand: vi.fn(), playNext: vi.fn(), close: vi.fn(), registerController: vi.fn(),
    }
    vi.mocked(api).mockImplementation(async path => {
      if (path.includes('/playback')) return { url: 'https://example.test/video.mp4', expiresAt: new Date(Date.now() + 60_000).toISOString() } as never
      if (path.includes('/preview')) return {
        status: 'READY', posterUrl: 'https://example.test/poster.jpg', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        thumbnails: { tileWidth: 240, tileHeight: 135, interval: 5, count: 12, columns: 5, blocks: [{ url: 'https://example.test/0.jpg', startIndex: 0, count: 10 }, { url: 'https://example.test/1.jpg', startIndex: 10, count: 2 }] },
      } as never
      return { success: true } as never
    })
  })

  it('activa autoplay, restaura la posición y entrega previews segmentados a Vidstack', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><PersistentVideoPlayer /></QueryClientProvider>)
    expect(await screen.findByTestId('media-player')).toHaveAttribute('data-autoplay', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Simular video listo' }))
    expect(media.instance?.currentTime).toBe(42)
    await waitFor(() => expect(screen.getByTestId('player-controls')).toHaveAttribute('data-count', '12'))
    expect(screen.getByTestId('player-controls')).toHaveAttribute('data-urls', expect.stringContaining('0.jpg,https://example.test/1.jpg'))
    expect(screen.getByRole('img', { name: /vista previa/i })).toHaveAttribute('src', 'https://example.test/poster.jpg')
  })

  it('convierte cada bloque en coordenadas locales sin unir todos los sprites', () => {
    const result = blocksToThumbnails({ tileWidth: 240, tileHeight: 135, interval: 5, count: 12, columns: 5, blocks: [{ url: 'block-0.jpg', startIndex: 0, count: 10 }, { url: 'block-1.jpg', startIndex: 10, count: 2 }] })
    expect(result).toHaveLength(12)
    expect(result[9]).toMatchObject({ url: 'block-0.jpg', startTime: 45, coords: { x: 960, y: 135 } })
    expect(result[10]).toMatchObject({ url: 'block-1.jpg', startTime: 50, coords: { x: 0, y: 0 } })
  })

  it('muestra el modo flotante y guarda su posición al moverlo con teclado', async () => {
    const close = vi.fn()
    playback.value = { ...playback.value, mode: 'mini', close }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><PersistentVideoPlayer /></QueryClientProvider>)
    const handle = await screen.findByLabelText(/mover reproductor flotante/i)
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    await waitFor(() => expect(window.localStorage.getItem('aula-stream-miniplayer-position')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /cerrar reproductor/i }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('permite adelantar y también reproduce automáticamente la siguiente lección tras cinco segundos', async () => {
    const playNext = vi.fn()
    playback.value = { ...playback.value, playNext }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><PersistentVideoPlayer /></QueryClientProvider>)
    await screen.findByTestId('media-player')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Simular final' }))
    fireEvent.click(screen.getByRole('button', { name: /reproducir ahora siguiente nivel/i }))
    expect(playNext).toHaveBeenCalledOnce()
    playNext.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Simular final' }))
    act(() => vi.advanceTimersByTime(5_000))
    expect(playNext).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})
