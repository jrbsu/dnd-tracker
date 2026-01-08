import React, { useMemo, useState } from 'react'
import type { Combatant, DamageType } from '../lib/types'
import { DAMAGE_TYPES, applyResistanceToDamage, getResistanceKind } from '../lib/utils'
import { DAMAGE_TYPE_ICON } from '../lib/damageIcons'

const DMG_PRESETS = [1, 5, 10, 20]
const HEAL_PRESETS = [1, 5, 10, 20]
const DT_BUTTONS: (DamageType | null)[] = [null, 'slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning', 'necrotic', 'radiant', 'poison', 'psychic', 'force', 'acid', 'thunder']

function shortDt(dt: DamageType | null): string {
  if (!dt) return 'No type'
  return DAMAGE_TYPE_ICON[dt] ?? dt.slice(0, 3).toUpperCase()
}

export function HpControls(props: {
  combatant: Combatant
  onDamage: (amount: number, damageType: DamageType | null) => void
  onHeal: (amount: number) => void
  onSetHp: (hp: number) => void
  onSetTemp: (temp: number) => void
}) {
  const { combatant, onDamage, onHeal, onSetHp, onSetTemp } = props
  const [damageType, setDamageType] = useState<DamageType | null>(null)

  const preview = useMemo(() => {
    const kind = getResistanceKind(combatant, damageType)
    const sample = 10
    return { kind, sampleFinal: applyResistanceToDamage(sample, kind) }
  }, [combatant, damageType])

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/70">HP</div>
          <div className="text-3xl font-extrabold tabular-nums">
            {combatant.hp} <span className="text-white/50 text-xl">/ {combatant.maxHP}</span>
          </div>
          {combatant.tempHP > 0 ? (
            <div className="mt-1 text-sm text-sky-200">
              Temp HP: <span className="font-bold tabular-nums">{combatant.tempHP}</span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-white/60">Temp HP: 0</div>
          )}
        </div>

        <div className="text-right text-xs text-white/60">
          {damageType ? (
            <div>
              {damageType}: <span className="font-bold">{preview.kind}</span><br />
              (10 → <span className="font-bold tabular-nums">{preview.sampleFinal}</span>)
            </div>
          ) : (
            <div>No damage type</div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm font-bold mb-2">Damage type</div>
        <div className="flex flex-wrap gap-2">
          {DT_BUTTONS.map(dt => (
            <button
              key={dt ?? 'none'}
              className={'btn ' + (dt === damageType ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setDamageType(dt)}
            >
              {shortDt(dt)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="font-extrabold mb-2">Damage</div>
          <div className="grid grid-cols-2 gap-2">
            {DMG_PRESETS.map(n => (
              <button key={n} className="btn btn-danger text-lg" onClick={() => onDamage(n, damageType)}>
                -{n}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-3">
          <div className="font-extrabold mb-2">Heal</div>
          <div className="grid grid-cols-2 gap-2">
            {HEAL_PRESETS.map(n => (
              <button key={n} className="btn btn-primary text-lg" onClick={() => onHeal(n)}>
                +{n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="btn btn-ghost" onClick={() => onSetHp(combatant.maxHP)}>Set HP to Max</button>
        <button className="btn btn-ghost" onClick={() => onSetHp(0)}>Set HP to 0</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-ghost" onClick={() => onSetTemp(0)}>Clear Temp HP</button>
        <button className="btn btn-ghost" onClick={() => onSetTemp(combatant.tempHP + 5)}>Temp +5</button>
        <button className="btn btn-ghost" onClick={() => onSetTemp(combatant.tempHP + 10)}>Temp +10</button>
      </div>
    </div>
  )
}
