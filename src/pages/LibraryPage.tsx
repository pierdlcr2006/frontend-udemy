import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Play, PlayCircle, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import type { Course, Lesson } from '../types'

type LibraryFilter = 'all' | 'progress' | 'completed'

const lessonsFor = (course: Course) => course.sections.flatMap(section => section.lessons)
const isStarted = (course: Course) => lessonsFor(course).some(lesson => (lesson.progress?.maxPositionSeconds ?? 0) > 0)
const isCompleted = (course: Course) => course.stats.totalLessons > 0 && course.stats.completedLessons === course.stats.totalLessons

function resumeLessonFor(course: Course): Lesson | undefined {
  const lessons = lessonsFor(course)
  const recentlyWatched = lessons
    .filter(lesson => lesson.progress && !lesson.progress.completed)
    .sort((a, b) => new Date(b.progress!.lastWatchedAt).getTime() - new Date(a.progress!.lastWatchedAt).getTime())[0]
  return recentlyWatched ?? lessons.find(lesson => !lesson.progress?.completed) ?? lessons[0]
}

function lastActivity(course: Course) {
  return Math.max(...lessonsFor(course).map(lesson => lesson.progress ? new Date(lesson.progress.lastWatchedAt).getTime() : 0), 0)
}

export function LibraryPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<Course[]>('/courses') })

  const featured = useMemo(() => {
    if (!courses.data?.length) return undefined
    return [...courses.data].sort((a, b) => lastActivity(b) - lastActivity(a))[0]
  }, [courses.data])

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return (courses.data ?? []).filter(course => {
      const matchesSearch = !term || `${course.title} ${course.description ?? ''}`.toLocaleLowerCase('es').includes(term)
      const matchesFilter = filter === 'all' || (filter === 'completed' ? isCompleted(course) : isStarted(course) && !isCompleted(course))
      return matchesSearch && matchesFilter
    })
  }, [courses.data, filter, search])

  const featuredLesson = featured ? resumeLessonFor(featured) : undefined

  return (
    <AppShell>
      <header className="page-header library-header">
        <div><span className="eyebrow">Mi aprendizaje</span><h1>Hola, {user?.name.split(' ')[0]} 👋</h1><p>Continúa donde te quedaste o descubre tu siguiente lección.</p></div>
        <div className="date-chip"><Clock3 size={17} /> Tu progreso está sincronizado</div>
      </header>

      {courses.isLoading ? <LibrarySkeleton /> : courses.isError ? (
        <div className="empty-state"><strong>No pudimos cargar tus cursos</strong><span>Revisa tu conexión y vuelve a intentarlo.</span><button onClick={() => courses.refetch()}>Intentar nuevamente</button></div>
      ) : courses.data?.length ? <>
        {featured && featuredLesson && <section className="continue-card">
          <div className="continue-copy">
            <span className="continue-kicker"><Play size={14} fill="currentColor" /> {isStarted(featured) ? 'Continúa aprendiendo' : 'Tu próxima ruta'}</span>
            <h2>{featured.title}</h2>
            <p>{featured.description || 'Avanza a tu ritmo. Guardaremos automáticamente cada progreso.'}</p>
            <div className="continue-meta"><span>{featured.stats.completedLessons} de {featured.stats.totalLessons} lecciones</span><strong>{featured.stats.percent}% completado</strong></div>
            <div className="continue-progress"><span style={{ width: `${featured.stats.percent}%` }} /></div>
            <Link className="continue-action" to={`/curso/${featured.id}/${featuredLesson.id}`}><PlayCircle size={20} /> {isStarted(featured) ? 'Continuar curso' : 'Comenzar curso'} <ArrowRight size={18} /></Link>
          </div>
          <div className="continue-art" aria-hidden="true"><span>{featured.stats.percent}%</span><BookOpen /></div>
        </section>}

        <section className="library-section" aria-labelledby="library-title">
          <div className="library-toolbar">
            <div><span className="eyebrow">Tu catálogo</span><h2 id="library-title">Todos tus cursos</h2></div>
            <label className="library-search"><Search size={18} /><span className="sr-only">Buscar cursos</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por título o descripción" /></label>
          </div>
          <div className="filter-chips" role="group" aria-label="Filtrar cursos">
            <button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button>
            <button className={filter === 'progress' ? 'active' : ''} aria-pressed={filter === 'progress'} onClick={() => setFilter('progress')}>En progreso</button>
            <button className={filter === 'completed' ? 'active' : ''} aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completados</button>
          </div>

          {filteredCourses.length ? <div className="cards-grid">
            {filteredCourses.map((course, index) => <CourseCard course={course} index={index} key={course.id} />)}
          </div> : <div className="empty-state library-empty"><Search size={30} /><strong>No encontramos cursos</strong><span>Prueba otro término o cambia el filtro seleccionado.</span><button onClick={() => { setSearch(''); setFilter('all') }}>Limpiar búsqueda</button></div>}
        </section>
      </> : <div className="empty-state"><BookOpen size={36} /><strong>Aún no hay cursos publicados</strong><span>Cuando el administrador publique uno, aparecerá aquí.</span></div>}
    </AppShell>
  )
}

function CourseCard({ course, index }: { course: Course; index: number }) {
  const resumeLesson = resumeLessonFor(course)
  const completed = isCompleted(course)
  return <article className={`course-card theme-${index % 4}`}>
    <div className={course.coverUrl ? "course-cover has-image" : "course-cover"} style={course.coverUrl ? { backgroundImage: "linear-gradient(135deg, rgba(18, 27, 58, .18), rgba(18, 27, 58, .72)), url(\"" + course.coverUrl + "\")" } : undefined}>
      <span className="course-icon">{completed ? <CheckCircle2 /> : <BookOpen />}</span><span>{course.stats.totalLessons} lecciones</span>
    </div>
    <div className="course-card-body">
      <span className="course-label">{completed ? 'COMPLETADO' : isStarted(course) ? 'EN PROGRESO' : 'CURSO'}</span>
      <h2>{course.title}</h2><p>{course.description || 'Una ruta de aprendizaje preparada para avanzar a tu ritmo.'}</p>
      <div className="progress-label"><span>{course.stats.completedLessons} de {course.stats.totalLessons} completadas</span><strong>{course.stats.percent}%</strong></div>
      <div className="progress-track"><span style={{ width: `${course.stats.percent}%` }} /></div>
      {resumeLesson ? <Link className="course-link" to={`/curso/${course.id}/${resumeLesson.id}`}><PlayCircle size={19} /> {completed ? 'Repasar curso' : isStarted(course) ? 'Continuar curso' : 'Comenzar curso'} <ArrowRight size={17} /></Link> : <span className="course-link disabled">Próximamente</span>}
    </div>
  </article>
}

function LibrarySkeleton() {
  return <><div className="continue-card skeleton continue-skeleton" /><div className="cards-grid">{[1, 2, 3].map(item => <div className="course-card skeleton" key={item} />)}</div></>
}
