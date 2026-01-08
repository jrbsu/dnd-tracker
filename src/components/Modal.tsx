import React, { useEffect } from 'react'

export function Modal(props: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  const { title, open, onClose, children, actions } = props

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/*
        Scrollable modal body with a fixed header and fixed action row.
        This prevents long forms from pushing the Save/Add buttons off-screen on iPad.
      */}
      <div className="relative w-full max-w-2xl card p-4 md:p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-lg font-bold">{title}</div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4 space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">{children}</div>
        {actions ? (
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-3 justify-end flex-shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
