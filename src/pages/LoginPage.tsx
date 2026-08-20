import { ArrowRight, BookOpenCheck, Clock3, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { Brand } from '../components/Brand'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const logged = await login(email, password)
      navigate(logged.role === 'ADMIN' ? '/admin' : '/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-showcase">
        <Brand />
        <div className="showcase-copy">
          <span className="pill">Tu espacio personal de aprendizaje</span>
          <h1>Aprende sin perder el <em>hilo.</em></h1>
          <p>Continúa cada curso exactamente donde lo dejaste. Tu avance siempre estará listo para ti.</p>
          <div className="feature-row">
            <span><Clock3 /> Retoma al instante</span>
            <span><BookOpenCheck /> Progreso claro</span>
            <span><ShieldCheck /> Videos seguros</span>
          </div>
        </div>
        <div className="showcase-orbit orbit-one" /><div className="showcase-orbit orbit-two" />
      </section>
      <section className="login-form-panel">
        <form onSubmit={submit}>
          <span className="eyebrow">Bienvenido de nuevo</span>
          <h2>Ingresa a tu aula</h2>
          <p className="muted">Usa la cuenta creada por tu administrador.</p>
          <label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required autoFocus /></label>
          <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength={8} /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? 'Ingresando…' : <>Ingresar <ArrowRight size={18} /></>}</button>
          <small className="privacy-note"><ShieldCheck size={14} /> Sesión protegida mediante una cookie segura.</small>
        </form>
      </section>
    </div>
  )
}
