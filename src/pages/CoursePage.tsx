import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Menu, PlayCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { PlayerViewport, usePlayback } from '../context/PlaybackContext'
import type { Course, Lesson } from '../types'
import { formatDuration } from '../utils/format'

export function CoursePage() {
  const { courseId = '', lessonId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { openLesson } = usePlayback()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [outlineState, setOutlineState] = useState<{ forSection?: string; openSectionId: string | null }>({ openSectionId: null })
  const course = useQuery({ queryKey: ['course', courseId], queryFn: () => api<Course>(`/courses/${courseId}`), enabled: Boolean(courseId) })
  const lessons = useMemo(() => course.data?.sections.flatMap(section => section.lessons) ?? [], [course.data])
  const current = lessons.find(lesson => lesson.id === lessonId) ?? lessons[0]
  const currentIndex = lessons.findIndex(lesson => lesson.id === current?.id)
  const previousLesson = currentIndex > 0 ? lessons[currentIndex - 1] : undefined
  const nextLesson = currentIndex >= 0 ? lessons[currentIndex + 1] : undefined
  const currentSectionId = course.data?.sections.find(section => section.lessons.some(lesson => lesson.id === current?.id))?.id
  const openSectionId = outlineState.forSection === currentSectionId ? outlineState.openSectionId : currentSectionId ?? null
  const completion = useMutation({
    mutationFn: ({ lessonId: completingLessonId, completed }: { lessonId: string; completed: boolean }) =>
      api(`/progress/${completingLessonId}/completion`, { method: 'PATCH', body: JSON.stringify({ completed }) }),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
      ])
    },
  })
  useEffect(() => {
    if (course.data && current && current.id !== lessonId) navigate(`/curso/${courseId}/${current.id}`, { replace: true })
  }, [course.data, courseId, current, lessonId, navigate])
  useEffect(() => {
    if (!course.data || !current) return
    openLesson({ courseId, courseTitle: course.data.title, lesson: current as Lesson, lessons })
  }, [course.data, courseId, current, lessons, openLesson])

  if (course.isLoading) return <div className="splash dark"><div className="loader" />Cargando curso…</div>
  if (!course.data || !current) return <div className="splash"><strong>Este curso todavía no tiene lecciones.</strong><Link to="/">Volver a la biblioteca</Link></div>
  return (
    <div className="player-page">
      <header className="player-header">
        <Link to="/"><ChevronLeft /> Biblioteca</Link><span className="header-divider" /><strong>{course.data.title}</strong>
        <div className="header-progress"><span>{course.data.stats.percent}% completado</span><div className="mini-track"><i style={{ width: `${course.data.stats.percent}%` }} /></div></div>
        <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu /></button>
      </header>
      <div className="player-layout">
        <main className="player-main">
          <PlayerViewport />
          <div className="lesson-actions redesigned">
            <div className="lesson-copy"><span className="eyebrow">Lección actual</span><h2>{current.title}</h2>{current.description && <p>{current.description}</p>}</div>
            <button className={current.progress?.completed ? 'complete-button completed' : 'complete-button'} onClick={() => completion.mutate({ lessonId: current.id, completed: !current.progress?.completed })} disabled={completion.isPending}>
              <CheckCircle2 size={19} />{current.progress?.completed ? 'Marcar incompleta' : 'Marcar completada'}
            </button>
          </div>
          <nav className="lesson-navigation" aria-label="Navegación entre lecciones">
            {previousLesson ? <button onClick={() => navigate(`/curso/${courseId}/${previousLesson.id}`)}><ChevronLeft /><span><small>Anterior</small><strong>{previousLesson.title}</strong></span></button> : <span />}
            {nextLesson ? <button className="next" onClick={() => navigate(`/curso/${courseId}/${nextLesson.id}`)}><span><small>Siguiente lección</small><strong>{nextLesson.title}</strong></span><ChevronRight /></button> : <span className="course-finished"><CheckCircle2 /> Última lección del curso</span>}
          </nav>
        </main>
        <aside className={`course-outline ${sidebarOpen ? 'open' : ''}`}>
          <div className="outline-header"><span>Contenido del curso</span><strong>{course.data.stats.completedLessons}/{course.data.stats.totalLessons}</strong></div>
          {course.data.sections.map((section, sectionIndex) => (
            <section key={section.id}>
              <button type="button" className="outline-section-toggle" aria-expanded={openSectionId === section.id} aria-controls={`section-lessons-${section.id}`} onClick={() => setOutlineState({ forSection: currentSectionId, openSectionId: openSectionId === section.id ? null : section.id })}>
                <span className="section-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
                <span><strong>{section.title}</strong><small>{section.lessons.length} video{section.lessons.length === 1 ? '' : 's'}</small></span>
                <ChevronDown size={17} />
              </button>
              <div id={`section-lessons-${section.id}`} className="outline-section-lessons" hidden={openSectionId !== section.id}>
                {section.lessons.map((lesson) => (
                  <button key={lesson.id} className={lesson.id === current.id ? 'lesson-row active' : 'lesson-row'} onClick={() => { navigate(`/curso/${courseId}/${lesson.id}`); setSidebarOpen(false) }}>
                    <span className={lesson.progress?.completed ? 'lesson-status done' : 'lesson-status'}>{lesson.progress?.completed ? <Check size={14} /> : lesson.id === current.id ? <PlayCircle size={17} /> : <Circle size={14} />}</span>
                    <span><strong>{lesson.title}</strong><small>{formatDuration(lesson.durationSeconds)}</small></span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>
      </div>
    </div>
  )
}
