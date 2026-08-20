/* eslint-disable react-refresh/only-export-components */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  type MediaPlayerInstance,
} from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
  type DefaultLayoutTranslations,
} from '@vidstack/react/player/layouts/default'
import { Maximize2, Minimize2, Move, Pause, Play, RefreshCcw, SkipForward, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Draggable, { type DraggableData, type DraggableEvent } from 'react-draggable'
import { api } from '../api/client'
import { usePlayback, type PlaybackController, type PlaybackSession } from '../context/PlaybackContext'
import { formatDuration } from '../utils/format'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import '../video-player.css'

type PlayerPreferences = { muted: boolean; volume: number; playbackRate: number }
type ThumbnailImageInit = { url: string; startTime: number; endTime?: number; width?: number; height?: number; coords?: { x: number; y: number } }
type ThumbnailBlocks = {
  tileWidth: number
  tileHeight: number
  interval: number
  count: number
  columns: number
  blocks: Array<{ url: string; startIndex: number; count: number }>
}
type PreviewResponse =
  | { status: 'PROCESSING' }
  | { status: 'UNAVAILABLE' }
  | { status: 'READY'; posterUrl: string; thumbnails: ThumbnailBlocks; expiresAt: string }
type ReadyPreview = Extract<PreviewResponse, { status: 'READY' }>
type Position = { x: number; y: number }
type AnchorRect = { left: number; top: number; width: number; height: number }

const PREFERENCES_KEY = 'aula-stream-player-preferences'
const MINI_POSITION_KEY = 'aula-stream-miniplayer-position'
const DEFAULT_PREFERENCES: PlayerPreferences = { muted: true, volume: 1, playbackRate: 1 }

const SPANISH = {
  Accessibility: 'Accesibilidad',
  Captions: 'Subtítulos',
  Continue: 'Continuar',
  Disabled: 'Desactivado',
  Fullscreen: 'Pantalla completa',
  Mute: 'Silenciar',
  Normal: 'Normal',
  Off: 'Desactivado',
  Pause: 'Pausar',
  PiP: 'Imagen en imagen',
  Play: 'Reproducir',
  Playback: 'Reproducción',
  Quality: 'Calidad',
  Replay: 'Repetir',
  Reset: 'Restablecer',
  Seek: 'Buscar',
  'Seek Backward': 'Retroceder',
  'Seek Forward': 'Adelantar',
  Settings: 'Configuración',
  Speed: 'Velocidad',
  Unmute: 'Activar sonido',
  Volume: 'Volumen',
} satisfies Partial<DefaultLayoutTranslations>

function loadPreferences() {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '') as Partial<PlayerPreferences>
    return {
      muted: typeof stored.muted === 'boolean' ? stored.muted : true,
      volume: typeof stored.volume === 'number' ? Math.min(1, Math.max(0, stored.volume)) : 1,
      playbackRate: typeof stored.playbackRate === 'number' ? stored.playbackRate : 1,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function loadMiniPosition(): Position | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = JSON.parse(window.localStorage.getItem(MINI_POSITION_KEY) ?? '') as Partial<Position>
    return typeof stored.x === 'number' && typeof stored.y === 'number' ? { x: stored.x, y: stored.y } : null
  } catch {
    return null
  }
}

function isReadyPreview(value: PreviewResponse | undefined): value is ReadyPreview {
  return value?.status === 'READY'
}

export function blocksToThumbnails(source: ThumbnailBlocks): ThumbnailImageInit[] {
  return source.blocks.flatMap(block => Array.from({ length: block.count }, (_, localIndex) => {
    const index = block.startIndex + localIndex
    return {
      url: block.url,
      startTime: index * source.interval,
      endTime: Math.min(source.count, index + 1) * source.interval,
      width: source.tileWidth,
      height: source.tileHeight,
      coords: {
        x: (localIndex % source.columns) * source.tileWidth,
        y: Math.floor(localIndex / source.columns) * source.tileHeight,
      },
    }
  }))
}

function clampPosition(position: Position, element: HTMLElement | null): Position {
  if (!element || typeof window === 'undefined') return position
  const width = element.offsetWidth
  const height = element.offsetHeight
  return {
    x: Math.min(Math.max(12, position.x), Math.max(12, window.innerWidth - width - 12)),
    y: Math.min(Math.max(12, position.y), Math.max(12, window.innerHeight - height - 12)),
  }
}

function defaultMiniPosition(element: HTMLElement | null): Position {
  if (!element || typeof window === 'undefined') return { x: 12, y: 12 }
  const width = element.offsetWidth
  const height = element.offsetHeight
  let y = window.innerHeight - height - 20
  const uploadCenter = document.querySelector<HTMLElement>('.upload-center')
  if (uploadCenter) {
    const uploadRect = uploadCenter.getBoundingClientRect()
    const candidateLeft = window.innerWidth - width - 22
    if (candidateLeft < uploadRect.right && window.innerWidth - 22 > uploadRect.left) y = uploadRect.top - height - 12
  }
  return clampPosition({ x: window.innerWidth - width - 22, y }, element)
}

function dragBoundsFor(element: HTMLElement | null) {
  if (!element || typeof window === 'undefined') return undefined
  return {
    left: 12,
    top: 12,
    right: Math.max(12, window.innerWidth - element.offsetWidth - 12),
    bottom: Math.max(12, window.innerHeight - element.offsetHeight - 12),
  }
}

export function PersistentVideoPlayer() {
  const { session } = usePlayback()
  if (!session) return null
  return <PersistentVideoPlayerSession key={session.lesson.id} session={session} />
}

function PersistentVideoPlayerSession({ session }: { session: PlaybackSession }) {
  const { mode, viewport, minimize, expand, playNext, close, registerController } = usePlayback()
  const { lesson, courseId, courseTitle } = session
  const currentLessonIndex = session.lessons.findIndex(item => item.id === lesson.id)
  const nextLesson = currentLessonIndex >= 0 ? session.lessons[currentLessonIndex + 1] : undefined
  const playerRef = useRef<MediaPlayerInstance>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const lastSavedRef = useRef(lesson.progress?.positionSeconds ?? 0)
  const restoredRef = useRef(false)
  const pendingRestoreRef = useRef<number | null>(null)
  const playingRef = useRef(false)
  const storedMiniPositionRef = useRef(loadMiniPosition())
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const [miniPosition, setMiniPosition] = useState<Position | null>(null)
  const [dragBounds, setDragBounds] = useState<ReturnType<typeof dragBoundsFor>>()
  const [playbackError, setPlaybackError] = useState('')
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [showSoundHint, setShowSoundHint] = useState(() => loadPreferences().muted)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(lesson.progress?.positionSeconds ?? 0)
  const [duration, setDuration] = useState(lesson.durationSeconds ?? 0)
  const [nextDeadline, setNextDeadline] = useState<number | null>(null)
  const [nextRemaining, setNextRemaining] = useState(5_000)
  const queryClient = useQueryClient()

  const playback = useQuery({
    queryKey: ['playback', lesson.id],
    queryFn: () => api<{ url: string; expiresAt: string }>(`/lessons/${lesson.id}/playback`),
    staleTime: 3.5 * 60 * 60 * 1000,
    retry: 1,
  })
  const preview = useQuery({
    queryKey: ['preview', lesson.id],
    queryFn: () => api<PreviewResponse>(`/lessons/${lesson.id}/preview`),
    staleTime: 3.5 * 60 * 60 * 1000,
    retry: false,
    refetchInterval: query => query.state.data?.status === 'PROCESSING' ? 5_000 : false,
  })
  const refreshPlayback = playback.refetch
  const refreshPreview = preview.refetch
  const previewExpiresAt = isReadyPreview(preview.data) ? preview.data.expiresAt : undefined

  const progress = useMutation({
    mutationFn: (payload: { positionSeconds: number; durationSeconds: number }) =>
      api(`/progress/${lesson.id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
      ])
    },
  })

  const save = useCallback((force = false) => {
    const player = playerRef.current
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return
    if (!force && Math.abs(player.currentTime - lastSavedRef.current) < 10) return
    lastSavedRef.current = player.currentTime
    progress.mutate({ positionSeconds: player.currentTime, durationSeconds: player.duration })
  }, [progress])
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save }, [save])

  const persistPreferences = useCallback((patch: Partial<PlayerPreferences>) => {
    setPreferences(current => {
      const next = { ...current, ...patch }
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    const controller: PlaybackController = {
      save,
      pause: () => playerRef.current?.pause(),
      isPlaying: () => playingRef.current,
      close: async () => {
        try { await playerRef.current?.exitPictureInPicture() } catch { /* PiP was not active or supported. */ }
      },
    }
    registerController(controller)
    return () => registerController(null)
  }, [registerController, save])

  useEffect(() => () => saveRef.current(true), [])

  useEffect(() => {
    if (!playback.data?.expiresAt) return
    const refreshIn = Math.max(30_000, new Date(playback.data.expiresAt).getTime() - Date.now() - 60_000)
    const timer = window.setTimeout(() => refreshPlayback(), refreshIn)
    return () => window.clearTimeout(timer)
  }, [playback.data?.expiresAt, refreshPlayback])

  useEffect(() => {
    if (!previewExpiresAt) return
    const refreshIn = Math.max(30_000, new Date(previewExpiresAt).getTime() - Date.now() - 60_000)
    const timer = window.setTimeout(() => refreshPreview(), refreshIn)
    return () => window.clearTimeout(timer)
  }, [previewExpiresAt, refreshPreview])

  useEffect(() => {
    if (nextDeadline === null) return
    const tick = () => setNextRemaining(Math.max(0, nextDeadline - Date.now()))
    tick()
    const interval = window.setInterval(tick, 100)
    const timeout = window.setTimeout(() => {
      setNextDeadline(null)
      playNext()
    }, Math.max(0, nextDeadline - Date.now()))
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [nextDeadline, playNext])

  useLayoutEffect(() => {
    if (mode !== 'expanded' || !viewport) return
    const measure = () => {
      const rect = viewport.getBoundingClientRect()
      setAnchorRect({ left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [mode, viewport])

  useLayoutEffect(() => {
    if (mode !== 'mini' || !hostRef.current) return
    const initial = storedMiniPositionRef.current ?? defaultMiniPosition(hostRef.current)
    const next = clampPosition(initial, hostRef.current)
    setMiniPosition(next)
    setDragBounds(dragBoundsFor(hostRef.current))
    const onResize = () => {
      setMiniPosition(current => clampPosition(current ?? defaultMiniPosition(hostRef.current), hostRef.current))
      setDragBounds(dragBoundsFor(hostRef.current))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode])

  const restorePosition = () => {
    const player = playerRef.current
    if (!player || restoredRef.current) return
    const saved = pendingRestoreRef.current ?? lesson.progress?.positionSeconds ?? 0
    if (saved > 0 && saved < player.duration - 2) player.currentTime = saved
    pendingRestoreRef.current = null
    restoredRef.current = true
    setDuration(player.duration)
    setCurrentTime(player.currentTime)
  }

  const retryPlayback = async () => {
    pendingRestoreRef.current = playerRef.current?.currentTime ?? lastSavedRef.current
    restoredRef.current = false
    const result = await playback.refetch()
    if (result.data) {
      setPlaybackError('')
      setAutoplayBlocked(false)
    }
  }

  const retryAutoplay = async () => {
    const player = playerRef.current
    if (!player) return
    try {
      await player.play()
      setAutoplayBlocked(false)
    } catch {
      player.muted = true
      persistPreferences({ muted: true })
      await player.play().catch(() => undefined)
      setAutoplayBlocked(false)
      setShowSoundHint(true)
    }
  }

  const fallbackToMutedAutoplay = async () => {
    const player = playerRef.current
    if (!player) {
      setAutoplayBlocked(true)
      return
    }
    player.muted = true
    persistPreferences({ muted: true })
    try {
      await player.play()
      setAutoplayBlocked(false)
      setShowSoundHint(true)
    } catch {
      setAutoplayBlocked(true)
    }
  }

  const activateSound = () => {
    const player = playerRef.current
    if (!player) return
    player.volume = preferences.volume || 1
    player.muted = false
    persistPreferences({ muted: false, volume: player.volume })
    setShowSoundHint(false)
    void player.play()
  }

  const togglePlayback = () => {
    const player = playerRef.current
    if (!player) return
    if (playingRef.current) player.pause()
    else void player.play().catch(() => setAutoplayBlocked(true))
  }

  const startNextCountdown = () => {
    playingRef.current = false
    setPlaying(false)
    save(true)
    if (!nextLesson) return
    setNextRemaining(5_000)
    setNextDeadline(Date.now() + 5_000)
  }

  const advanceNow = () => {
    setNextDeadline(null)
    playNext()
  }

  const persistMiniPosition = (position: Position) => {
    storedMiniPositionRef.current = position
    window.localStorage.setItem(MINI_POSITION_KEY, JSON.stringify(position))
  }

  const onDrag = (_event: DraggableEvent, data: DraggableData) => setMiniPosition({ x: data.x, y: data.y })
  const onDragStop = (_event: DraggableEvent, data: DraggableData) => {
    const next = clampPosition({ x: data.x, y: data.y }, hostRef.current)
    setMiniPosition(next)
    persistMiniPosition(next)
  }

  const onMoveKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const movement = event.shiftKey ? 48 : 16
    const delta = event.key === 'ArrowLeft' ? { x: -movement, y: 0 }
      : event.key === 'ArrowRight' ? { x: movement, y: 0 }
        : event.key === 'ArrowUp' ? { x: 0, y: -movement }
          : event.key === 'ArrowDown' ? { x: 0, y: movement } : null
    if (!delta) return
    event.preventDefault()
    const current = miniPosition ?? defaultMiniPosition(hostRef.current)
    const next = clampPosition({ x: current.x + delta.x, y: current.y + delta.y }, hostRef.current)
    setMiniPosition(next)
    persistMiniPosition(next)
  }

  const readyPreview = isReadyPreview(preview.data) ? preview.data : undefined
  const thumbnails = useMemo(() => readyPreview ? blocksToThumbnails(readyPreview.thumbnails) : undefined, [readyPreview])
  const expandedStyle: CSSProperties | undefined = mode === 'expanded' && anchorRect ? {
    position: 'absolute',
    left: anchorRect.left,
    top: anchorRect.top,
    width: anchorRect.width,
    height: anchorRect.height,
  } : undefined
  const countdownProgress = Math.min(1, Math.max(0, (5_000 - nextRemaining) / 5_000))
  const countdownCircumference = 2 * Math.PI * 38
  return (
    <Draggable
      nodeRef={hostRef}
      disabled={mode !== 'mini'}
      handle=".mini-player-drag-handle"
      cancel=".mini-player-actions"
      position={mode === 'mini' ? (miniPosition ?? { x: 0, y: 0 }) : { x: 0, y: 0 }}
      bounds={dragBounds}
      onDrag={onDrag}
      onStop={onDragStop}
    >
      <aside
        ref={hostRef}
        className={`persistent-player-host ${mode}${(mode === 'expanded' && !anchorRect) || (mode === 'mini' && !miniPosition) ? ' positioning' : ''}`}
        style={expandedStyle}
        aria-label={mode === 'mini' ? `Reproductor flotante: ${lesson.title}` : undefined}
      >
        {mode === 'mini' && <div className="mini-player-drag-handle" tabIndex={0} onKeyDown={onMoveKeyDown} aria-label="Mover reproductor flotante con las flechas">
          <Move size={15} aria-hidden="true" />
          <span><strong>{lesson.title}</strong><small>{courseTitle}</small></span>
          <div className="mini-player-actions">
            <button type="button" onClick={expand} aria-label="Expandir reproductor"><Maximize2 /></button>
            <button type="button" onClick={close} aria-label="Cerrar reproductor"><X /></button>
          </div>
        </div>}

        <div className="video-stage vidstack-stage">
          {playback.isLoading ? <div className="persistent-player-loading"><span className="loader" /><strong>Preparando lección…</strong></div> : playback.isError || !playback.data ? <div className="persistent-player-loading error"><strong>No pudimos preparar este video</strong><button onClick={() => playback.refetch()}><RefreshCcw size={16} /> Reintentar</button></div> : <>
            <MediaPlayer
              ref={playerRef}
              className="aula-media-player"
              title={lesson.title}
              src={{ src: playback.data.url, type: 'video/mp4' }}
              poster={readyPreview?.posterUrl}
              duration={lesson.durationSeconds ?? undefined}
              streamType="on-demand"
              load="eager"
              posterLoad="eager"
              autoPlay
              muted={preferences.muted}
              volume={preferences.volume}
              playbackRate={preferences.playbackRate}
              playsInline
              crossOrigin
              onCanPlay={restorePosition}
              onPlay={() => { playingRef.current = true; setPlaying(true) }}
              onPause={() => { playingRef.current = false; setPlaying(false); save(true) }}
              onTimeUpdate={() => {
                setCurrentTime(playerRef.current?.currentTime ?? 0)
                setDuration(playerRef.current?.duration ?? duration)
                save(false)
              }}
              onEnded={startNextCountdown}
              onError={() => setPlaybackError('La conexión con el video se interrumpió.')}
              onAutoPlay={() => setAutoplayBlocked(false)}
              onAutoPlayFail={() => void fallbackToMutedAutoplay()}
              onVolumeChange={detail => {
                persistPreferences({ muted: detail.muted, volume: detail.volume })
                if (!detail.muted) setShowSoundHint(false)
              }}
              onRateChange={rate => persistPreferences({ playbackRate: rate })}
            >
              <MediaProvider><Poster className="aula-player-poster" src={readyPreview?.posterUrl} alt={`Vista previa de ${lesson.title}`} /></MediaProvider>
              {mode === 'expanded' && <DefaultVideoLayout icons={defaultLayoutIcons} thumbnails={thumbnails} translations={SPANISH} seekStep={10} colorScheme="dark" />}
            </MediaPlayer>

            {mode === 'expanded' && <button type="button" className="player-minimize-button" onClick={minimize}><Minimize2 /> Minimizar</button>}
            {mode === 'mini' && <div className="mini-player-controls">
              <button type="button" onClick={togglePlayback} aria-label={playing ? 'Pausar' : 'Reproducir'}>{playing ? <Pause /> : <Play />}</button>
              <input aria-label="Progreso del video" type="range" min="0" max={Math.max(duration, 1)} step="0.1" value={Math.min(currentTime, Math.max(duration, 1))} onChange={event => {
                const next = Number(event.target.value)
                if (playerRef.current) playerRef.current.currentTime = next
                setCurrentTime(next)
              }} />
              <span>{formatDuration(currentTime)} / {formatDuration(duration)}</span>
              <button type="button" onClick={expand} aria-label="Volver a la lección"><Maximize2 /></button>
            </div>}

            {preview.data?.status === 'PROCESSING' && mode === 'expanded' && <span className="preview-processing"><span className="loader small" /> Preparando previsualizaciones</span>}
            {showSoundHint && !autoplayBlocked && <button className="sound-hint" onClick={activateSound}><Volume2 size={18} /> Activar sonido</button>}
            {autoplayBlocked && <div className="autoplay-overlay"><button onClick={retryAutoplay}><span>▶</span><strong>Reproducir lección</strong><small>El navegador necesita tu permiso para iniciar.</small></button></div>}
            {playbackError && <div className="video-reconnect"><span>{playbackError}</span><button onClick={retryPlayback}><RefreshCcw size={16} /> Renovar enlace</button></div>}
            {nextDeadline !== null && nextLesson && <div className="next-lesson-overlay" role="dialog" aria-label={`Siguiente lección: ${nextLesson.title}`}>
              <button type="button" className="next-countdown-button" onClick={advanceNow} aria-label={`Reproducir ahora ${nextLesson.title}`}>
                <svg viewBox="0 0 92 92" aria-hidden="true">
                  <circle className="next-countdown-track" cx="46" cy="46" r="38" />
                  <circle className="next-countdown-progress" cx="46" cy="46" r="38" style={{ strokeDasharray: countdownCircumference, strokeDashoffset: countdownCircumference * (1 - countdownProgress) }} />
                </svg>
                <span><SkipForward /><strong>{Math.max(1, Math.ceil(nextRemaining / 1_000))}</strong></span>
              </button>
              <div><span>Siguiente lección</span><strong>{nextLesson.title}</strong><small>Reproducción automática en {Math.max(1, Math.ceil(nextRemaining / 1_000))} segundos · haz clic para continuar ahora</small></div>
            </div>}
          </>}
        </div>
      </aside>
    </Draggable>
  )
}

export default PersistentVideoPlayer
