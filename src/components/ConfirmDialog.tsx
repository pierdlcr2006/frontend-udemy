import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title = 'Confirmar acción', description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = 'confirm-dialog-title'
  const descriptionId = 'confirm-dialog-description'

  useEffect(() => {
    if (!open) return
    const previousActive = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select, a[href]') ?? [])]
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    queueMicrotask(() => cancelRef.current?.focus())
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); previousActive?.focus() }
  }, [onCancel, open])

  if (!open) return null
  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
      <div ref={dialogRef} className={variant === 'danger' ? 'confirm-card danger' : 'confirm-card'} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} onMouseDown={event => event.stopPropagation()}>
        <div className="confirm-header">
          <span className="confirm-icon"><AlertTriangle size={20} /></span>
          <div><span className="confirm-kicker">Confirmación</span><h3 id={titleId}>{title}</h3></div>
          <button type="button" className="confirm-close" aria-label="Cerrar diálogo" onClick={onCancel}><X size={18} /></button>
        </div>
        {description && <div id={descriptionId} className="confirm-desc">{description}</div>}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={variant === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
