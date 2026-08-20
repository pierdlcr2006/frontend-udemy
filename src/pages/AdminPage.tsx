import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookCopy, Check, Cloud, Eye, EyeOff, FileVideo, ImagePlus, Plus, Search, Trash2, Upload, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { uploadToSignedUrl } from '../api/upload'
import { AdminDashboard } from '../components/AdminDashboard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useUploads } from '../context/UploadContext'
import { useToast } from '../context/ToastContext'
import type { Course, S3Object, User } from '../types'
import { formatBytes } from '../utils/format'

export function AdminDashboardPage() {
  return (
    <>
      <header className="page-header admin-page-header"><div><span className="eyebrow">Vista general</span><h1>Resumen</h1><p>Actividad de aprendizaje, catálogo, almacenamiento y costos de AWS.</p></div></header>
      <AdminDashboard />
    </>
  )
}

export function AdminCoursesPage() {
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<Course[]>('/admin/courses') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
  const deleteCourse = useMutation({ mutationFn: (id: string) => api(`/admin/courses/${id}`, { method: 'DELETE' }), onSuccess: () => { refresh(); pushToast({ title: 'Curso eliminado', tone: 'danger', message: 'El curso y su contenido fueron retirados.' }) } })

  return (
    <>
      <header className="page-header admin-page-header"><div><span className="eyebrow">Gestión académica</span><h1>Cursos</h1><p>Administra tu catálogo desde una vista clara. Abre un curso para editar su información o construir el contenido.</p></div><button className="primary-button page-primary-action" onClick={() => setShowCourseForm(true)}><Plus size={18} /> Nuevo curso</button></header>
      {courses.isLoading ? <div className="course-catalog-loading"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div> : courses.data?.length ? <section className="course-catalog-grid" aria-label="Catálogo de cursos">
        {courses.data.map(course => <article className="catalog-course-card" key={course.id}>
          <button type="button" className="catalog-course-main" onClick={() => navigate('/admin/courses/' + course.id)}>
            <div className="catalog-course-cover" style={course.coverUrl ? { backgroundImage: 'linear-gradient(135deg, rgba(16, 27, 57, .12), rgba(16, 27, 57, .7)), url("' + course.coverUrl + '")' } : undefined}><BookCopy size={24} /><span>{course.published ? 'Publicado' : 'Borrador'}</span></div>
            <div className="catalog-course-copy"><span className={course.published ? 'state-badge published' : 'state-badge'}>{course.published ? 'Publicado' : 'Borrador'}</span><h2>{course.title}</h2><p>{course.description || 'Sin descripción todavía.'}</p><small>{course.sections.length} secciones · {course.sections.reduce((sum, section) => sum + section.lessons.length, 0)} videos</small></div>
          </button>
          <div className="catalog-course-actions"><button type="button" className="secondary-button" onClick={() => navigate('/admin/courses/' + course.id)}>Abrir editor</button><button type="button" className="danger-text-button" onClick={() => setCourseToDelete(course)}>Eliminar</button></div>
        </article>)}
      </section> : <div className="empty-state course-catalog-empty"><BookCopy size={36} /><strong>Aún no tienes cursos</strong><span>Crea el primero y después organiza sus secciones y videos.</span><button onClick={() => setShowCourseForm(true)}>Crear curso</button></div>}
      {showCourseForm && <CreateCourseForm onClose={() => setShowCourseForm(false)} onCreated={(course) => { setShowCourseForm(false); refresh(); pushToast({ title: 'Curso creado', tone: 'success', message: course.title }); navigate('/admin/courses/' + course.id) }} />}
      <ConfirmDialog open={Boolean(courseToDelete)} title="Eliminar curso" description={courseToDelete ? 'Se eliminará "' + courseToDelete.title + '" y todo su progreso. Esta acción no se puede deshacer.' : undefined} confirmLabel="Eliminar curso" variant="danger" onConfirm={() => { if (!courseToDelete) return; deleteCourse.mutate(courseToDelete.id); setCourseToDelete(null) }} onCancel={() => setCourseToDelete(null)} />
    </>
  )
}

export function AdminCourseEditorPage() {
  const { courseId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<Course[]>('/admin/courses') })
  const course = courses.data?.find(item => item.id === courseId)
  const contentView = location.pathname.endsWith('/content')
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
  const updateCourse = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/admin/courses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), onSuccess: (_, variables) => {
    setEditingCourse(null)
    refresh()
    pushToast({ title: Object.prototype.hasOwnProperty.call(variables.body, 'published') ? (variables.body.published ? 'Curso publicado' : 'Curso oculto') : 'Curso actualizado', tone: 'success' })
  } })

  if (courses.isLoading) return <div className="course-editor-loading"><div className="loader" />Cargando editor…</div>
  if (!course) return <div className="empty-state course-editor-empty"><strong>No encontramos ese curso</strong><span>Puede haber sido eliminado o no tienes acceso.</span><button onClick={() => navigate('/admin/courses')}>Volver a cursos</button></div>

  return <>
    <header className="course-editor-header">
      <button type="button" className="back-link" onClick={() => navigate('/admin/courses')}><ArrowLeft size={17} /> Todos los cursos</button>
      <div className="course-editor-heading"><div><span className={course.published ? 'state-badge published' : 'state-badge'}>{course.published ? 'Publicado' : 'Borrador'}</span><h1>{course.title}</h1><p>{course.description || 'Define la información y después construye el contenido del curso.'}</p></div><div className="heading-actions"><button type="button" className="secondary-button" onClick={() => setEditingCourse(course)}><ImagePlus size={16} /> Editar información</button><button type="button" className="secondary-button" onClick={() => updateCourse.mutate({ id: course.id, body: { published: !course.published } })}>{course.published ? <><EyeOff /> Ocultar</> : <><Eye /> Publicar</>}</button></div></div>
    </header>
    <div className="course-editor-layout">
      <aside className="course-editor-aside"><div className="editor-cover" style={course.coverUrl ? { backgroundImage: 'linear-gradient(135deg, rgba(16, 27, 57, .12), rgba(16, 27, 57, .7)), url("' + course.coverUrl + '")' } : undefined}><BookCopy size={28} /><span>{course.coverUrl ? 'Portada activa' : 'Sin portada'}</span></div><div className="editor-summary"><strong>Contenido del curso</strong><span>{course.sections.length} secciones</span><span>{course.sections.reduce((sum, section) => sum + section.lessons.length, 0)} videos</span></div><nav className="editor-step-list" aria-label="Secciones del editor"><button type="button" className={!contentView ? 'active' : ''} onClick={() => navigate('/admin/courses/' + course.id)}><b>1</b> Información</button><button type="button" className={contentView ? 'active' : ''} onClick={() => navigate('/admin/courses/' + course.id + '/content')}><b>2</b> Secciones y videos</button></nav></aside>
      <main className="course-editor-content">{contentView ? <CourseBuilder course={course} refresh={refresh} /> : <CourseInformationView course={course} onOpenContent={() => navigate('/admin/courses/' + course.id + '/content')} />}</main>
    </div>
    {editingCourse && <EditCourseModal course={editingCourse} onClose={() => setEditingCourse(null)} onSave={(body) => updateCourse.mutateAsync({ id: editingCourse.id, body })} isSaving={updateCourse.isPending} />}
  </>
}

function CourseInformationView({ course, onOpenContent }: { course: Course; onOpenContent: () => void }) {
  const totalLessons = course.sections.reduce((sum, section) => sum + section.lessons.length, 0)
  return <section className="course-information-view">
    <div className="information-kicker"><span className="eyebrow">Vista de información</span><span className="state-badge">Paso 1 de 2</span></div>
    <div className="information-intro"><div><h2>La identidad de tu curso</h2><p>Revisa el título, la descripción y la portada antes de construir el recorrido de aprendizaje.</p></div><button className="primary-button" type="button" onClick={onOpenContent}><FileVideo size={17} /> Gestionar contenido</button></div>
    <div className="information-stats"><div><strong>{course.sections.length}</strong><span>Secciones</span></div><div><strong>{totalLessons}</strong><span>Videos</span></div><div><strong>{course.published ? 'Sí' : 'No'}</strong><span>Publicado</span></div></div>
    <div className="information-note"><BookCopy size={20} /><div><strong>Continúa con el temario</strong><span>En la siguiente vista puedes crear módulos, ordenar lecciones y subir varios videos sin interrumpir tu navegación.</span></div><button type="button" onClick={onOpenContent}>Abrir contenido</button></div>
  </section>
}

function CreateCourseForm({ onClose, onCreated }: { onClose: () => void; onCreated: (course: Course) => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [coverProgress, setCoverProgress] = useState(0)
  const [error, setError] = useState("")
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : null, [cover])

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
  }, [coverPreview])

  const mutation = useMutation({
    mutationFn: async () => {
      let coverKey: string | undefined
      if (cover) {
        setCoverProgress(1)
        const lowerName = cover.name.toLowerCase()
        const fallbackType = lowerName.endsWith(".png") ? "image/png" : lowerName.endsWith(".webp") ? "image/webp" : "image/jpeg"
        const contentType = ["image/jpeg", "image/png", "image/webp"].includes(cover.type) ? cover.type : fallbackType
        const signed = await api<{ key: string; url: string; contentType: string }>("/admin/s3/course-covers", {
          method: "POST",
          body: JSON.stringify({ fileName: cover.name, contentType, fileSize: cover.size }),
        })
        await uploadToSignedUrl(cover, signed.url, signed.contentType, setCoverProgress)
        coverKey = signed.key
      }
      return api<Course>("/admin/courses", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim(), coverKey }),
      })
    },
    onSuccess: onCreated,
    onError: (err) => setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "No se pudo crear el curso"),
  })

  const selectCover = (file: File | undefined) => {
    if (!file) return
    const validType = ["image/jpeg", "image/png", "image/webp"].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!validType) { setError("Selecciona una imagen JPG, PNG o WEBP."); return }
    if (file.size > 10 * 1024 * 1024) { setError("La portada puede pesar como máximo 10 MB."); return }
    setError("")
    setCover(file)
  }

  return <Modal title="Crear curso" onClose={onClose}>
    <form className="modal-form course-create-form" onSubmit={(event) => { event.preventDefault(); setError(""); mutation.mutate() }}>
      <div className="form-intro"><strong>Construye una nueva ruta</strong><span>Primero define la identidad del curso. Después podrás añadir secciones y videos sin perder tu avance.</span></div>
      <label>Título del curso<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ej. Fundamentos de React" required minLength={2} autoFocus /><small>Usa un nombre claro que explique el resultado de aprendizaje.</small></label>
      <label>Descripción<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="¿Qué aprenderá el estudiante?" rows={4} /><small>Puedes editarla más adelante antes de publicar.</small></label>
      <div className="cover-picker">
        <div className="cover-preview">{coverPreview ? <img src={coverPreview} alt="Vista previa de la portada" /> : <ImagePlus size={28} />}</div>
        <div className="cover-picker-copy"><strong>Portada del curso <span>Opcional</span></strong><small>JPG, PNG o WEBP. Máximo 10 MB. Se mostrará en la biblioteca.</small><label className="file-input-button"><ImagePlus size={15} /> {cover ? "Cambiar imagen" : "Seleccionar imagen"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => selectCover(event.target.files?.[0])} /></label>{cover && <small className="selected-file">{cover.name} · {formatBytes(cover.size)}</small>}</div>
      </div>
      {mutation.isPending && cover && <div className="cover-upload-progress"><span>Subiendo portada… {coverProgress}%</span><i><b style={{ width: coverProgress + "%" }} /></i></div>}
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={mutation.isPending || title.trim().length < 2}>{mutation.isPending ? "Creando curso…" : "Crear curso"}</button></div>
    </form>
  </Modal>
}

function EditCourseModal({
  course,
  onClose,
  onSave,
  isSaving,
}: {
  course: Course
  onClose: () => void
  onSave: (body: Record<string, unknown>) => Promise<unknown>
  isSaving: boolean
}) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description ?? '')
  const [cover, setCover] = useState<File | null>(null)
  const [coverProgress, setCoverProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : course.coverUrl ?? null, [cover, course.coverUrl])

  useEffect(() => () => {
    if (cover && coverPreview) URL.revokeObjectURL(coverPreview)
  }, [cover, coverPreview])

  const selectCover = (file: File | undefined) => {
    if (!file) return
    const validType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!validType) { setError('Selecciona una imagen JPG, PNG o WEBP.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('La portada puede pesar como máximo 10 MB.'); return }
    setError('')
    setCover(file)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setIsUploading(Boolean(cover))
    try {
      let coverKey: string | undefined
      if (cover) {
        setCoverProgress(1)
        const lowerName = cover.name.toLowerCase()
        const fallbackType = lowerName.endsWith('.png') ? 'image/png' : lowerName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
        const contentType = ['image/jpeg', 'image/png', 'image/webp'].includes(cover.type) ? cover.type : fallbackType
        const signed = await api<{ key: string; url: string; contentType: string }>('/admin/s3/course-covers', {
          method: 'POST',
          body: JSON.stringify({ fileName: cover.name, contentType, fileSize: cover.size }),
        })
        await uploadToSignedUrl(cover, signed.url, signed.contentType, setCoverProgress)
        coverKey = signed.key
      }
      await onSave({ title: title.trim(), description: description.trim(), ...(coverKey ? { coverKey } : {}) })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'No se pudieron guardar los cambios')
    } finally {
      setIsUploading(false)
    }
  }

  return <Modal title="Editar curso" onClose={onClose}>
    <form className="modal-form course-create-form" onSubmit={submit}>
      <div className="form-intro"><strong>Actualiza la identidad del curso</strong><span>Los cambios se reflejarán en la biblioteca cuando guardes.</span></div>
      <label>Título del curso<input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} autoFocus /></label>
      <label>Descripción<textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} /></label>
      <div className="cover-picker">
        <div className="cover-preview">{coverPreview ? <img src={coverPreview} alt="Vista previa de la portada" /> : <ImagePlus size={28} />}</div>
        <div className="cover-picker-copy"><strong>Portada del curso <span>{course.coverUrl ? 'Actualizable' : 'Opcional'}</span></strong><small>JPG, PNG o WEBP. Máximo 10 MB.</small><label className="file-input-button"><ImagePlus size={15} /> {cover ? 'Cambiar imagen' : course.coverUrl ? 'Reemplazar portada' : 'Seleccionar imagen'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => selectCover(event.target.files?.[0])} /></label>{cover && <small className="selected-file">{cover.name} · {formatBytes(cover.size)}</small>}</div>
      </div>
      {cover && <div className="cover-upload-progress"><span>{isUploading ? 'Subiendo portada… ' + coverProgress + '%' : 'La nueva portada se guardará al confirmar'}</span><i><b style={{ width: coverProgress + '%' }} /></i></div>}
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={isSaving || isUploading}>Cancelar</button><button className="primary-button" disabled={isSaving || isUploading || title.trim().length < 2}>{isUploading ? 'Subiendo portada…' : isSaving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>
  </Modal>
}

function CourseBuilder({ course, refresh }: { course: Course; refresh: () => void }) {
  const { pushToast } = useToast()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [sectionTitle, setSectionTitle] = useState('')
  const [lessonSection, setLessonSection] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<{ id: string; title: string } | null>(null)
  const [editingLesson, setEditingLesson] = useState<{ id: string; title: string; s3Key?: string } | null>(null)
  const [sectionToDelete, setSectionToDelete] = useState<{ id: string; title: string } | null>(null)
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string } | null>(null)
  const createSection = useMutation({
    mutationFn: () => api<{ id: string }>("/admin/courses/" + course.id + "/sections", { method: "POST", body: JSON.stringify({ title: sectionTitle.trim(), sortOrder: course.sections.length }) }),
    onSuccess: (created) => {
      const createdTitle = sectionTitle.trim()
      setSectionTitle("")
      setOpenSections(previous => ({ ...previous, [created.id]: true }))
      refresh()
      pushToast({ title: "Sección creada", tone: "success", message: createdTitle })
    },
  })
  const removeSection = useMutation({ mutationFn: (id: string) => api(`/admin/sections/${id}`, { method: 'DELETE' }), onSuccess: () => { refresh(); pushToast({ title: 'Sección eliminada', tone: 'danger' }) } })
  const removeLesson = useMutation({ mutationFn: (id: string) => api(`/admin/lessons/${id}`, { method: 'DELETE' }), onSuccess: () => { refresh(); pushToast({ title: 'Video eliminado', tone: 'danger' }) } })
  const updateSection = useMutation({ mutationFn: ({ id, title }: { id: string; title: string }) => api(`/admin/sections/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }), onSuccess: (_, variables) => { setEditingSection(null); refresh(); pushToast({ title: 'Sección actualizada', tone: 'success', message: variables.title }) } })
  const updateLesson = useMutation({ mutationFn: ({ id, title, s3Key }: { id: string; title?: string; s3Key?: string }) => {
    const body: Record<string, unknown> = {}
    if (typeof title !== 'undefined') body.title = title
    if (typeof s3Key !== 'undefined') body.s3Key = s3Key
    return api(`/admin/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  }, onSuccess: (_, variables) => { setEditingLesson(null); refresh(); pushToast({ title: 'Video actualizado', tone: 'success', message: variables.title ?? 'Cambios guardados' }) } })
  return <div className="course-builder">
    <div className="builder-title"><div><h3>Estructura del curso</h3><span>Organiza el contenido por módulos y agrega los videos en el orden de aprendizaje.</span></div><strong className="builder-counter">{course.sections.length} sección{course.sections.length === 1 ? "" : "es"} · {course.sections.reduce((total, section) => total + section.lessons.length, 0)} videos</strong></div>
    {editingSection && (
      <Modal title="Editar sección" onClose={() => setEditingSection(null)}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); updateSection.mutate({ id: editingSection.id, title: editingSection.title }) }}>
          <label>Título<input value={editingSection.title} onChange={event => setEditingSection(current => current ? { ...current, title: event.target.value } : current)} required minLength={2} autoFocus /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditingSection(null)}>Cancelar</button><button className="primary-button" disabled={updateSection.isPending}>Guardar cambios</button></div>
        </form>
      </Modal>
    )}
    {editingLesson && (
      <Modal title="Editar video" onClose={() => setEditingLesson(null)}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); updateLesson.mutate({ id: editingLesson.id, title: editingLesson.title, s3Key: editingLesson.s3Key }) }}>
          <label>Título<input value={editingLesson.title} onChange={event => setEditingLesson(current => current ? { ...current, title: event.target.value } : current)} required minLength={2} autoFocus /></label>
          <label>URL / S3 key<input value={editingLesson.s3Key ?? ''} onChange={event => setEditingLesson(current => current ? { ...current, s3Key: event.target.value } : current)} placeholder="path/to/video.mp4" /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditingLesson(null)}>Cancelar</button><button className="primary-button" disabled={updateLesson.isPending}>Guardar cambios</button></div>
        </form>
      </Modal>
    )}
    <ConfirmDialog open={Boolean(sectionToDelete)} title="Eliminar sección" description={sectionToDelete ? 'Se eliminará la sección "' + sectionToDelete.title + '" y sus videos.' : undefined} confirmLabel="Eliminar sección" variant="danger" onConfirm={() => { if (!sectionToDelete) return; removeSection.mutate(sectionToDelete.id); setSectionToDelete(null) }} onCancel={() => setSectionToDelete(null)} />
    <ConfirmDialog open={Boolean(lessonToDelete)} title="Eliminar video" description={lessonToDelete ? 'Se quitará "' + lessonToDelete.title + '" del curso. El archivo de S3 no se eliminará.' : undefined} confirmLabel="Eliminar video" variant="danger" onConfirm={() => { if (!lessonToDelete) return; removeLesson.mutate(lessonToDelete.id); setLessonToDelete(null) }} onCancel={() => setLessonToDelete(null)} />
    {course.sections.map((section, index) => {
      const isOpen = openSections[section.id] ?? false
      return <div className="section-block" key={section.id}>
      <div className="section-heading">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div className="section-title"><strong>{section.title}</strong><small>{section.lessons.length} {section.lessons.length === 1 ? "video" : "videos"}</small></div>
        <div className="section-actions">
          <button type="button" className="section-toggle" aria-expanded={isOpen} aria-label={isOpen ? "Contraer sección" : "Expandir sección"} onClick={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>{isOpen ? '▾' : '▸'}</button>
          <button type="button" onClick={() => setEditingSection({ id: section.id, title: section.title })}>Editar</button>
          <button type="button" onClick={() => setSectionToDelete({ id: section.id, title: section.title })}><Trash2 size={16} /></button>
        </div>
      </div>
      {isOpen && (
        <>
          {section.lessons.length === 0 && <div className="section-empty"><FileVideo size={20} /><span>Aún no hay videos en esta sección.</span><small>Agrega archivos MP4 o selecciona uno que ya esté en S3.</small></div>}
          {section.lessons.map((lesson, lessonIndex) => {
            return <div className="admin-lesson" key={lesson.id}>
              <span>{lessonIndex + 1}</span>
              <div><strong>{lesson.title}</strong><small>{lesson.s3Key}</small></div>
              <Cloud size={16} />
              <button type="button" onClick={() => setEditingLesson({ id: lesson.id, title: lesson.title, s3Key: lesson.s3Key })}>Editar</button>
              <button type="button" onClick={() => setLessonToDelete({ id: lesson.id, title: lesson.title })}><Trash2 size={15} /></button>
            </div>
          })}
          {lessonSection === section.id ? <CreateLessonForm sectionId={section.id} sortOrder={section.lessons.length} onDone={() => { setLessonSection(null); refresh() }} /> : <button className="add-row" onClick={() => setLessonSection(section.id)}><Plus size={16} /> Agregar videos</button>}
        </>
      )}
    </div>
    })}
    <form className="add-section" onSubmit={(event) => { event.preventDefault(); if (sectionTitle.trim().length >= 2) createSection.mutate() }}><div><strong>Nueva sección</strong><small>Un módulo agrupa videos relacionados.</small></div><input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} placeholder="Ej. Introducción y objetivos" required minLength={2} /><button className="secondary-button" disabled={createSection.isPending}><Plus size={17} /> {createSection.isPending ? "Creando…" : "Agregar sección"}</button></form>
  </div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}>
      <div className="modal-header"><strong>{title}</strong><button type="button" className="modal-close" aria-label="Cerrar diálogo" onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>
}

type PendingVideo = {
  id: string
  file: File
  title: string
}

function CreateLessonForm({ sectionId, sortOrder, onDone }: { sectionId: string; sortOrder: number; onDone: () => void }) {
  const { pushToast } = useToast()
  const [mode, setMode] = useState<'upload' | 'existing'>('existing')
  const [title, setTitle] = useState('')
  const [s3Key, setS3Key] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [videos, setVideos] = useState<PendingVideo[]>([])
  const { enqueueVideos } = useUploads()
  const searchTerm = search.trim()
  const objects = useQuery({
    queryKey: ['s3-objects', searchTerm],
    queryFn: () => api<{ items: S3Object[]; nextCursor: string | null }>(`/admin/s3/objects${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`),
    retry: false,
    enabled: mode === 'existing',
  })
  const listed = objects.data?.items ?? null
  const create = useMutation({ mutationFn: () => api(`/admin/sections/${sectionId}/lessons`, { method: 'POST', body: JSON.stringify({ title, s3Key, sortOrder }) }), onSuccess: () => { pushToast({ title: 'Video agregado', tone: 'success', message: title }); onDone() }, onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear la lección') })

  const selectFiles = (files: FileList | null) => {
    const selected = Array.from(files ?? []).filter(file => file.name.toLowerCase().endsWith('.mp4'))
    setVideos(selected.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: file.name.replace(/\.mp4$/i, '').replace(/[-_]+/g, ' ').trim(),
    })))
    setError(selected.length ? '' : 'Selecciona uno o más archivos MP4.')
  }

  const updateVideo = (id: string, patch: Partial<PendingVideo>) =>
    setVideos(current => current.map(video => video.id === id ? { ...video, ...patch } : video))

  const uploadAll = (event: FormEvent) => {
    event.preventDefault()
    if (!videos.length || videos.some(video => video.title.trim().length < 2)) {
      setError('Cada video necesita un título de al menos 2 caracteres.')
      return
    }
    setError('')
    enqueueVideos(sectionId, sortOrder, videos.map(video => ({ file: video.file, title: video.title })))
    setVideos([])
    onDone()
  }

  if (mode === 'upload') return <form className="lesson-form upload-form" onSubmit={uploadAll}>
    <div className="lesson-form-heading"><div><strong>Agregar varios videos</strong><small>Cada archivo será una lección con su propio título.</small></div><button type="button" onClick={onDone}>Cerrar</button></div>
    <div className="source-tabs"><button type="button" className="active"><Upload size={15} /> Subir videos</button><button type="button" onClick={() => setMode('existing')}><Cloud size={15} /> Elegir de S3</button></div>
    <label className="upload-dropzone"><Upload size={25} /><strong>Selecciona varios MP4</strong><span>Puedes elegir todos los videos de esta sección en una sola vez.</span><input type="file" accept="video/mp4,.mp4" multiple onChange={event => selectFiles(event.target.files)} /></label>
    {videos.length > 0 && <div className="pending-videos">{videos.map((video, index) => <div className="pending-video" key={video.id}>
      <span className="video-number">{index + 1}</span><FileVideo size={19} />
      <div className="video-title-field"><input value={video.title} onChange={event => updateVideo(video.id, { title: event.target.value })} aria-label={`Título del video ${index + 1}`} required minLength={2} /><small>{video.file.name} · {formatBytes(video.file.size)}</small></div>
      <button type="button" className="remove-video" onClick={() => setVideos(current => current.filter(item => item.id !== video.id))}><Trash2 size={16} /></button>
    </div>)}</div>}
    {videos.length > 0 && <div className="background-upload-note"><Upload size={15} /><span>Al iniciar, podrás cerrar este formulario y seguir usando la plataforma. Se cargarán hasta 4 videos al mismo tiempo.</span></div>}
    {error && <div className="form-error">{error}</div>}<div className="form-actions"><button type="button" onClick={onDone}>Cancelar</button><button className="primary-button" disabled={!videos.length}>{`Iniciar carga de ${videos.length || ''} video${videos.length === 1 ? '' : 's'}`}</button></div>
  </form>

  return <form className="lesson-form" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
    <div className="lesson-form-heading"><div><strong>Agregar video existente</strong><small>Selecciona un MP4 que ya esté en el bucket.</small></div><button type="button" onClick={onDone}>Cerrar</button></div>
    <div className="source-tabs"><button type="button" onClick={() => setMode('upload')}><Upload size={15} /> Subir videos</button><button type="button" className="active"><Cloud size={15} /> Elegir de S3</button></div>
    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título visible del video" required minLength={2} />
    <div className="s3-picker"><label><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar video en S3" /></label>
      {objects.isError ? <div className="picker-message">No se pudo consultar S3. Verifica las credenciales y el bucket.</div> : objects.isLoading ? <div className="picker-message">Consultando bucket…</div> : <div className="object-list">{(listed ?? []).map(item => <button type="button" key={item.key} className={s3Key === item.key ? 'selected' : ''} onClick={() => setS3Key(item.key)}><span>{s3Key === item.key ? <Check /> : <Cloud />}</span><div><strong>{item.key.split('/').pop()}</strong><small>{item.key} · {formatBytes(item.size)}</small></div></button>)}</div>}
    </div>{error && <div className="form-error">{error}</div>}<div className="form-actions"><button type="button" onClick={onDone}>Cancelar</button><button className="primary-button" disabled={!s3Key || create.isPending}>Guardar lección</button></div>
  </form>
}

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api<User[]>('/admin/users') })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  const toggle = useMutation({ mutationFn: (user: User) => api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) }), onSuccess: refresh })
  return <><header className="page-header admin-page-header"><div><span className="eyebrow">Control de acceso</span><h1>Usuarios</h1><p>Administra las cuentas que pueden ingresar y aprender en la plataforma.</p></div><button className="primary-button page-primary-action" onClick={() => setShowForm(true)}><UserPlus size={18} /> Nuevo estudiante</button></header><section className="users-panel"><div className="users-heading"><div><h2>Personas con acceso</h2><p>Activa o desactiva estudiantes sin perder su progreso.</p></div><span className="record-count">{users.data?.length ?? 0} cuentas</span></div>
    {showForm && <CreateUserForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); refresh() }} />}
    <div className="users-table"><div className="table-head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Acción</span></div>{users.data?.map(user => <div className="table-row" key={user.id}><span className="user-cell"><i>{user.name.charAt(0)}</i><span><strong>{user.name}</strong><small>{user.email}</small></span></span><span><b className="role-chip">{user.role === 'ADMIN' ? 'Administrador' : 'Estudiante'}</b></span><span><b className={user.isActive ? 'account-state active' : 'account-state'}>{user.isActive ? 'Activo' : 'Inactivo'}</b></span><span><button className="table-action" onClick={() => toggle.mutate(user)}>{user.isActive ? 'Desactivar' : 'Activar'}</button></span></div>)}</div>
  </section></>
}

function CreateUserForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: () => api('/admin/users', { method: 'POST', body: JSON.stringify(form) }), onSuccess: onCreated, onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta') })
  const submit = (event: FormEvent) => { event.preventDefault(); mutation.mutate() }
  return <form className="user-create-form" onSubmit={submit}><div><strong>Crear estudiante</strong><button type="button" onClick={onClose}>Cerrar</button></div><label>Nombre<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength={2} /></label><label>Correo<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label><label>Contraseña temporal<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={mutation.isPending}>Crear acceso</button></form>
}
