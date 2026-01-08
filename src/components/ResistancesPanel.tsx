import React from 'react'
import type { Combatant, DamageType } from '../lib/types'
import { DAMAGE_TYPES } from '../lib/utils'
import { DAMAGE_TYPE_ICON } from '../lib/damageIcons'
import { formatResistance } from '../lib/reducer'
import type { ResistanceKind } from '../lib/types'

function resistanceBtnTint(kind?: ResistanceKind): string {
  switch (kind ?? 'normal') {
    case 'resist':
      return '!bg-amber-600/50 !border-amber-700/30 !text-amber-100 hover:!bg-amber-600/40'
    case 'vuln':
      return '!bg-sky-600/50 !border-sky-700/30 !text-sky-100 hover:!bg-sky-600/40'
    case 'immune':
      return '!bg-rose-600/50 !border-rose-700/30 !text-rose-100 hover:!bg-rose-600/40'
    default:
      return '!bg-white/5 !border-white/10 !text-white/90 hover:!bg-white/10'
  }
}

export function ResistancesPanel(props: {
  combatant: Combatant
  onCycle: (dt: DamageType) => void
}) {
  const { combatant, onCycle } = props
  return (
    <div className="card p-4">
      <div className="font-extrabold">Resistances</div>
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
        {DAMAGE_TYPES.map(dt => {
          const kind = combatant.resistances[dt] ?? 'normal'
          const label = formatResistance(kind)
          const on = kind !== 'normal'
          return (
            <button
              key={dt}
              className={'btn ' + (on ? 'btn-primary' : 'btn-ghost') + ' ' + resistanceBtnTint(kind)}
              onClick={() => onCycle(dt)}
              title={`${dt}: ${kind}`}
            >
              <span className="text-xs font-extrabold">{DAMAGE_TYPE_ICON[dt]}</span>
              <span className="ml-2 text-xs opacity-90">{label}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-xs text-white/60">
        Tap to cycle: normal → resist → vuln → immune.
      </div>
    </div>
  )
}
