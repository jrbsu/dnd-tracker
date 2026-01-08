import React, { useMemo, useState } from 'react'
import type { Combatant, Encounter } from '../lib/types'
import type { CombatantTemplate } from '../lib/templates'
import { Modal } from './Modal'
import { TemplatesView } from './TemplatesView'

type SubTab = 'buffs' | 'templates'

export function LibraryView(props: {
  encounter: Encounter
  templates: CombatantTemplate[]
  onSetTemplates: (templates: CombatantTemplate[]) => void
  onAddToEncounter: (tpl: CombatantTemplate, opts?: { count?: number }) => void
  onSeedDefaults: () => void
  onUpdateCombatant: (id: string, patch: Partial<Combatant>) => void
}) {
  const { encounter, templates, onSetTemplates, onAddToEncounter, onSeedDefaults, onUpdateCombatant } = props

  const [subTab, setSubTab] = useState<SubTab>('templates')

  const pcs = useMemo(
    () => encounter.combatants.filter(c => c.side === 'PC'),
    [encounter.combatants]
  )
  const [selectedId, setSelectedId] = useState<string | undefined>(pcs[0]?.id)
  const selected = pcs.find(p => p.id === selectedId)

  const [openAdd, setOpenAdd] = useState(false)
  const [newBuff, setNewBuff] = useState('')

  const addBuff = () => {
    if (!selected) return
    const name = newBuff.trim()
    if (!name) return
    const next = Array.from(new Set([...(selected.buffLibrary ?? []), name]))
    onUpdateCombatant(selected.id, { buffLibrary: next })
    setNewBuff('')
    setOpenAdd(false)
  }

  const removeBuff = (buff: string) => {
    if (!selected) return
    const next = (selected.buffLibrary ?? []).filter(b => b !== buff)
    onUpdateCombatant(selected.id, { buffLibrary: next })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          className={'btn ' + (subTab === 'templates' ? 'btn-primary' : 'btn-ghost')}
          onClick={() => setSubTab('templates')}
          type="button"
        >
          Templates
        </button>
        <button
          className={'btn ' + (subTab === 'buffs' ? 'btn-primary' : 'btn-ghost')}
          onClick={() => setSubTab('buffs')}
          type="button"
        >
          Buff Library
        </button>
      </div>

      {subTab === 'templates' ? (
        <div className="mt-4">
          <TemplatesView
            templates={templates}
            onSetTemplates={onSetTemplates}
            onAddToEncounter={onAddToEncounter}
            onSeedDefaults={onSeedDefaults}
          />
        </div>
      ) : (
        <div className="mt-4 card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-extrabold">Buff Library</div>
              <div className="text-sm text-white/70">
                Per-PC quick-cast buttons for combat.
              </div>
            </div>
          </div>

          {pcs.length === 0 ? (
            <div className="mt-4 text-white/70">
              No PCs in this encounter yet. Add a PC combatant first.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-3">
                <div className="font-bold mb-2">PCs</div>
                <div className="space-y-2">
                  {pcs.map(p => (
                    <button
                      key={p.id}
                      className={'w-full text-left rounded-2xl px-3 py-3 border ' +
                        (p.id === selectedId ? 'bg-lime-500/25 border-lime-400/40' : 'bg-white/5 border-white/10 hover:bg-white/10')}
                      onClick={() => setSelectedId(p.id)}
                      type="button"
                    >
                      <div className="font-bold">{p.name}</div>
                      <div className="text-sm text-white/70">{p.buffLibrary.length} buffs</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">Buffs</div>
                  <button className="btn btn-primary" onClick={() => setOpenAdd(true)} type="button">Add buff</button>
                </div>

                {!selected ? (
                  <div className="mt-3 text-white/70">Select a PC.</div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.buffLibrary.length === 0 ? (
                        <div className="text-white/60 text-sm">No buffs saved yet.</div>
                      ) : (
                        selected.buffLibrary.map(b => (
                          <div key={b} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                            <span className="font-semibold">{b}</span>
                            <button className="btn btn-ghost !px-2 !py-1" onClick={() => removeBuff(b)} type="button">✕</button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-3 text-xs text-white/60">
                      In combat, select the caster → “Cast buff” → tap one of these.
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <Modal
            title="Add buff"
            open={openAdd}
            onClose={() => setOpenAdd(false)}
            actions={
              <>
                <button className="btn btn-ghost" onClick={() => setOpenAdd(false)} type="button">Cancel</button>
                <button className="btn btn-primary" onClick={addBuff} type="button">Add</button>
              </>
            }
          >
            <div className="text-sm text-white/70">This is the only place you’ll type. In combat it’s all buttons.</div>
            <input
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
              value={newBuff}
              onChange={(e) => setNewBuff(e.target.value)}
              placeholder="e.g. Bless"
            />
          </Modal>
        </div>
      )}
    </div>
  )
}
