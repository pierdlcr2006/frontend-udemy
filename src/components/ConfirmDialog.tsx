import { type PropsWithChildren, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title = 'Confirmar acción',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: PropsWithChildren<ConfirmDialogProps>) {
  if (!open) return null

  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-card">
        <h3>{title}</h3>
        {description && <div className="confirm-desc">{description}</div>}
        <div className="confirm-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="primary-button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
