import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookCopy, Check, Cloud, Eye, EyeOff, FileVideo, Plus, Search, Trash2, Upload, UserPlus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
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
  const [coursesOpen, setCoursesOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null)
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<Course[]>('/admin/courses') })
  const selected = courses.data?.find(course => course.id === selectedId) ?? courses.data?.[0]
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-courses'] })
  const updateCourse = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/admin/courses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), onSuccess: (_, variables) => {
    setEditingCourse(null)
    refresh()
    if (Object.prototype.hasOwnProperty.call(variables.body, 'published')) {
      pushToast({ title: variables.body.published ? 'Curso publicado' : 'Curso oculto', tone: 'success' })
    } else {
      pushToast({ title: 'Curso actualizado', tone: 'success' })
    }
  } })
  const deleteCourse = useMutation({ mutationFn: (id: string) => api(`/admin/courses/${id}`, { method: 'DELETE' }), onSuccess: () => { setSelectedId(null); refresh(); pushToast({ title: 'Curso eliminado', tone: 'danger', message: 'El curso y su contenido fueron retirados.' }) } })

  return (
    <>
      <header className="page-header admin-page-header"><div><span className="eyebrow">Gestión académica</span><h1>Cursos</h1><p>Diseña el temario, publica contenido y agrega videos desde tu equipo o S3.</p></div><button className="primary-button page-primary-action" onClick={() => setShowCourseForm(true)}><Plus size={18} /> Nuevo curso</button></header>
      <div className="admin-grid">
      <section className="admin-list-panel">
        <div className="panel-title">
          <div>
            <h2>Tu catálogo</h2>
            <span>{courses.data?.length ?? 0} cursos en total</span>
          </div>
          <div className="panel-actions">
            <button className="icon-button" aria-label={coursesOpen ? 'Cerrar catálogo' : 'Abrir catálogo'} onClick={() => setCoursesOpen(o => !o)}>{coursesOpen ? '▾' : '▸'}</button>
            <button className="icon-button primary" aria-label="Crear curso" onClick={() => setShowCourseForm(true)}><Plus /></button>
          </div>
        </div>
        {coursesOpen && (
          courses.isLoading ? <div className="panel-loading">Cargando…</div> : courses.data?.map(course => (
            <button key={course.id} className={`admin-course-row ${selected?.id === course.id ? 'active' : ''}`} onClick={() => setSelectedId(course.id)}>
              <span className="course-mini-icon"><BookCopy /></span><span><strong>{course.title}</strong><small>{course.sections.reduce((sum, section) => sum + section.lessons.length, 0)} lecciones</small></span>
              <i className={course.published ? 'status-dot published' : 'status-dot'} title={course.published ? 'Publicado' : 'Borrador'} />
            </button>
          ))
        )}
      </section>
      <section className="admin-detail-panel">
        {showCourseForm && <CreateCourseForm onClose={() => setShowCourseForm(false)} onCreated={(course) => { setShowCourseForm(false); setSelectedId(course.id); refresh(); pushToast({ title: 'Curso creado', tone: 'success', message: course.title }) }} />}
        {editingCourse && (
          <EditCourseModal
            course={editingCourse}
            onClose={() => setEditingCourse(null)}
            onSave={(body) => updateCourse.mutate({ id: editingCourse.id, body })}
            isSaving={updateCourse.isPending}
          />
        )}
        {selected ? <>
          <div className="detail-heading">
            <div><span className={selected.published ? 'state-badge published' : 'state-badge'}>{selected.published ? 'Publicado' : 'Borrador'}</span><h2>{selected.title}</h2><p>{selected.description || 'Sin descripción todavía.'}</p></div>
            <div className="heading-actions">
              <button type="button" className="secondary-button" onClick={() => setEditingCourse(selected)}><Plus size={16} /> Editar curso</button>
              <button className="secondary-button" onClick={() => updateCourse.mutate({ id: selected.id, body: { published: !selected.published } })}>{selected.published ? <><EyeOff /> Ocultar</> : <><Eye /> Publicar</>}</button>
              <button className="danger-icon" title="Eliminar curso" onClick={() => setCourseToDelete(selected)}><Trash2 /></button>
            </div>
          </div>
          <CourseBuilder course={selected} refresh={refresh} />
        </> : <div className="empty-state compact"><BookCopy /><strong>Crea tu primer curso</strong><span>Después podrás agregar secciones y videos de S3.</span></div>}
      </section>
      </div>
      <ConfirmDialog open={Boolean(courseToDelete)} title="Eliminar curso" description={courseToDelete ? 'Se eliminará "' + courseToDelete.title + '" y todo su progreso. Esta acción no se puede deshacer.' : undefined} confirmLabel="Eliminar curso" variant="danger" onConfirm={() => { if (!courseToDelete) return; deleteCourse.mutate(courseToDelete.id); setCourseToDelete(null) }} onCancel={() => setCourseToDelete(null)} />
    </>
  )
}

function CreateCourseForm({ onClose, onCreated }: { onClose: () => void; onCreated: (course: Course) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: () => api<Course>('/admin/courses', { method: 'POST', body: JSON.stringify({ title, description }) }), onSuccess: onCreated, onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear') })
  return <form className="inline-create" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><div><strong>Nuevo curso</strong><button type="button" onClick={onClose}>Cerrar</button></div><label>Título<input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} autoFocus /></label><label>Descripción<textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={mutation.isPending}>Crear curso</button></form>
}

function EditCourseModal({
  course,
  onClose,
  onSave,
  isSaving,
}: {
  course: Course
  onClose: () => void
  onSave: (body: { title: string; description: string }) => void
  isSaving: boolean
}) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description ?? '')
  return <Modal title="Editar curso" onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave({ title, description }) }}>
      <label>Título<input value={title} onChange={e => setTitle(e.target.value)} required minLength={2} autoFocus /></label>
      <label>Descripción<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></label>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={isSaving}>Guardar cambios</button></div>
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
  const createSection = useMutation({ mutationFn: () => api(`/admin/courses/${course.id}/sections`, { method: 'POST', body: JSON.stringify({ title: sectionTitle, sortOrder: course.sections.length }) }), onSuccess: () => { setSectionTitle(''); refresh(); pushToast({ title: 'Sección creada', tone: 'success', message: sectionTitle }) } })
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
    <div className="builder-title"><h3>Estructura del curso</h3><span>Las lecciones se muestran en este orden.</span></div>
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
        <div className="section-title"><strong>{section.title}</strong></div>
        <div className="section-actions">
          <button type="button" className="section-toggle" onClick={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>{isOpen ? '▾' : '▸'}</button>
          <button type="button" onClick={() => setEditingSection({ id: section.id, title: section.title })}>Editar</button>
          <button type="button" onClick={() => setSectionToDelete({ id: section.id, title: section.title })}><Trash2 size={16} /></button>
        </div>
      </div>
      {isOpen && (
        <>
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
    <form className="add-section" onSubmit={(event) => { event.preventDefault(); createSection.mutate() }}><input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} placeholder="Nombre de la nueva sección" required minLength={2} /><button className="secondary-button"><Plus size={17} /> Agregar sección</button></form>
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
