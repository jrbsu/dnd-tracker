import React, { useEffect, useMemo, useState } from 'react'
import type { DamageType, ResistanceKind, Side } from '../lib/types'
import type { CombatantTemplate } from '../lib/templates'
import { DAMAGE_TYPES } from '../lib/utils'
import { isDiceExpression, rollDiceExpression } from '../lib/dice'
import { Modal } from './Modal'
import { InitiativePicker } from './InitiativePicker'
import { BumpPad, BumpPadOptional } from './BumpPad'

export type AddCombatantPayload = {
  name: string
  side: Side
  initiative: number | null
  maxHP: number | string
  url?: string
  ac?: number
  hp?: number
  tempHP?: number
  notes?: string
  conditions?: string[]
  resistances?: Partial<Record<DamageType, ResistanceKind>>
  buffLibrary?: string[]
  count?: number
  rolledMaxHps?: number[]
}

const clampMin1 = (n: number) => Math.max(1, Math.trunc(n))

function rollMaxHp(spec: unknown): number {
  const raw = String(spec ?? '').trim()
  if (!raw) return 1

  if (isDiceExpression(raw)) {
    return clampMin1(rollDiceExpression(raw).total)
  }

  const n = Number(raw)
  return clampMin1(Number.isFinite(n) ? n : 1)
}

export function AddCombatantModal(props: {
  open: boolean
  onClose: () => void
  onAdd: (payload: AddCombatantPayload) => void
  templates: CombatantTemplate[]
}) {
  const { open, onClose, onAdd, templates } = props

  const [mode, setMode] = useState<'manual' | 'templates'>('manual')
  const [name, setName] = useState('')
  const [side, setSide] = useState<Side>('Enemy')
  const [count, setCount] = useState(1)

  const [maxHpRaw, setMaxHpRaw] = useState('')
  const [maxHP, setMaxHP] = useState(10)

  const [url, setUrl] = useState('')
  const [ac, setAc] = useState<number | ''>('')
  const [setInitNow, setSetInitNow] = useState(false)
  const [initiative, setInitiative] = useState(10)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) return
    // defaults each time the modal opens
    setMode('manual')
    setName('')
    setSide('Enemy')
    setCount(1)

    setMaxHpRaw('')
    setMaxHP(10)

    setUrl('')
    setAc('')
    setSetInitNow(false)
    setInitiative(10)
    setQ('')
  }, [open])

  const filteredTemplates = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const list = [...templates].sort((a, b) =>
      a.side === b.side ? a.name.localeCompare(b.name) : a.side.localeCompare(b.side)
    )
    if (!qq) return list
    return list.filter(t => t.name.toLowerCase().includes(qq) || t.side.toLowerCase().includes(qq))
  }, [templates, q])

  const submitManual = () => {
    const nm = name.trim()
    if (!nm) return

    const nextCount = side === 'Enemy' ? Math.max(1, Math.floor(count)) : 1

    // If user typed a dice expression, roll once per creature.
    // Otherwise use the numeric maxHP (from bump pad / numeric input).
    const useDice = isDiceExpression(maxHpRaw.trim())
    const rolledMaxHps = useDice
      ? Array.from({ length: nextCount }, () => rollMaxHp(maxHpRaw))
      : Array.from({ length: nextCount }, () => clampMin1(maxHP))

    const firstMax = rolledMaxHps[0] ?? 1
    const nextAc = ac === '' ? undefined : Math.floor(Number(ac))

    onAdd({
      name: nm,
      side,
      initiative: setInitNow ? Math.floor(Number(initiative)) : null,
      maxHP: firstMax,
      url: url.trim() || undefined,
      ac: nextAc,
      hp: firstMax,
      tempHP: 0,
      notes: '',
      conditions: [],
      resistances: {},
      buffLibrary: [],
      count: nextCount,
      rolledMaxHps: useDice ? rolledMaxHps : undefined,
    })

    onClose()
  }

  const addFromTemplate = (tpl: CombatantTemplate, opts?: { count?: number }) => {
    const nextCount = tpl.side === 'Enemy' ? (opts?.count ?? 1) : 1
    const nextAc = tpl.ac == null ? undefined : Math.floor(Number(tpl.ac))

    const tplMaxSpec = tpl.maxHP ?? 1
    const useDice = isDiceExpression(String(tplMaxSpec).trim())
    const rolledMaxHps = useDice
      ? Array.from({ length: nextCount }, () => rollMaxHp(tplMaxSpec))
      : Array.from({ length: nextCount }, () => clampMin1(Number(tplMaxSpec) || 1))

    const firstMax = rolledMaxHps[0] ?? 1

    onAdd({
      name: tpl.name,
      side: tpl.side,
      initiative: setInitNow ? Math.floor(Number(initiative)) : null,
      maxHP: firstMax,
      url: (tpl.url ?? '').trim() || undefined,
      ac: nextAc,
      hp: firstMax,
      tempHP: 0,
      notes: tpl.notes ?? '',
      conditions: [...(tpl.conditions ?? [])],
      resistances: { ...(tpl.resistances ?? {}) },
      buffLibrary: [...(tpl.buffLibrary ?? [])],
      count: nextCount,
      rolledMaxHps: useDice ? rolledMaxHps : undefined,
    })

    onClose()
  }

  return (
    <Modal
      title="Add combatant"
      open={open}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {mode === 'manual' ? (
            <button className="btn btn-primary" onClick={submitManual} disabled={!name.trim()}>
              Add
            </button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <button className={'btn ' + (mode === 'manual' ? 'btn-primary' : 'btn-ghost')} onClick={() => setMode('manual')} type="button">Manual</button>
        <button className={'btn ' + (mode === 'templates' ? 'btn-primary' : 'btn-ghost')} onClick={() => setMode('templates')} type="button">Templates</button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={setInitNow} onChange={(e) => setSetInitNow(e.target.checked)} />
          Set initiative now
        </label>
        {setInitNow ? (
          <div className="mt-2">
            <InitiativePicker value={initiative} onChange={setInitiative} />
          </div>
        ) : (
          <div className="text-xs text-white/60 mt-1">(You can set it later from the initiative list.)</div>
        )}
      </div>

      {mode === 'manual' ? (
        <div className="space-y-4">
          <div>
            <div className="font-bold mb-2">Name</div>
            <input
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Goblin"
            />
          </div>

          <div>
            <div className="font-bold mb-2">Side</div>
            <div className="flex flex-wrap gap-2">
              {(['PC', 'NPC', 'Enemy'] as Side[]).map(s => (
                <button
                  key={s}
                  className={'btn ' + (side === s ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => setSide(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {side === 'Enemy' ? (
            <div>
              <div className="font-bold mb-2">Count</div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} className={'btn ' + (count === n ? 'btn-primary' : 'btn-ghost')} onClick={() => setCount(n)} type="button">{n}</button>
                ))}
              </div>
              <div className="text-xs text-white/60 mt-1">
                Multiple enemies become a stack that shares initiative but tracks HP/effects per creature.
              </div>
            </div>
          ) : null}

          <div>
            <div className="font-bold mb-2">Reference link (optional)</div>
            <input
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div>
            <div className="font-bold mb-2">Max HP</div>
            <input
              value={maxHpRaw}
              onChange={(e) => {
                const v = e.target.value
                setMaxHpRaw(v)

                // If it’s a plain number, keep bump pad in sync.
                const n = Number(v)
                if (!isDiceExpression(v.trim()) && Number.isFinite(n)) {
                  setMaxHP(clampMin1(n))
                }
              }}
              placeholder="e.g. 30 or 13d6+27"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
            />
            <div className="mt-2">
              <BumpPad
                value={maxHP}
                onChange={(v) => {
                  setMaxHP(v)
                  setMaxHpRaw(String(v))
                }}
                min={1}
              />
            </div>
          </div>

          <div>
            <div className="font-bold mb-2">AC</div>
            <input
              type="number"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
              placeholder="e.g. 14"
              value={ac}
              onChange={(e) => setAc(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <div className="mt-2">
              <BumpPadOptional value={ac} onChange={setAc} min={0} baseline={10} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
          />

          {filteredTemplates.length === 0 ? (
            <div className="text-white/70">No templates yet. Use the Templates tab to create (or seed) them.</div>
          ) : null}

          <div className="space-y-2">
            {filteredTemplates.map(tpl => (
              <div key={tpl.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold truncate">{tpl.name}</div>
                    <div className="text-sm text-white/70">
                      {tpl.side} • Max HP <span className="font-bold tabular-nums">{String(tpl.maxHP)}</span>
                      {tpl.ac != null ? <span className="ml-2">AC <span className="font-bold tabular-nums">{tpl.ac}</span></span> : null}
                      {tpl.buffLibrary?.length ? <span className="ml-2">• {tpl.buffLibrary.length} effects</span> : null}
                    </div>
                  </div>

                  {tpl.side === 'Enemy' ? (
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3].map(n => (
                        <button key={n} className="btn btn-ghost" onClick={() => addFromTemplate(tpl, { count: n })} type="button">
                          Add ×{n}
                        </button>
                      ))}
                      <button className="btn btn-primary" onClick={() => addFromTemplate(tpl, { count: 1 })} type="button">
                        Add
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-primary" onClick={() => addFromTemplate(tpl)} type="button">
                      Add
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
