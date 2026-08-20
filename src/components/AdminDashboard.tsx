import { useQuery } from '@tanstack/react-query'
import { Activity, BookOpen, CheckCircle2, CircleDollarSign, Cloud, GraduationCap, HardDrive, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { api } from '../api/client'
import type { AwsCostReport, DashboardSummary } from '../types'
import { formatBytes } from '../utils/format'
import '../dashboard.css'
import type { ReactNode } from 'react'

const formatCost = (value: number, currency = 'USD') => {
  const absolute = Math.abs(value)
  const decimals = absolute > 0 && absolute < 0.0001 ? 6 : absolute > 0 && absolute < 0.01 ? 4 : 2
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

const monthName = (value: string) => new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)).replace('.', '')
const dateTime = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function AdminDashboard() {
  const summary = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api<DashboardSummary>('/admin/dashboard') })
  const costs = useQuery({ queryKey: ['admin-aws-costs'], queryFn: () => api<AwsCostReport>('/admin/dashboard/aws-costs'), retry: false })

  if (summary.isLoading) return <div className="dashboard-loading">{[1, 2, 3, 4].map(item => <div className="dashboard-metric skeleton" key={item} />)}</div>
  if (!summary.data) return <div className="empty-state dashboard-error"><strong>No pudimos cargar el resumen</strong><span>Las demás funciones administrativas siguen disponibles.</span><button onClick={() => summary.refetch()}>Intentar nuevamente</button></div>

  const data = summary.data
  return <div className="admin-dashboard">
    <div className="dashboard-metrics">
      <Metric icon={<Users />} tone="purple" label="Estudiantes activos" value={data.counts.students.active} detail={`${data.counts.students.total} cuentas · ${data.counts.students.activeLast7Days} activos esta semana`} />
      <Metric icon={<BookOpen />} tone="blue" label="Cursos publicados" value={data.counts.courses.published} detail={`${data.counts.courses.total} cursos · ${data.counts.sections} secciones`} />
      <Metric icon={<GraduationCap />} tone="green" label="Videos del catálogo" value={data.counts.lessons} detail={`${data.learning.completedRecords} progresos completados`} />
      <Metric icon={<HardDrive />} tone="orange" label="Almacenamiento S3" value={data.storage.available ? formatBytes(data.storage.totalBytes) : 'No disponible'} detail={data.storage.available ? `${data.storage.objectCount} archivos MP4` : 'No se pudo consultar el bucket'} />
    </div>

    <section className="dashboard-cost-panel">
      <div className="dashboard-panel-heading"><div><span className="dashboard-panel-icon aws"><CircleDollarSign /></span><span><strong>Costos reales de AWS</strong><small>Toda la cuenta · actualización diaria</small></span></div>{costs.data?.available && <span className="cost-updated">Actualizado {dateTime(costs.data.refreshedAt)}</span>}</div>
      {costs.isLoading ? <div className="cost-loading"><div className="loader" /><span>Consultando el último reporte guardado…</span></div> : costs.data?.available ? <CostDetails report={costs.data} /> : <CostUnavailable reason={costs.data?.reason ?? 'UNAVAILABLE'} />}
    </section>

    <div className="dashboard-two-columns">
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><span className="dashboard-panel-icon learning"><Activity /></span><span><strong>Aprendizaje</strong><small>Participación por curso</small></span></div><b className="completion-pill">{data.learning.completionRate}% completado</b></div>
        {data.learning.topCourses.length ? <div className="top-courses">{data.learning.topCourses.map((course, index) => <div className="top-course-row" key={course.id}><span>{index + 1}</span><div><strong>{course.title}</strong><small>{course.viewers} estudiante{course.viewers === 1 ? '' : 's'}</small></div><b>{course.completedLessons} <CheckCircle2 /></b></div>)}</div> : <div className="dashboard-empty">La actividad aparecerá cuando los estudiantes comiencen a reproducir videos.</div>}
      </section>
      <section className="dashboard-panel">
        <div className="dashboard-panel-heading"><div><span className="dashboard-panel-icon recent"><Cloud /></span><span><strong>Actividad reciente</strong><small>Últimos avances guardados</small></span></div></div>
        {data.learning.recentActivity.length ? <div className="recent-activity">{data.learning.recentActivity.map((activity, index) => <div className="activity-row" key={`${activity.userName}-${activity.lessonTitle}-${index}`}><span className={activity.completed ? 'activity-state done' : 'activity-state'}>{activity.completed ? <CheckCircle2 /> : <Activity />}</span><div><strong>{activity.userName}</strong><small>{activity.lessonTitle} · {activity.courseTitle}</small></div><time>{dateTime(activity.lastWatchedAt)}</time></div>)}</div> : <div className="dashboard-empty">Todavía no hay actividad de estudiantes.</div>}
      </section>
    </div>
  </div>
}

function Metric({ icon, tone, label, value, detail }: { icon: ReactNode; tone: string; label: string; value: string | number; detail: string }) {
  return <article className="dashboard-metric"><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>
}

function CostDetails({ report }: { report: Extract<AwsCostReport, { available: true }> }) {
  const maxMonth = Math.max(...report.monthly.map(item => Math.abs(item.amount)), 0.0001)
  const maxService = Math.max(...report.services.map(item => Math.abs(item.amount)), 0.0001)
  const changeUp = (report.changePercent ?? 0) > 0
  return <div className="cost-content">
    {report.stale && <div className="cost-warning">AWS no respondió; se muestra el último reporte disponible.</div>}
    <div className="cost-summary"><div><small>Mes actual</small><strong>{formatCost(report.currentMonth.amount, report.currency)}</strong><span>{report.currentMonth.estimated ? 'Importe estimado por AWS' : 'Importe consolidado'}</span></div><div><small>Mes anterior</small><strong>{formatCost(report.previousMonthAmount, report.currency)}</strong>{report.changePercent !== null && <span className={changeUp ? 'cost-change up' : 'cost-change down'}>{changeUp ? <TrendingUp /> : <TrendingDown />}{Math.abs(report.changePercent).toFixed(1)}%</span>}</div></div>
    <div className="cost-visuals">
      <div className="monthly-costs"><h3>Últimos seis meses</h3><div className="month-bars">{report.monthly.map(item => <div className="month-column" key={item.month}><div><i style={{ height: `${Math.max(3, (Math.abs(item.amount) / maxMonth) * 100)}%` }} title={formatCost(item.amount, report.currency)} /></div><span>{monthName(item.month)}</span></div>)}</div></div>
      <div className="service-costs"><h3>Servicios este mes</h3>{report.services.length ? report.services.slice(0, 6).map(service => <div className="service-cost" key={service.name}><div><span>{service.name}</span><strong>{formatCost(service.amount, report.currency)}</strong></div><i><b style={{ width: `${Math.max(2, (Math.abs(service.amount) / maxService) * 100)}%` }} /></i></div>) : <div className="dashboard-empty small">AWS todavía no reporta cargos para este mes.</div>}</div>
    </div>
  </div>
}

function CostUnavailable({ reason }: { reason: 'NOT_AUTHORIZED' | 'NOT_ENABLED' | 'UNAVAILABLE' }) {
  const message = reason === 'NOT_AUTHORIZED' ? 'El perfil AWS necesita el permiso ce:GetCostAndUsage.' : reason === 'NOT_ENABLED' ? 'Activa Cost Explorer una vez desde la consola de facturación de AWS.' : 'No fue posible consultar Cost Explorer en este momento.'
  return <div className="cost-unavailable"><CircleDollarSign /><div><strong>Costos aún no disponibles</strong><span>{message}</span><small>Las métricas de cursos y estudiantes no se ven afectadas.</small></div></div>
}
