/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, ChevronDown, ChevronUp, FileVideo, RotateCcw, Trash2, UploadCloud } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { api } from '../api/client'
import { uploadToSignedUrl } from '../api/upload'
import { formatBytes } from '../utils/format'

export const MAX_CONCURRENT_UPLOADS = 4

export type UploadTaskState = 'queued' | 'uploading' | 'registering' | 'done' | 'error'

export interface UploadTask {
  id: string
  file: File
  title: string
  sectionId: string
  sortOrder: number
  state: UploadTaskState
  progress: number
  error?: string
}

interface QueueVideo {
  file: File
  title: string
}

interface UploadContextValue {
  tasks: UploadTask[]
  enqueueVideos: (sectionId: string, startingSortOrder: number, videos: QueueVideo[]) => void
  retry: (id: string) => void
  clearFinished: () => void
}

const UploadContext = createContext<UploadContextValue | null>(null)

export function selectQueuedTasks(tasks: UploadTask[], activeIds: ReadonlySet<string>, slots: number) {
  if (slots <= 0) return []
  return tasks.filter(task => task.state === 'queued' && !activeIds.has(task.id)).slice(0, slots)
}

export function UploadProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [schedulerTick, setSchedulerTick] = useState(0)
  const activeIds = useRef(new Set<string>())

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks(current => current.map(task => task.id === id ? { ...task, ...patch } : task))
  }, [])

  const processTask = useCallback(async (task: UploadTask) => {
    updateTask(task.id, { state: 'uploading', progress: 0, error: undefined })
    try {
      const signed = await api<{ key: string; url: string; contentType: string }>('/admin/s3/uploads', {
        method: 'POST',
        body: JSON.stringify({ fileName: task.file.name, fileSize: task.file.size, contentType: 'video/mp4' }),
      })
      await uploadToSignedUrl(task.file, signed.url, signed.contentType, progress => updateTask(task.id, { progress }))
      updateTask(task.id, { state: 'registering', progress: 100 })
      await api(`/admin/sections/${task.sectionId}/lessons`, {
        method: 'POST',
        body: JSON.stringify({ title: task.title, s3Key: signed.key, sortOrder: task.sortOrder }),
      })
      updateTask(task.id, { state: 'done', progress: 100 })
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-courses'] }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
        queryClient.invalidateQueries({ queryKey: ['s3-objects'] }),
      ])
    } catch (error) {
      updateTask(task.id, {
        state: 'error',
        error: error instanceof Error ? error.message : 'No se pudo completar la carga',
      })
    } finally {
      activeIds.current.delete(task.id)
      setSchedulerTick(current => current + 1)
    }
  }, [queryClient, updateTask])

  useEffect(() => {
    const availableSlots = MAX_CONCURRENT_UPLOADS - activeIds.current.size
    const nextTasks = selectQueuedTasks(tasks, activeIds.current, availableSlots)
    for (const task of nextTasks) {
      activeIds.current.add(task.id)
      void processTask(task)
    }
  }, [processTask, schedulerTick, tasks])

  const enqueueVideos = useCallback((sectionId: string, startingSortOrder: number, videos: QueueVideo[]) => {
    setTasks(current => {
      const nextAvailableOrder = current
        .filter(task => task.sectionId === sectionId)
        .reduce((next, task) => Math.max(next, task.sortOrder + 1), startingSortOrder)
      const queued = videos.map((video, index): UploadTask => ({
        id: crypto.randomUUID(),
        file: video.file,
        title: video.title.trim(),
        sectionId,
        sortOrder: nextAvailableOrder + index,
        state: 'queued',
        progress: 0,
      }))
      return [...current, ...queued]
    })
  }, [])

  const retry = useCallback((id: string) => {
    updateTask(id, { state: 'queued', progress: 0, error: undefined })
    setSchedulerTick(current => current + 1)
  }, [updateTask])

  const clearFinished = useCallback(() => {
    setTasks(current => current.filter(task => task.state !== 'done'))
  }, [])

  const value = useMemo(() => ({ tasks, enqueueVideos, retry, clearFinished }), [clearFinished, enqueueVideos, retry, tasks])

  return <UploadContext.Provider value={value}>{children}<UploadCenter /></UploadContext.Provider>
}

export function useUploads() {
  const value = useContext(UploadContext)
  if (!value) throw new Error('useUploads debe usarse dentro de UploadProvider')
  return value
}

function UploadCenter() {
  const { tasks, retry, clearFinished } = useUploads()
  const [collapsed, setCollapsed] = useState(false)
  if (!tasks.length) return null

  const completed = tasks.filter(task => task.state === 'done').length
  const active = tasks.filter(task => task.state === 'uploading' || task.state === 'registering').length
  const errors = tasks.filter(task => task.state === 'error').length
  const totalProgress = Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)

  return <aside className={`upload-center ${collapsed ? 'collapsed' : ''}`} aria-live="polite">
    <div className="upload-center-header">
      <span className="upload-center-icon"><UploadCloud size={19} /></span>
      <div><strong>{active ? `Subiendo ${active} video${active === 1 ? '' : 's'}` : errors ? 'Carga con errores' : 'Carga completada'}</strong><small>{completed} de {tasks.length} listos · {totalProgress}%</small></div>
      <button type="button" onClick={() => setCollapsed(current => !current)} aria-label={collapsed ? 'Mostrar cargas' : 'Ocultar cargas'}>{collapsed ? <ChevronUp /> : <ChevronDown />}</button>
    </div>
    {!collapsed && <>
      <div className="upload-center-overall"><i style={{ width: `${totalProgress}%` }} /></div>
      <div className="upload-task-list">{tasks.map(task => <div className={`upload-task ${task.state}`} key={task.id}>
        <FileVideo size={18} />
        <div className="upload-task-info"><strong>{task.title}</strong><small>{task.file.name} · {formatBytes(task.file.size)}</small>
          {task.state === 'uploading' && <div className="upload-task-progress"><i style={{ width: `${task.progress}%` }} /></div>}
          {task.error && <em>{task.error}</em>}
        </div>
        <span className="upload-task-state">{task.state === 'queued' ? 'En cola' : task.state === 'uploading' ? `${task.progress}%` : task.state === 'registering' ? 'Guardando…' : task.state === 'done' ? <Check size={16} /> : <AlertCircle size={16} />}</span>
        {task.state === 'error' && <button className="upload-task-action" type="button" onClick={() => retry(task.id)} title="Reintentar"><RotateCcw size={15} /></button>}
      </div>)}</div>
      <div className="upload-center-footer"><span>Puedes seguir usando la plataforma.</span>{completed > 0 && <button type="button" onClick={clearFinished}><Trash2 size={13} /> Limpiar finalizados</button>}</div>
    </>}
  </aside>
}
