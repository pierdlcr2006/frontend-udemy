import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="splash"><div className="loader" />Preparando tu aula…</div>
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />
  if (admin && user.role !== 'ADMIN') return <Navigate to="/library" replace />
  return <Outlet />
}
