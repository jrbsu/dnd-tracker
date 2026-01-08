import React from 'react'
import type { Combatant, Encounter } from '../lib/types'
import { buildPendingGroups, buildTurnGroups, effectsForTarget } from '../lib/utils'

function sideBadge(side: Combatant['side'] | 'Mixed'): string {
  switch (side) {
    case 'PC': return 'bg-lime-500/20 text-lime-200 border-lime-500/30'
    case 'Enemy': return 'bg-rose-500/20 text-rose-200 border-rose-500/30'
    case 'NPC': return 'bg-sky-500/20 text-sky-200 border-sky-500/30'
    default: return 'bg-white/10 text-white/80 border-white/15'
  }
}

function EffectChips(props: { encounter: Encounter; targetId: string }) {
  const { encounter, targetId } = props
  const effects = effectsForTarget(encounter, targetId)
  const uniq = Array.from(new Set(effects.map(e => e.name)))
  const effectNames = uniq.slice(0, 2)
  const extraCount = Math.max(0, uniq.length - effectNames.length)
  if (effectNames.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1 min-w-0">
      {effectNames.map(n => (
        <span key={n} className="text-[11px] border border-white/10 bg-white/10 px-2 py-0.5 rounded-full">
          {n}
        </span>
      ))}
      {extraCount > 0 ? (
        <span className="text-[11px] border border-white/10 bg-white/10 px-2 py-0.5 rounded-full">
          +{extraCount}
        </span>
      ) : null}
    </span>
  )
}

function sameInitiative(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return a === b
}

export function InitiativeList(props: {
  encounter: Encounter
  onSelect: (id: string) => void
  onSetInitiative: (ids: string[]) => void
  onMoveWithinTie: (id: string, dir: -1 | 1) => void
}) {
  const { encounter, onSelect, onSetInitiative, onMoveWithinTie } = props
  const byId = new Map(encounter.combatants.map(c => [c.id, c]))
  const groups = buildTurnGroups(encounter.combatants)
  const pending = buildPendingGroups(encounter.combatants)
  const dead = encounter.combatants.filter(c => c.status === 'dead')

  const activeKey = (encounter.turnGroupKey && groups.some(g => g.key === encounter.turnGroupKey))
    ? encounter.turnGroupKey
    : groups[0]?.key

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-extrabold">Initiative</div>
        <div className="text-sm text-white/70">Round {encounter.round}</div>
      </div>

      <div className="space-y-2">
        {groups.length === 0 ? (
          <div className="text-white/70 text-sm">
            Add combatants to start. (You can add them with initiative set later.)
          </div>
        ) : null}

        {groups.map((g, groupIdx) => {
          const isActiveGroup = g.key === activeKey
          const members = g.memberIds.map(id => byId.get(id)).filter(Boolean) as Combatant[]
          const side = g.sides.size === 1 ? (Array.from(g.sides)[0] as Combatant['side']) : 'Mixed'

          // tie-move checks (compare to adjacent initiative rows)
          const prev = groups[groupIdx - 1]
          const next = groups[groupIdx + 1]
          const canMoveUp = !!prev && sameInitiative(prev.initiative, g.initiative)
          const canMoveDown = !!next && sameInitiative(next.initiative, g.initiative)

          // SOLO
          if (members.length === 1) {
            const c = members[0]
            const isSelected = c.id === encounter.selectedId
            const rowId = c.id

            return (
              <div key={g.key} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={
                    'w-full text-left rounded-2xl border px-3 py-3 transition ' +
                    (isActiveGroup ? 'bg-lime-500/25 border-lime-400/40' : 'bg-white/5 border-white/10 hover:bg-white/10') +
                    (isSelected ? ' ring-2 ring-white/70' : '')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold tabular-nums w-8">{c.initiative ?? '—'}</span>
                        <span className="font-bold truncate">{c.name}</span>
                        <EffectChips encounter={encounter} targetId={c.id} />
                        <span className={'text-xs border px-2 py-1 rounded-full ' + sideBadge(c.side)}>{c.side}</span>
                      </div>
                      <div className="mt-1 text-sm text-white/75">
                        HP <span className="font-bold tabular-nums">{c.hp}</span> / {c.maxHP}
                        {c.tempHP > 0 ? <span className="ml-2">Temp <span className="font-bold tabular-nums">{c.tempHP}</span></span> : null}
                        {c.conditions.length ? <span className="ml-2 text-amber-200">• {c.conditions.join(', ')}</span> : null}
                      </div>
                    </div>
                    <div className="text-xs text-white/60 tabular-nums">#{groupIdx + 1}</div>
                  </div>
                </button>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost !px-2 !py-1"
                    onClick={() => onMoveWithinTie(rowId, -1)}
                    disabled={!canMoveUp}
                    title="Move earlier within same initiative"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !px-2 !py-1"
                    onClick={() => onMoveWithinTie(rowId, 1)}
                    disabled={!canMoveDown}
                    title="Move later within same initiative"
                  >
                    ↓
                  </button>
                </div>
              </div>
            )
          }

          // GROUP (shared initiative)
          const rowId = members[0]?.id

          return (
            <div
              key={g.key}
              className={
                'rounded-2xl border overflow-hidden ' +
                (isActiveGroup ? 'bg-lime-500/15 border-lime-400/35' : 'bg-white/5 border-white/10')
              }
            >
              <div className="flex items-stretch gap-2 px-3 py-3">
                <button
                  type="button"
                  onClick={() => members[0] && onSelect(members[0].id)}
                  className="flex-1 text-left hover:bg-white/5 transition rounded-xl px-2 py-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold tabular-nums w-8">{g.initiative}</span>
                      <span className="font-extrabold truncate">{g.label}</span>
                      <span className="text-xs border px-2 py-1 rounded-full bg-white/10 border-white/10">
                        ×{members.length}
                      </span>
                      <span className={'text-xs border px-2 py-1 rounded-full ' + sideBadge(side)}>{side}</span>
                    </div>
                    <div className="text-xs text-white/60 tabular-nums">#{groupIdx + 1}</div>
                  </div>
                </button>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost !px-2 !py-1"
                    onClick={() => rowId && onMoveWithinTie(rowId, -1)}
                    disabled={!rowId || !canMoveUp}
                    title="Move earlier within same initiative"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !px-2 !py-1"
                    onClick={() => rowId && onMoveWithinTie(rowId, 1)}
                    disabled={!rowId || !canMoveDown}
                    title="Move later within same initiative"
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10">
                {members.map((c) => {
                  const isSelected = c.id === encounter.selectedId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={
                        'w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition ' +
                        (isSelected ? 'bg-white/10' : 'hover:bg-white/5')
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate">{c.name}</span>
                          <EffectChips encounter={encounter} targetId={c.id} />
                          {c.conditions.length ? <span className="text-[11px] text-amber-200">• {c.conditions.join(', ')}</span> : null}
                        </div>
                        <div className="text-sm text-white/75">
                          HP <span className="font-bold tabular-nums">{c.hp}</span> / {c.maxHP}
                          {c.tempHP > 0 ? <span className="ml-2">Temp <span className="font-bold tabular-nums">{c.tempHP}</span></span> : null}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {pending.length ? (
          <div className="pt-2">
            <div className="text-xs text-white/60 font-bold mb-2">Needs initiative</div>
            <div className="space-y-2">
              {pending.map((g) => {
                const members = g.memberIds.map(id => byId.get(id)).filter(Boolean) as Combatant[]
                const side = g.sides.size === 1 ? (Array.from(g.sides)[0] as Combatant['side']) : 'Mixed'
                const label = members.length === 1 ? members[0].name : g.label
                return (
                  <div key={g.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-extrabold tabular-nums w-8">—</span>
                          <span className="font-bold truncate">{label}</span>
                          {members.length > 1 ? (
                            <span className="text-xs border px-2 py-1 rounded-full bg-white/10 border-white/10">×{members.length}</span>
                          ) : null}
                          <span className={'text-xs border px-2 py-1 rounded-full ' + sideBadge(side)}>{side}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn btn-ghost" onClick={() => onSelect(members[0].id)} type="button">Select</button>
                        <button className="btn btn-primary" onClick={() => onSetInitiative(members.map(m => m.id))} type="button">Set</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        {dead.length ? (
          <div className="pt-3">
            <div className="text-xs text-white/60 font-bold mb-2">Dead creatures</div>
            <div className="space-y-2">
              {dead.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-3 py-3 hover:bg-white/10 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold truncate">💀 RIP {c.name}</div>
                      <div className="text-sm text-white/70">
                        {c.side} • Max HP <span className="font-bold tabular-nums">{c.maxHP}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
