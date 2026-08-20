/* eslint-disable react-refresh/only-export-components */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Lesson } from '../types'
import { useAuth } from './AuthContext'

const PersistentVideoPlayer = lazy(() => import('../components/VideoPlayer'))

export type PlaybackMode = 'expanded' | 'mini'

export interface PlaybackSession {
  courseId: string
  courseTitle: string
  lesson: Lesson
  lessons: Lesson[]
}

export interface PlaybackController {
  save: (force?: boolean) => void
  pause: () => void
  close: () => Promise<void>
  isPlaying: () => boolean
}

interface PlaybackValue {
  session: PlaybackSession | null
  mode: PlaybackMode
  viewport: HTMLElement | null
  openLesson: (session: PlaybackSession) => void
  minimize: () => void
  expand: () => void
  playNext: () => boolean
  close: () => void
  setViewport: (element: HTMLElement | null) => void
  registerController: (controller: PlaybackController | null) => void
}

const PlaybackContext = createContext<PlaybackValue | null>(null)

export function PlaybackProvider({ children }: PropsWithChildren) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState<PlaybackSession | null>(null)
  const [mode, setMode] = useState<PlaybackMode>('expanded')
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const sessionRef = useRef<PlaybackSession | null>(null)
  const modeRef = useRef<PlaybackMode>('expanded')
  const previousPathRef = useRef(location.pathname)
  const manuallyMinimizedRef = useRef(false)
  const controllerRef = useRef<PlaybackController | null>(null)

  const changeMode = useCallback((next: PlaybackMode) => {
    modeRef.current = next
    setMode(next)
  }, [])

  const clearSession = useCallback(async () => {
    const controller = controllerRef.current
    controller?.save(true)
    controller?.pause()
    await controller?.close().catch(() => undefined)
    manuallyMinimizedRef.current = false
    sessionRef.current = null
    setSession(null)
    changeMode('expanded')
  }, [changeMode])

  const openLesson = useCallback((next: PlaybackSession) => {
    const changed = sessionRef.current?.lesson.id !== next.lesson.id
    if (changed) {
      controllerRef.current?.save(true)
      manuallyMinimizedRef.current = false
      changeMode('expanded')
    }
    sessionRef.current = next
    setSession(next)
  }, [changeMode])

  const minimize = useCallback(() => {
    if (!sessionRef.current) return
    manuallyMinimizedRef.current = true
    changeMode('mini')
  }, [changeMode])

  const expand = useCallback(() => {
    const current = sessionRef.current
    if (!current) return
    manuallyMinimizedRef.current = false
    changeMode('expanded')
    navigate(`/curso/${current.courseId}/${current.lesson.id}`)
  }, [changeMode, navigate])

  const playNext = useCallback(() => {
    const current = sessionRef.current
    if (!current) return false
    const currentIndex = current.lessons.findIndex(lesson => lesson.id === current.lesson.id)
    const nextLesson = currentIndex >= 0 ? current.lessons[currentIndex + 1] : undefined
    if (!nextLesson) return false
    controllerRef.current?.save(true)
    const nextSession = { ...current, lesson: nextLesson }
    sessionRef.current = nextSession
    setSession(nextSession)
    if (modeRef.current === 'expanded') navigate(`/curso/${current.courseId}/${nextLesson.id}`)
    return true
  }, [navigate])

  const close = useCallback(() => {
    void clearSession()
  }, [clearSession])

  const registerController = useCallback((controller: PlaybackController | null) => {
    controllerRef.current = controller
  }, [])

  useEffect(() => {
    const previousPath = previousPathRef.current
    previousPathRef.current = location.pathname
    if (!sessionRef.current) return
    const isCourseRoute = location.pathname.startsWith('/curso/')
    if (isCourseRoute) {
      const enteredCourse = !previousPath.startsWith('/curso/')
      if (enteredCourse) manuallyMinimizedRef.current = false
      if ((enteredCourse || !manuallyMinimizedRef.current) && modeRef.current === 'mini') changeMode('expanded')
      return
    }
    if (modeRef.current !== 'expanded') return
    if (controllerRef.current?.isPlaying()) changeMode('mini')
    else void clearSession()
  }, [changeMode, clearSession, location.pathname])

  useEffect(() => {
    if (!loading && !user && sessionRef.current) void clearSession()
  }, [clearSession, loading, user])

  const value = useMemo<PlaybackValue>(() => ({
    session,
    mode,
    viewport,
    openLesson,
    minimize,
    expand,
    playNext,
    close,
    setViewport,
    registerController,
  }), [close, expand, minimize, mode, openLesson, playNext, registerController, session, viewport])

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {session && <Suspense fallback={null}><PersistentVideoPlayer /></Suspense>}
    </PlaybackContext.Provider>
  )
}

export function usePlayback() {
  const value = useContext(PlaybackContext)
  if (!value) throw new Error('usePlayback debe usarse dentro de PlaybackProvider')
  return value
}

export function PlayerViewport() {
  const { setViewport } = usePlayback()
  return <div ref={setViewport} className="video-stage persistent-player-viewport" aria-hidden="true" />
}
