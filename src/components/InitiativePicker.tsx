import { rollDiceExpression } from '../lib/dice'

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

export function InitiativePicker(props: {
  value: number
  onChange: (v: number) => void
  showRoll?: boolean
}) {
  const { value, onChange, showRoll = false } = props

  const rollD20 = () => {
    const r = rollDiceExpression('d20').total
    onChange(clampInt(r))
  }

  const bump = (delta: number) => {
    onChange(clampInt(value) + delta)
  }

  return (
    <div className="space-y-2">
      {showRoll ? (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-white/70">
            Tap 🎲 then adjust with buttons if needed
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={rollD20}
            title="Roll 1d20"
          >
            🎲 d20
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            className={'btn ' + (value === n ? 'btn-primary' : 'btn-ghost')}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-white/70">
          Current: <span className="font-medium text-white">{clampInt(value)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => bump(-1)}
            title="Decrease initiative by 1"
          >
            −1
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => bump(+1)}
            title="Increase initiative by 1"
          >
            +1
          </button>
        </div>
      </div>
    </div>
  )
}