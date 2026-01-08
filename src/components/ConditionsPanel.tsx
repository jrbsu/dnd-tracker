import React from 'react'
import type { Combatant } from '../lib/types'
import { COMMON_CONDITIONS } from '../lib/utils'

export function ConditionsPanel(props: {
  combatant: Combatant
  onToggle: (condition: string) => void
}) {
  const { combatant, onToggle } = props
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-extrabold">Conditions</div>
        <div className="text-sm text-white/60">{combatant.conditions.length} active</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {COMMON_CONDITIONS.map(c => {
          const on = combatant.conditions.includes(c)
          return (
            <button
              key={c}
              className={'pill ' + (on ? 'pill-on' : '')}
              onClick={() => onToggle(c)}
            >
              {c}
            </button>
          )
        })}
      </div>
    </div>
  )
}
