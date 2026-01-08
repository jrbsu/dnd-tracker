import React, { useMemo, useState } from 'react'
import type { Combatant, Encounter } from '../lib/types'
import { HpControls } from './HpControls'
import { ConditionsPanel } from './ConditionsPanel'
import { EffectsPanel } from './EffectsPanel'
import { ResistancesPanel } from './ResistancesPanel'
import { Modal } from './Modal'
import { InitiativePicker } from './InitiativePicker'
import { BumpPad, BumpPadOptional } from './BumpPad'

export function DetailsPanel(props: {
  encounter: Encounter
  combatant: Combatant | null
  onRemoveCombatant: (id: string) => void
  onUpdateCombatant: (id: string, patch: Partial<Combatant>) => void
  onSaveTemplate?: (combatant: Combatant) => void
  onDamage: (id: string, amount: number, damageType: import('../lib/types').DamageType | null) => void
  onHeal: (id: string, amount: number) => void
  onSetHp: (id: string, hp: number) => void
  onSetTemp: (id: string, temp: number) => void
  onToggleCondition: (id: string, condition: string) => void
  onCycleResistance: (id: string, dt: import('../lib/types').DamageType) => void
  onAddEffect: (payload: { name: string; durationRounds: number | null; concentration: boolean; notes?: string; targetIds: string[]; sourceId?: string }) => void
  onRemoveEffect: (id: string) => void
  onDropConcentration: (sourceId: string) => void
}) {
  const {
    encounter,
    combatant,
    onRemoveCombatant,
    onUpdateCombatant,
    onSaveTemplate,
    onDamage,
    onHeal,
    onSetHp,
    onSetTemp,
    onToggleCondition,
    onCycleResistance,
    onAddEffect,
    onRemoveEffect,
    onDropConcentration,
  } = props

  const [openEdit, setOpenEdit] = useState(false)
  const [name, setName] = useState('')
  const [initiative, setInitiative] = useState<number>(10)
  const [initiativeSet, setInitiativeSet] = useState<boolean>(true)
  const [maxHP, setMaxHP] = useState<number>(10)
  const [ac, setAc] = useState<number | ''>('')
  const [url, setUrl] = useState<string>('')

  const startEdit = () => {
    if (!combatant) return
    setName(combatant.name)
    setInitiativeSet(combatant.initiative != null)
    setInitiative(combatant.initiative ?? 10)
    setMaxHP(combatant.maxHP)
    setAc(combatant.ac ?? '')
    setUrl(combatant.url ?? '')
    setOpenEdit(true)
  }

  const saveEdit = () => {
    if (!combatant) return
    const nextMax = Math.max(1, Math.floor(Number(maxHP)))
    const nextAc = ac === '' ? undefined : Math.floor(Number(ac))
    // If max HP is reduced, clamp current HP so we don't end up with hp > max.
    const maybeClampHp = nextMax < combatant.maxHP ? { hp: Math.min(combatant.hp, nextMax) } : {}

    onUpdateCombatant(combatant.id, {
      name: name.trim() || combatant.name,
      initiative: initiativeSet ? Math.floor(Number(initiative)) : null,
      maxHP: nextMax,
      ac: nextAc,
      url: url.trim() || undefined,
      ...maybeClampHp,
    })
    setOpenEdit(false)
  }

  if (!combatant) {
    return (
      <div className="card p-4">
        <div className="text-white/70">Select a combatant to view details.</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-white/60">{combatant.side}</div>
            <div className="text-2xl font-extrabold truncate">{combatant.name}</div>
            <div className="text-sm text-white/70">
              Init <span className="font-bold tabular-nums">{combatant.initiative ?? '—'}</span>
              {combatant.ac != null ? <span className="ml-3">AC <span className="font-bold tabular-nums">{combatant.ac}</span></span> : null}
            </div>
            {combatant.url ? (
              <a
                href={combatant.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline text-white/80 hover:text-white"
              >
                Open reference ↗
              </a>
            ) : null}
          </div>
          <div className="flex gap-2">
            {onSaveTemplate ? (
              <button className="btn btn-ghost" onClick={() => onSaveTemplate(combatant)} type="button">
                Save template
              </button>
            ) : null}
            <button className="btn btn-ghost" onClick={startEdit}>Edit</button>
            <button className="btn btn-danger" onClick={() => onRemoveCombatant(combatant.id)}>Remove</button>
          </div>
        </div>
      </div>

      {combatant && combatant.side !== 'Enemy' && combatant.hp === 0 && combatant.status !== 'dead' ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="font-extrabold mb-2">Death saving throws</div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm">
              ✅ <span className="font-bold tabular-nums">{combatant.deathSaveSuccesses ?? 0}</span> / 3
            </div>
            <div className="text-sm">
              ❌ <span className="font-bold tabular-nums">{combatant.deathSaveFailures ?? 0}</span> / 3
            </div>
            {combatant.status === 'stable' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-200">STABLE</span>
            ) : null}
            {combatant.deathSaveFailures === 3 ? (
              <span className="text-xs px-2 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-200">DEAD</span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => {
                const s = Math.min(3, (combatant.deathSaveSuccesses ?? 0) + 1)
                const f = combatant.deathSaveFailures ?? 0
                onUpdateCombatant(combatant.id, {
                  deathSaveSuccesses: s,
                  deathSaveFailures: f,
                  status: s >= 3 ? 'stable' : 'down',
                })
              }}
              type="button"
            >
              + Success
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => {
                const s = combatant.deathSaveSuccesses ?? 0
                const f = Math.min(3, (combatant.deathSaveFailures ?? 0) + 1)
                onUpdateCombatant(combatant.id, {
                  deathSaveSuccesses: s,
                  deathSaveFailures: f,
                  status: f >= 3 ? 'dead' : 'down',
                })
              }}
              type="button"
            >
              + Failure
            </button>

            <button
              className="btn btn-ghost"
              onClick={() => onUpdateCombatant(combatant.id, {
                deathSaveSuccesses: 0,
                deathSaveFailures: 0,
                status: 'down',
              })}
              type="button"
            >
              Reset
            </button>
          </div>

          <div className="mt-2 text-xs text-white/60">
            Healing above 0 HP automatically clears death saves.
          </div>
        </div>
      ) : null}

      <HpControls
        combatant={combatant}
        onDamage={(amt, dt) => onDamage(combatant.id, amt, dt)}
        onHeal={(amt) => onHeal(combatant.id, amt)}
        onSetHp={(hp) => onSetHp(combatant.id, hp)}
        onSetTemp={(t) => onSetTemp(combatant.id, t)}
      />

      <ConditionsPanel
        combatant={combatant}
        onToggle={(cond) => onToggleCondition(combatant.id, cond)}
      />

      <ResistancesPanel
        combatant={combatant}
        onCycle={(dt) => onCycleResistance(combatant.id, dt)}
      />

      <EffectsPanel
        encounter={encounter}
        combatant={combatant}
        onRemove={onRemoveEffect}
        onAdd={(payload) => onAddEffect(payload)}
        onDropConcentration={onDropConcentration}
      />

      <Modal
        title="Edit combatant"
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setOpenEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit}>Save</button>
          </>
        }
      >
        <div>
          <div className="font-bold mb-2">Name</div>
          <input className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="font-bold mb-2">Reference link (optional)</div>
          <input
            className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-bold mb-2">Initiative</div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input type="checkbox" checked={initiativeSet} onChange={(e) => setInitiativeSet(e.target.checked)} />
                Set initiative
              </label>
              {!initiativeSet ? <span className="text-xs text-white/60">(shows in “Needs initiative”)</span> : null}
            </div>
            {initiativeSet ? <InitiativePicker value={initiative} onChange={setInitiative} /> : null}
          </div>
          <div>
            <div className="font-bold mb-2">Max HP</div>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
              value={maxHP}
              onChange={(e) => {
                const v = e.target.value
                if (v === '') return
                setMaxHP(Math.max(1, Math.floor(Number(v))))
              }}
            />
            <div className="mt-2">
              <BumpPad value={maxHP} onChange={setMaxHP} min={1} />
            </div>
          </div>
        </div>
        <div>
          <div className="font-bold mb-2">AC</div>
          <input type="number" className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
            value={ac} onChange={(e) => setAc(e.target.value === '' ? '' : Number(e.target.value))} />
          <div className="mt-2">
            <BumpPadOptional value={ac} onChange={setAc} min={0} baseline={10} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
