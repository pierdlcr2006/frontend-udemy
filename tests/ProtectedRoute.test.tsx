import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '../src/components/ProtectedRoute'

const auth = vi.hoisted(() => ({
  user: { id: 'student-1', name: 'Sol', email: 'sol@example.com', role: 'STUDENT' as const },
  loading: false,
}))

vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }))

describe('ProtectedRoute', () => {
  it('redirige a un estudiante que intenta abrir una ruta administrativa', async () => {
    render(<MemoryRouter initialEntries={['/admin/courses']}><Routes>
      <Route path="/library" element={<div>Mi aprendizaje</div>} />
      <Route element={<ProtectedRoute admin />}><Route path="/admin/courses" element={<div>Editor de cursos</div>} /></Route>
    </Routes></MemoryRouter>)
    expect(await screen.findByText('Mi aprendizaje')).toBeInTheDocument()
    expect(screen.queryByText('Editor de cursos')).not.toBeInTheDocument()
  })
})
