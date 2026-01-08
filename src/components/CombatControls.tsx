import React from 'react'

export function CombatControls(props: {
  onPrev: () => void
  onNext: () => void
  onAdd: () => void
}) {
  const { onPrev, onNext, onAdd } = props
  return (
    <div className="fixed left-0 right-0 bottom-0 z-40 safe-bottom">
      <div className="mx-auto max-w-6xl px-3 pb-3">
        <div className="card p-3 flex items-center justify-between gap-3">
          <button className="btn btn-ghost text-lg" onClick={onPrev}>◀ Prev</button>
          <button className="btn btn-primary text-lg flex-1" onClick={onNext}>Next ▶</button>
          <button className="btn btn-ghost text-lg" onClick={onAdd}>+ Add</button>
        </div>
      </div>
    </div>
  )
}
