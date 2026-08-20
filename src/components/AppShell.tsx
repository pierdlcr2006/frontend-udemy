import { BookOpen, BookOpenText, LayoutDashboard, LogOut, Menu, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Brand } from './Brand'

export function AppShell({ children }: PropsWithChildren) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        queueMicrotask(() => openButtonRef.current?.focus())
      }
      if (event.key === 'Tab') {
        const focusable = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a, button:not([disabled])') ?? [])]
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  const doLogout = async () => {
    try {
      await logout()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Logout failed', err)
    } finally {
      navigate('/login')
    }
  }
  return (
    <div className="app-shell">
      <header className="mobile-shell-header">
        <Brand />
        <button ref={openButtonRef} type="button" aria-label="Abrir navegación" aria-expanded={mobileOpen} aria-controls="app-sidebar" onClick={() => setMobileOpen(true)}><Menu /></button>
      </header>
      <aside ref={sidebarRef} id="app-sidebar" className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand-row"><Brand /><button ref={closeButtonRef} type="button" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)}><X /></button></div>
        <nav aria-label="Navegación principal">
          <span className="nav-group-label">Aprender</span>
          <NavLink to="/library" end onClick={() => setMobileOpen(false)}><BookOpen size={19} /><span>Mi aprendizaje</span></NavLink>
          {user?.role === 'ADMIN' && <>
            <span className="nav-group-label admin-group">Administración</span>
            <NavLink to="/admin" end onClick={() => setMobileOpen(false)}><LayoutDashboard size={19} /><span>Resumen</span></NavLink>
            <NavLink to="/admin/courses" onClick={() => setMobileOpen(false)}><BookOpenText size={19} /><span>Cursos</span></NavLink>
            <NavLink to="/admin/users" onClick={() => setMobileOpen(false)}><Users size={19} /><span>Usuarios</span></NavLink>
          </>}
        </nav>
        <div className="sidebar-card">
          <Sparkles size={20} />
          <strong>Aprende a tu ritmo</strong>
          <span>Tu avance se guarda automáticamente.</span>
        </div>
        <button className="user-menu" onClick={doLogout}>
          <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
          <span><strong>{user?.name}</strong><small>{user?.role === 'ADMIN' ? 'Administrador' : 'Estudiante'}</small></span>
          <LogOut size={17} />
        </button>
      </aside>
      {mobileOpen && <button type="button" className="sidebar-overlay" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} />}
      <main className="main-content"><div className="content-frame">{children}</div></main>
    </div>
  )
}
