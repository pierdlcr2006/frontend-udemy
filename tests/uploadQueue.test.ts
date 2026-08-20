import { describe, expect, it } from 'vitest'
import { MAX_CONCURRENT_UPLOADS, selectQueuedTasks, type UploadTask } from '../src/context/UploadContext'

const task = (id: string, state: UploadTask['state'] = 'queued'): UploadTask => ({
  id,
  file: new File(['video'], `${id}.mp4`, { type: 'video/mp4' }),
  title: id,
  sectionId: 'section',
  sortOrder: 0,
  state,
  progress: 0,
})

describe('cola de cargas', () => {
  it('inicia como máximo cuatro videos en paralelo', () => {
    const tasks = Array.from({ length: 7 }, (_, index) => task(String(index)))
    expect(selectQueuedTasks(tasks, new Set(), MAX_CONCURRENT_UPLOADS).map(item => item.id)).toEqual(['0', '1', '2', '3'])
  })

  it('respeta los espacios ocupados e ignora tareas activas o finalizadas', () => {
    const tasks = [task('active'), task('done', 'done'), task('next'), task('last')]
    expect(selectQueuedTasks(tasks, new Set(['active']), 2).map(item => item.id)).toEqual(['next', 'last'])
  })
})
