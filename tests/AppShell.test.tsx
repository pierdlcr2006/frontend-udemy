import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from '../src/components/AppShell'

const auth = vi.hoisted(() => ({
  user: { id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'ADMIN' as const },
  loading: false,
  logout: vi.fn(async () => undefined),
  login: vi.fn(),
}))

vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }))

function renderShell(path = '/admin/courses', children: ReactNode = <div>Contenido</div>) {
  return render(<MemoryRouter initialEntries={[path]}><AppShell>{children}</AppShell></MemoryRouter>)
}

describe('AppShell', () => {
  it('expone rutas administrativas independientes y marca la ruta activa', () => {
    renderShell()
    expect(screen.getByRole('link', { name: /mi aprendizaje/i })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: /resumen/i })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: /cursos/i })).toHaveAttribute('href', '/admin/courses')
    expect(screen.getByRole('link', { name: /usuarios/i })).toHaveAttribute('href', '/admin/users')
    expect(screen.getByRole('link', { name: /cursos/i })).toHaveClass('active')
    expect(screen.getByRole('link', { name: /resumen/i })).not.toHaveClass('active')
  })

  it('abre el drawer, mueve el foco y lo cierra con Escape', () => {
    renderShell('/')
    const opener = screen.getByRole('button', { name: /abrir navegación/i })
    fireEvent.click(opener)
    expect(opener).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('button', { name: /cerrar navegación/i })[0]).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    expect(document.body.style.overflow).toBe('')
  })

  it('oculta toda la administración a estudiantes', () => {
    auth.user = { id: 'student-1', name: 'Sol Student', email: 'sol@example.com', role: 'STUDENT' }
    renderShell('/')
    expect(screen.queryByText('Administración')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /resumen/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /cursos/i })).not.toBeInTheDocument()
    auth.user = { id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'ADMIN' }
  })
})
