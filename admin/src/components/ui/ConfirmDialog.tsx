import { Modal } from './Modal'
import { Button } from './Button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose?: () => void
  /** alias for onClose, kept for older call sites */
  onCancel?: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  variant?: 'danger' | 'warning' | 'primary'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  isLoading,
  variant = 'danger',
}: ConfirmDialogProps) {
  const handleClose = onClose ?? onCancel ?? (() => {})
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'warning' ? 'secondary' : variant === 'primary' ? 'gold' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            className={variant === 'warning' ? 'border-yellow-500 text-yellow-600' : ''}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div
          className={
            variant === 'danger'
              ? 'w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center'
              : variant === 'primary'
              ? 'w-12 h-12 rounded-full bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center'
              : 'w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center'
          }
        >
          <AlertTriangle
            className={
              variant === 'danger' ? 'w-6 h-6 text-red-600' : variant === 'primary' ? 'w-6 h-6 text-gold-600' : 'w-6 h-6 text-yellow-600'
            }
          />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        </div>
      </div>
    </Modal>
  )
}
