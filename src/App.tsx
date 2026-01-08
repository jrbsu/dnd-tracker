import React, { useEffect, useMemo, useReducer, useState } from 'react'
import type { Combatant, Encounter } from './lib/types'
import { loadState, saveState } from './lib/storage'
import { buildTurnGroups } from './lib/utils'
import { makeInitialState, reducer } from './lib/reducer'
import { InitiativeList } from './components/InitiativeList'
import { DetailsPanel } from './components/DetailsPanel'
import { AddCombatantModal, type AddCombatantPayload } from './components/AddCombatantModal'
import { CombatControls } from './components/CombatControls'
import { EncounterToolbar } from './components/EncounterToolbar'
import { LibraryView } from './components/LibraryView'
import { SetInitiativeModal } from './components/SetInitiativeModal'
import { ToastProvider, useToast } from './components/Toast'
import { DEFAULT_PARTY_TEMPLATES } from './lib/defaultTemplates'
import { isDiceExpression, rollDiceExpression } from './lib/dice'
import type { CombatantTemplate } from './lib/templates'
import { loadTemplates, saveTemplates, templateFromCombatant, upsertTemplate } from './lib/templates'

type Tab = 'encounter' | 'library'

// ✅ Local helper type: AddCombatantPayload + optional per-creature max HP rolls
type AddPayloadWithRolls = AddCombatantPayload & { rolledMaxHps?: number[] }

function InnerApp() {
  const persisted = loadState()
  const [state, dispatch] = useReducer(reducer, makeInitialState(persisted?.encounter ?? null))
  const [tab, setTab] = useState<Tab>('encounter')
  const [openAdd, setOpenAdd] = useState(false)

  // Templates live outside encounters (localStorage)
  const [templates, setTemplates] = useState<CombatantTemplate[]>(() => loadTemplates())

  // “Set initiative” modal state
  const [openInit, setOpenInit] = useState(false)
  const [initIds, setInitIds] = useState<string[]>([])
  const [initLabel, setInitLabel] = useState('')

  const toast = useToast()

  const encounter = state.encounter
  const selected = useMemo(
    () => encounter.combatants.find(c => c.id === encounter.selectedId) ?? null,
    [encounter]
  )

  const clampMin1 = (n: number) => Math.max(1, Math.trunc(n))

  const rollMaxHp = (spec: unknown) => {
    const raw = String(spec ?? '').trim()
    if (!raw) return 1
    if (isDiceExpression(raw)) return clampMin1(rollDiceExpression(raw).total)
    const n = Number(raw)
    return clampMin1(Number.isFinite(n) ? n : 1)
  }

  // persist encounter changes
  useEffect(() => {
    saveState({ encounter })
  }, [encounter])

  // persist template changes
  useEffect(() => {
    saveTemplates(templates)
  }, [templates])

  const seedDefaults = () => {
    const ok = confirm('Add the default party templates (Burt, Georgie, Qwyx, Urgoth, Ven)?')
    if (!ok) return

    const existingIds = new Set(templates.map(t => t.id))
    const toAdd = DEFAULT_PARTY_TEMPLATES.filter(t => !existingIds.has(t.id))

    if (toAdd.length === 0) {
      toast.push('Party templates already present')
      return
    }

    setTemplates([...templates, ...toAdd])
    toast.push('Added party templates')
  }

  const addTemplateToEncounter = (tpl: CombatantTemplate, opts?: { count?: number }) => {
    const count = tpl.side === 'Enemy' ? (opts?.count ?? 1) : 1

    // roll once per created combatant (so Goblin A/B/C can differ)
    const rolledMaxHps = Array.from({ length: count }, () => rollMaxHp(tpl.maxHP))
    const firstMax = rolledMaxHps[0] ?? 1

    // ✅ IMPORTANT: don’t type this as AddCombatantPayload (it doesn’t know about rolledMaxHps)
    const payload: AddPayloadWithRolls = {
      name: tpl.name,
      side: tpl.side,
      initiative: null,

      maxHP: firstMax,
      tempHP: 0,

      ac: tpl.ac == null ? undefined : Math.floor(Number(tpl.ac)),
      notes: tpl.notes ?? '',
      conditions: [...(tpl.conditions ?? [])],
      resistances: { ...(tpl.resistances ?? {}) },
      buffLibrary: [...(tpl.buffLibrary ?? [])],

      count,
      rolledMaxHps, // ✅ reducer will use this per creature
    }

    dispatch({ type: 'ADD_COMBATANT', payload })
    toast.push('Combatant added')
  }

  const saveSelectedAsTemplate = (c: Combatant) => {
    // Prefer overwriting an existing template with the same (name + side)
    const existing = templates.find(
      t => t.side === c.side && t.name.trim().toLowerCase() === c.name.trim().toLowerCase()
    )

    const base = templateFromCombatant(c)
    const tpl: CombatantTemplate = existing
      ? {
        ...base,
        id: existing.id,
        createdAt: existing.createdAt,
        maxHP: typeof existing.maxHP === 'string' ? existing.maxHP : base.maxHP,
      }
      : base

    const next = upsertTemplate(templates, tpl)
    setTemplates(next)
    toast.push(existing ? 'Template updated' : 'Template saved')
  }

  const requestSetInitiative = (ids: string[]) => {
    if (!ids.length) return
    const cs = ids
      .map(id => encounter.combatants.find(c => c.id === id))
      .filter(Boolean) as Combatant[]
    if (!cs.length) return

    const base = cs[0].groupLabel ?? cs[0].name ?? 'Group'
    const label = ids.length > 1 ? `${base} ×${ids.length}` : base

    setInitIds(ids)
    setInitLabel(label)
    setOpenInit(true)
  }

  useEffect(() => {
    // auto-select current turn on load if none selected
    if (!encounter.selectedId && encounter.combatants.length) {
      const groups = buildTurnGroups(encounter.combatants)
      const key =
        encounter.turnGroupKey && groups.some(g => g.key === encounter.turnGroupKey)
          ? encounter.turnGroupKey
          : (groups[0]?.key ?? '')
      const id = groups.find(g => g.key === key)?.memberIds[0] ?? encounter.combatants[0].id
      dispatch({ type: 'SELECT', id })
    }
  }, [encounter.selectedId, encounter.combatants.length, encounter.turnIndex, encounter.turnGroupKey])

  const onNew = () => {
    const ok = confirm('Start a new encounter? This will clear the current one (you can Export first).')
    if (!ok) return
    dispatch({ type: 'NEW_ENCOUNTER' })
    toast.push('New encounter created')
  }

  const onImport = (enc: Encounter) => {
    dispatch({ type: 'IMPORT_ENCOUNTER', encounter: enc })
    toast.push('Encounter imported')
  }

  return (
    <div className="min-h-screen text-white safe-top pb-28">
      <div className="mx-auto max-w-6xl p-3">
        <EncounterToolbar
          encounter={encounter}
          canUndo={state.undoStack.length > 0}
          onUndo={() => {
            dispatch({ type: 'UNDO' })
            toast.push('Undid last action')
          }}
          onNew={onNew}
          onImport={onImport}
          onClearInitiative={() => dispatch({ type: 'CLEAR_INITIATIVE' })}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={'btn ' + (tab === 'encounter' ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setTab('encounter')}
          >
            Encounter
          </button>
          <button
            className={'btn ' + (tab === 'library' ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setTab('library')}
          >
            Library
          </button>
        </div>

        {tab === 'library' ? (
          <div className="mt-4">
            <LibraryView
              encounter={encounter}
              templates={templates}
              onSetTemplates={setTemplates}
              onSeedDefaults={seedDefaults}
              onAddToEncounter={addTemplateToEncounter}
              onUpdateCombatant={(id, patch) => dispatch({ type: 'UPDATE_COMBATANT', id, patch })}
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <InitiativeList
              encounter={encounter}
              onSelect={(id) => dispatch({ type: 'SELECT', id })}
              onSetInitiative={requestSetInitiative}
              onMoveWithinTie={(id, dir) => dispatch({ type: 'MOVE_WITHIN_TIE', id, dir })}
            />

            <DetailsPanel
              encounter={encounter}
              combatant={selected}
              onRemoveCombatant={(id) => {
                dispatch({ type: 'REMOVE_COMBATANT', id })
                toast.push('Removed combatant')
              }}
              onUpdateCombatant={(id, patch) => {
                dispatch({ type: 'UPDATE_COMBATANT', id, patch })
                toast.push('Updated')
              }}
              onSaveTemplate={(c) => saveSelectedAsTemplate(c)}
              onDamage={(id, amount, damageType) => {
                dispatch({ type: 'APPLY_DAMAGE', id, amount, damageType })
                toast.push(`Damage -${amount}`)
              }}
              onHeal={(id, amount) => {
                dispatch({ type: 'APPLY_HEAL', id, amount })
                toast.push(`Heal +${amount}`)
              }}
              onSetHp={(id, hp) => {
                dispatch({ type: 'SET_HP', id, hp })
                toast.push(`Set HP ${hp}`)
              }}
              onSetTemp={(id, temp) => {
                dispatch({ type: 'SET_TEMP_HP', id, tempHP: temp })
                toast.push('Temp HP updated')
              }}
              onToggleCondition={(id, condition) => dispatch({ type: 'TOGGLE_CONDITION', id, condition })}
              onCycleResistance={(id, dt) => dispatch({ type: 'CYCLE_RESISTANCE', id, damageType: dt })}
              onAddEffect={(payload) => {
                dispatch({ type: 'ADD_EFFECT', payload })
                toast.push('Effect added')
              }}
              onRemoveEffect={(id) => {
                dispatch({ type: 'REMOVE_EFFECT', id })
                toast.push('Effect removed')
              }}
              onDropConcentration={(sourceId) => {
                dispatch({ type: 'DROP_CONCENTRATION', sourceId })
                toast.push('Concentration dropped')
              }}
            />
          </div>
        )}
      </div>

      <CombatControls
        onPrev={() => {
          dispatch({ type: 'PREV_TURN' })
          toast.push('Previous turn')
        }}
        onNext={() => {
          dispatch({ type: 'NEXT_TURN' })
          toast.push('Next turn')
        }}
        onAdd={() => setOpenAdd(true)}
      />

      <AddCombatantModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(payload) => {
          dispatch({ type: 'ADD_COMBATANT', payload })
          toast.push('Combatant added')
        }}
        templates={templates}
      />

      <SetInitiativeModal
        open={openInit}
        onClose={() => setOpenInit(false)}
        label={initLabel}
        onSave={(initiative) => {
          dispatch({ type: 'SET_INITIATIVE', ids: initIds, initiative })
          setOpenInit(false)
          toast.push('Initiative set')
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <InnerApp />
    </ToastProvider>
  )
}
