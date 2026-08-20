import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminCoursesPage, AdminDashboardPage, AdminUsersPage } from './pages/AdminPage'
import { AdminLayout } from './pages/AdminLayout'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'

const CoursePage = lazy(() => import('./pages/CoursePage').then(module => ({ default: module.CoursePage })))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/curso/:courseId/:lessonId?" element={<Suspense fallback={<div className="splash dark"><div className="loader" />Preparando reproductor…</div>}><CoursePage /></Suspense>} />
      </Route>
      <Route element={<ProtectedRoute admin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="courses" element={<AdminCoursesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
