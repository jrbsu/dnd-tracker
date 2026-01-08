import React from 'react'

const PRESETS = [1, 5, 10, 20]

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

/**
 * Touch-first +/- pad using the same increments as live HP controls.
 */
export function BumpPad(props: {
  value: number
  onChange: (value: number) => void
  min?: number
}) {
  const { value, onChange, min = 0 } = props

  const bump = (delta: number) => {
    const next = clampInt(value + delta)
    onChange(Math.max(min, next))
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card p-3">
        <div className="font-extrabold mb-2">-</div>
        <div className="grid grid-cols-2 gap-2">
          {[...PRESETS].reverse().map((n) => (
            <button key={n} type="button" className="btn btn-danger text-lg" onClick={() => bump(-n)}>
              -{n}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-3">
        <div className="font-extrabold mb-2">+</div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((n) => (
            <button key={n} type="button" className="btn btn-primary text-lg" onClick={() => bump(+n)}>
              +{n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Optional numeric value with the same bump pad. If the value is blank, bumps start from `baseline`.
 */
export function BumpPadOptional(props: {
  value: number | ''
  onChange: (value: number | '') => void
  min?: number
  baseline?: number
  showClear?: boolean
}) {
  const { value, onChange, min = 0, baseline = 10, showClear = true } = props

  const resolved = value === '' ? baseline : value

  const bump = (delta: number) => {
    const next = clampInt(resolved + delta)
    onChange(Math.max(min, next))
  }

  return (
    <div className="space-y-2">
      {showClear ? (
        <div className="flex justify-end">
          <button type="button" className="btn btn-ghost" onClick={() => onChange('')}>Clear</button>
        </div>
      ) : null}
      <BumpPad value={resolved} onChange={(v) => onChange(v)} min={min} />
      {value === '' ? (
        <div className="text-xs text-white/60">
          Tip: AC is blank; bumping starts from {baseline}.
        </div>
      ) : null}
    </div>
  )
}
