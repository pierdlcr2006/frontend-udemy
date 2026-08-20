/* eslint-disable react-refresh/only-export-components */
import { Check, X, Trash2 } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'

type ToastTone = 'success' | 'danger'

export type ToastInput = {
  title: string
  message?: string
  tone?: ToastTone
}

type Toast = ToastInput & {
  id: string
  tone: ToastTone
}

type ToastContextValue = {
  pushToast: (toast: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<number[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const pushToast = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID()
    const nextToast: Toast = { id, tone: toast.tone ?? 'success', title: toast.title, message: toast.message }
    setToasts(current => [...current, nextToast])
    const timer = window.setTimeout(() => removeToast(id), 3000)
    timers.current.push(timer)
  }, [removeToast])

  useEffect(() => () => {
    timers.current.forEach(timer => window.clearTimeout(timer))
    timers.current = []
  }, [])

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <article key={toast.id} className={`toast-card ${toast.tone}`}>
            <div className="toast-icon">
              {toast.tone === 'danger' ? <Trash2 size={16} /> : <Check size={16} />}
            </div>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button type="button" className="toast-close" aria-label="Cerrar alerta" onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider')
  return value
}