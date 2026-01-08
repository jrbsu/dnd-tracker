import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = { id: string; message: string }

const ToastCtx = createContext<{ push: (msg: string) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string) => {
    const id = Math.random().toString(16).slice(2)
    setToasts(t => [...t, { id, message }])
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed z-50 left-3 right-3 bottom-3 safe-bottom flex gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-none card px-4 py-3 text-sm font-semibold">
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
