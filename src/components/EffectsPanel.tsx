import React, { useMemo, useState } from 'react'
import type { Combatant, Effect, Encounter } from '../lib/types'
import { effectsForTarget } from '../lib/utils'
import { Modal } from './Modal'

function remainingRounds(encounter: Encounter, e: Effect): string {
  if (e.durationRounds == null) return '∞'
  const remaining = Math.max(0, (e.createdRound + e.durationRounds) - encounter.round)
  return String(remaining)
}

export function EffectsPanel(props: {
  encounter: Encounter
  combatant: Combatant
  onRemove: (effectId: string) => void
  onAdd: (payload: { name: string; durationRounds: number | null; concentration: boolean; notes?: string; targetIds: string[]; sourceId?: string }) => void
  onDropConcentration: (sourceId: string) => void
}) {
  const { encounter, combatant, onRemove, onAdd, onDropConcentration } = props
  const effects = useMemo(() => effectsForTarget(encounter, combatant.id), [encounter, combatant.id])
  const [openCast, setOpenCast] = useState(false)
  const [openCustom, setOpenCustom] = useState(false)
  const [selectedTargets, setSelectedTargets] = useState<string[]>([combatant.id])

  const toggleTarget = (id: string) => {
    setSelectedTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const quickDurations = [1, 2, 3, 10]
  const makeQuick = (name: string) => {
    onAdd({ name, durationRounds: 10, concentration: true, targetIds: selectedTargets, sourceId: combatant.id })
    setOpenCast(false)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold">Effects</div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => { setSelectedTargets([combatant.id]); setOpenCast(true) }}>
            Cast buff
          </button>
          <button className="btn btn-ghost" onClick={() => { setSelectedTargets([combatant.id]); setOpenCustom(true) }}>
            Add custom
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {effects.length === 0 ? <div className="text-sm text-white/60">No effects on this creature.</div> : null}

        {effects.map(e => (
          <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold">{e.name}</div>
                <div className="text-sm text-white/70">
                  Remaining: <span className="font-bold tabular-nums">{remainingRounds(encounter, e)}</span> rounds
                  {e.concentration ? <span className="ml-2 text-amber-200 font-semibold">• Concentration</span> : null}
                </div>
                {e.notes ? <div className="text-sm text-white/70 mt-1">{e.notes}</div> : null}
              </div>
              <button className="btn btn-ghost" onClick={() => onRemove(e.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {combatant.side !== 'Enemy' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-danger" onClick={() => onDropConcentration(combatant.id)}>
            Drop concentration (as {combatant.name})
          </button>
        </div>
      ) : null}

      <Modal
        title={`Cast buff as ${combatant.name}`}
        open={openCast}
        onClose={() => setOpenCast(false)}
        actions={null}
      >
        <div className="text-sm text-white/70">
          1) Pick targets  2) Tap a buff button
        </div>

        <div>
          <div className="font-bold mb-2">Targets</div>
          <div className="flex flex-wrap gap-2">
            {encounter.combatants.map(t => {
              const on = selectedTargets.includes(t.id)
              return (
                <button key={t.id} className={'pill ' + (on ? 'pill-on' : '')} onClick={() => toggleTarget(t.id)}>
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="font-bold mb-2">Buff library</div>
          {combatant.buffLibrary.length === 0 ? (
            <div className="text-sm text-white/60">
              No buffs saved for this creature yet. Add some in the Library tab.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {combatant.buffLibrary.map(b => (
                <button key={b} className="btn btn-primary" onClick={() => makeQuick(b)}>
                  {b}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 text-xs text-white/60">
            Quick-cast defaults to 10 rounds + concentration. Use “Add custom” for different durations.
          </div>
        </div>
      </Modal>

      <CustomEffectModal
        open={openCustom}
        onClose={() => setOpenCustom(false)}
        encounter={encounter}
        caster={combatant}
        selectedTargets={selectedTargets}
        setSelectedTargets={setSelectedTargets}
        onAdd={(payload) => { onAdd(payload); setOpenCustom(false) }}
      />
    </div>
  )
}

function CustomEffectModal(props: {
  open: boolean
  onClose: () => void
  encounter: Encounter
  caster: Combatant
  selectedTargets: string[]
  setSelectedTargets: (ids: string[]) => void
  onAdd: (payload: { name: string; durationRounds: number | null; concentration: boolean; notes?: string; targetIds: string[]; sourceId?: string }) => void
}) {
  const { open, onClose, encounter, caster, selectedTargets, setSelectedTargets, onAdd } = props
  const [name, setName] = useState('')
  const [duration, setDuration] = useState<number | null>(10)
  const [concentration, setConcentration] = useState(true)
  const [notes, setNotes] = useState('')

  const toggleTarget = (id: string) => {
    setSelectedTargets(selectedTargets.includes(id) ? selectedTargets.filter(x => x !== id) : [...selectedTargets, id])
  }

  const quickDurations = [1, 2, 3, 10]

  const submit = () => {
    onAdd({
      name: name.trim() || 'Effect',
      durationRounds: duration,
      concentration,
      notes: notes.trim() || undefined,
      targetIds: selectedTargets.length ? selectedTargets : [caster.id],
      sourceId: caster.id,
    })
    setName('')
    setNotes('')
  }

  return (
    <Modal
      title="Add effect"
      open={open}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Add</button>
        </>
      }
    >
      <div>
        <div className="font-bold mb-2">Targets</div>
        <div className="flex flex-wrap gap-2">
          {encounter.combatants.map(t => {
            const on = selectedTargets.includes(t.id)
            return (
              <button key={t.id} className={'pill ' + (on ? 'pill-on' : '')} onClick={() => toggleTarget(t.id)}>
                {t.name}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="font-bold mb-2">Name</div>
        <input
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bless"
        />
      </div>

      <div>
        <div className="font-bold mb-2">Duration (rounds)</div>
        <div className="flex flex-wrap gap-2">
          {quickDurations.map(n => (
            <button key={n} className={'btn ' + (duration === n ? 'btn-primary' : 'btn-ghost')} onClick={() => setDuration(n)}>
              {n}
            </button>
          ))}
          <button className={'btn ' + (duration === null ? 'btn-primary' : 'btn-ghost')} onClick={() => setDuration(null)}>
            ∞
          </button>
        </div>
        <div className="mt-2 text-xs text-white/60">
          Effects expire when you advance from the last creature back to the first (round change).
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} />
        <span className="font-bold">Concentration</span>
      </div>

      <div>
        <div className="font-bold mb-2">Notes (optional)</div>
        <textarea
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any reminder text…"
          rows={3}
        />
      </div>
    </Modal>
  )
}
