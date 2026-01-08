import type { Combatant, DamageType, Encounter, Effect, ResistanceKind, Side } from './types'
import {
  DAMAGE_TYPES,
  applyResistanceToDamage,
  buildTurnGroups,
  deepClone,
  expireEffects,
  getResistanceKind,
  nowIso,
  sortCombatantsByInitiative,
  uid,
} from './utils'

export type HpMode = 'current' | 'temp'

export type Action =
  | { type: 'NEW_ENCOUNTER'; name?: string }
  | { type: 'SELECT'; id: string }
  | {
    type: 'ADD_COMBATANT'
    payload: {
      name: string
      side: Side
      initiative: number | null
      maxHP: number | string
      url?: string
      ac?: number
      hp?: number
      tempHP?: number
      count?: number
      notes?: string
      conditions?: string[]
      resistances?: Combatant['resistances']
      buffLibrary?: string[]

      // ✅ NEW: if present, use this value per created combatant
      rolledMaxHps?: number[]
    }
  }
  | { type: 'REMOVE_COMBATANT'; id: string }
  | { type: 'UPDATE_COMBATANT'; id: string; patch: Partial<Combatant> }
  | { type: 'SET_INITIATIVE'; ids: string[]; initiative: number }
  | { type: 'APPLY_DAMAGE'; id: string; amount: number; damageType: DamageType | null }
  | { type: 'APPLY_HEAL'; id: string; amount: number }
  | { type: 'SET_HP'; id: string; hp: number }
  | { type: 'SET_TEMP_HP'; id: string; tempHP: number }
  | { type: 'TOGGLE_CONDITION'; id: string; condition: string }
  | { type: 'CYCLE_RESISTANCE'; id: string; damageType: DamageType }
  | { type: 'NEXT_TURN' }
  | { type: 'PREV_TURN' }
  | {
    type: 'ADD_EFFECT'
    payload: {
      name: string
      sourceId?: string
      targetIds: string[]
      durationRounds: number | null
      concentration: boolean
      notes?: string
    }
  }
  | { type: 'REMOVE_EFFECT'; id: string }
  | { type: 'DROP_CONCENTRATION'; sourceId: string }
  | { type: 'UNDO' }
  | { type: 'IMPORT_ENCOUNTER'; encounter: Encounter }
  | { type: 'MOVE_WITHIN_TIE'; id: string; dir: -1 | 1 }
  | { type: 'CLEAR_INITIATIVE' }

export interface State {
  encounter: Encounter
  undoStack: Encounter[] // snapshots of previous encounters
}

const MAX_UNDO = 30

function pushUndo(state: State): State {
  const snapshot = deepClone(state.encounter)
  const next = [snapshot, ...state.undoStack].slice(0, MAX_UNDO)
  return { ...state, undoStack: next }
}

function baseEncounter(name = 'Encounter'): Encounter {
  const now = nowIso()
  return {
    id: uid('enc'),
    name,
    round: 1,
    turnIndex: 0,
    turnGroupKey: undefined,
    selectedId: undefined,
    combatants: [],
    effects: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function makeInitialState(existing?: Encounter | null): State {
  return {
    encounter: existing ? ensureSortOrders(existing) : baseEncounter(),
    undoStack: [],
  }
}

function ensureSortOrders(encounter: Encounter): Encounter {
  let next = 1
  const groupOrder = new Map<string, number>()

  const combatants = encounter.combatants.map((c: any) => {
    if (typeof c.sortOrder === 'number') return c

    const key = c.groupId ?? c.id
    let so = groupOrder.get(key)
    if (so == null) {
      so = next++
      groupOrder.set(key, so)
    }
    return { ...c, sortOrder: so }
  })

  return { ...encounter, combatants }
}

/** Safely parse number|string into a floored int (or undefined if invalid). */
function floorInt(v: number | string | null | undefined): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.floor(n) : undefined
}

/** Safely parse number|string into a floored int (or fallback if invalid). */
function floorIntOr(v: number | string | null | undefined, fallback: number): number {
  return floorInt(v) ?? fallback
}

function clamp01hp(hp: number, maxHP: number): number {
  return Math.max(0, Math.min(maxHP, Math.floor(hp)))
}

function normalizeAfterHpChange(c: Combatant): Combatant {
  // assumes c.hp/maxHP are already clamped
  if (c.hp <= 0) {
    if (c.side === 'Enemy') {
      return { ...c, hp: 0, status: 'dead' }
    }
    // PC/NPC
    const status = c.status === 'stable' ? 'stable' : 'down'
    return {
      ...c,
      hp: 0,
      status,
      deathSaveSuccesses: c.deathSaveSuccesses ?? 0,
      deathSaveFailures: c.deathSaveFailures ?? 0,
    }
  }

  // hp > 0: alive, clear death saves if they were in play
  if (c.status === 'down' || c.status === 'stable') {
    return { ...c, status: 'alive', deathSaveSuccesses: 0, deathSaveFailures: 0 }
  }
  return { ...c, status: c.status ?? 'alive' }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEW_ENCOUNTER': {
      return { encounter: baseEncounter(action.name ?? 'Encounter'), undoStack: [] }
    }
    case 'IMPORT_ENCOUNTER': {
      return { encounter: ensureSortOrders({ ...action.encounter, updatedAt: nowIso() }), undoStack: [] }
    }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const [prev, ...rest] = state.undoStack
      return { encounter: prev, undoStack: rest }
    }
    case 'SELECT': {
      return { ...state, encounter: { ...state.encounter, selectedId: action.id } }
    }

    case 'ADD_COMBATANT': {
      const s1 = pushUndo(state)
      const {
        name,
        side,
        initiative,
        maxHP,
        url,
        ac,
        hp,
        tempHP,
        notes,
        conditions,
        resistances,
        buffLibrary,
        rolledMaxHps,
      } = action.payload

      const urlC = (url ?? '').trim() || undefined
      const countRaw = action.payload.count ?? 1
      const count = Math.max(1, Math.floor(countRaw))

      const baseName = (name.trim() || (side === 'Enemy' ? 'Enemy' : side)).trim()

      // Base “fallback” values (used if no per-creature roll is provided)
      const maxHPC = Math.max(1, floorIntOr(maxHP, 1))
      const acC = ac != null ? Math.floor(ac) : undefined
      const hasPerCreatureRolls = Array.isArray(rolledMaxHps) && rolledMaxHps.length > 0
      const hpBase = !hasPerCreatureRolls && hp != null ? Math.floor(hp) : undefined
      const tempHPC = tempHP != null ? Math.floor(tempHP) : 0

      const alphaSuffix = (i: number): string => {
        // 0 -> A, 25 -> Z, 26 -> AA, etc.
        let n = i
        let out = ''
        while (n >= 0) {
          out = String.fromCharCode(65 + (n % 26)) + out
          n = Math.floor(n / 26) - 1
        }
        return out
      }

      const makeName = (i: number): string => {
        if (count === 1) return baseName
        // For enemies, default to letter suffix (Goblin A/B/C) for readability.
        if (side === 'Enemy') return `${baseName} ${alphaSuffix(i)}`
        return `${baseName} ${i + 1}`
      }

      const groupId = side === 'Enemy' && count > 1 ? uid('g') : undefined
      const isStack = side === 'Enemy' && count > 1

      // Stable "order" (tie-breaker / MOVE_WITHIN_TIE swapping blocks)
      const maxExistingOrder = Math.max(
        -1,
        ...s1.encounter.combatants.map(c => (typeof c.order === 'number' ? c.order : -1))
      )
      const baseOrder = maxExistingOrder + 1

      // Stable "sortOrder" (keeps stacks/groups together in grouping/UI)
      const maxExistingSortOrder = Math.max(
        0,
        ...s1.encounter.combatants.map(c => (typeof c.sortOrder === 'number' ? c.sortOrder : 0))
      )
      const baseSortOrder = maxExistingSortOrder + 1

      const newOnes: Combatant[] = Array.from({ length: count }, (_, i) => {
        const mhp = Math.max(1, Math.floor(rolledMaxHps?.[i] ?? maxHPC))

        // If a base hp was provided, clamp it to mhp; otherwise start full.
        const hpStart = hpBase != null ? Math.max(0, Math.min(mhp, hpBase)) : mhp

        return {
          id: uid('c'),
          name: makeName(i),
          side,
          initiative: initiative == null ? null : Math.floor(initiative),

          groupId,
          groupLabel: groupId ? baseName : undefined,

          // stacks share a single sortOrder; otherwise each gets its own
          sortOrder: isStack ? baseSortOrder : baseSortOrder + i,

          maxHP: mhp,
          hp: hpStart,
          tempHP: Math.max(0, tempHPC),

          url: urlC,
          
          ac: acC,
          notes: notes ?? '',
          conditions: conditions ? [...conditions] : [],
          resistances: resistances ? { ...resistances } : {},
          buffLibrary: buffLibrary
            ? [...buffLibrary]
            : side === 'PC'
              ? ['Bless', 'Sanctuary', 'Guidance', 'Shield of Faith', 'Bane', 'Hex']
              : [],

          // order always increments per created combatant
          order: baseOrder + i,
          status: 'alive',
          deathSaveSuccesses: 0,
          deathSaveFailures: 0,
        }
      })

      const combatants = sortCombatantsByInitiative([...s1.encounter.combatants, ...newOnes])
      const selectedId = s1.encounter.selectedId ?? newOnes[0].id
      const encounter = { ...s1.encounter, combatants, selectedId, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'REMOVE_COMBATANT': {
      const s1 = pushUndo(state)
      const combatants = s1.encounter.combatants.filter(c => c.id !== action.id)

      const effects = s1.encounter.effects
        .map(e => ({
          ...e,
          sourceId: e.sourceId === action.id ? undefined : e.sourceId,
          targetIds: e.targetIds.filter(t => t !== action.id),
        }))
        .filter(e => e.targetIds.length > 0) // if no targets remain, drop the effect

      const groups = buildTurnGroups(combatants)

      const selectedId =
        s1.encounter.selectedId === action.id
          ? (groups[0]?.memberIds[0] ?? combatants[0]?.id)
          : s1.encounter.selectedId

      const turnIndex = Math.min(s1.encounter.turnIndex, Math.max(0, groups.length - 1))
      const turnGroupKey = groups[turnIndex]?.key

      const encounter = {
        ...s1.encounter,
        combatants,
        effects,
        selectedId,
        turnIndex,
        turnGroupKey,
        updatedAt: nowIso(),
      }
      return { ...s1, encounter }
    }

    case 'UPDATE_COMBATANT': {
      const s1 = pushUndo(state)
      const patch = action.patch
      const target = s1.encounter.combatants.find(c => c.id === action.id)
      if (!target) return state

      // If this combatant is part of a group and initiative is being set, apply it to the whole group.
      const groupIdToApply =
        target.groupId && Object.prototype.hasOwnProperty.call(patch, 'initiative') ? target.groupId : undefined

      const combatants = s1.encounter.combatants.map(c => {
        const shouldApply = c.id === action.id || (groupIdToApply && c.groupId === groupIdToApply)
        if (!shouldApply) return c

        const next: Combatant = { ...c, ...patch }

        if (typeof patch.maxHP === 'number') {
          const maxHP = Math.max(1, Math.floor(patch.maxHP))
          next.maxHP = maxHP
          if (typeof patch.hp !== 'number') {
            next.hp = Math.min(next.hp, maxHP)
          }
        }

        if (typeof patch.hp === 'number') {
          next.hp = clamp01hp(patch.hp, next.maxHP)
          return normalizeAfterHpChange(next)
        }

        if (typeof patch.tempHP === 'number') {
          next.tempHP = Math.max(0, Math.floor(patch.tempHP))
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'initiative')) {
          const val = (patch as Partial<Combatant>).initiative
          next.initiative = val == null ? null : Math.floor(val)
        }

        if (typeof patch.ac === 'number') {
          next.ac = Math.floor(patch.ac)
        }

        return normalizeAfterHpChange(next)
      })

      const sorted = sortCombatantsByInitiative(combatants)
      const encounter = { ...s1.encounter, combatants: sorted, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'SET_INITIATIVE': {
      const s1 = pushUndo(state)
      const set = new Set(action.ids)
      const combatants = s1.encounter.combatants.map(c =>
        set.has(c.id) ? { ...c, initiative: Math.floor(action.initiative) } : c
      )
      const sorted = sortCombatantsByInitiative(combatants)
      const encounter = { ...s1.encounter, combatants: sorted, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'APPLY_DAMAGE': {
      const s1 = pushUndo(state)
      const { id, amount, damageType } = action
      const combatants = s1.encounter.combatants.map(c => {
        if (c.id !== id) return c

        const kind = getResistanceKind(c, damageType)
        const finalDmg = applyResistanceToDamage(Math.floor(amount), kind)

        // apply to temp HP first
        let temp = c.tempHP
        let hp2 = c.hp
        let remaining = finalDmg

        if (temp > 0) {
          const used = Math.min(temp, remaining)
          temp -= used
          remaining -= used
        }
        if (remaining > 0) {
          hp2 = Math.max(0, hp2 - remaining)
        }

        const next = { ...c, hp: hp2, tempHP: temp }
        return normalizeAfterHpChange(next)
      })
      const encounter = { ...s1.encounter, combatants, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'APPLY_HEAL': {
      const s1 = pushUndo(state)
      const combatants = s1.encounter.combatants.map(c => {
        if (c.id !== action.id) return c
        const healed = Math.floor(action.amount)
        const hp2 = Math.min(c.maxHP, c.hp + healed)
        const next = { ...c, hp: hp2 }
        return normalizeAfterHpChange(next)
      })
      const encounter = { ...s1.encounter, combatants, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'SET_HP': {
      const s1 = pushUndo(state)
      const combatants = s1.encounter.combatants.map(c => {
        if (c.id !== action.id) return c
        const hp2 = clamp01hp(action.hp, c.maxHP)
        return normalizeAfterHpChange({ ...c, hp: hp2 })
      })
      const encounter = { ...s1.encounter, combatants, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'SET_TEMP_HP': {
      const s1 = pushUndo(state)
      const combatants = s1.encounter.combatants.map(c =>
        c.id === action.id ? { ...c, tempHP: Math.max(0, Math.floor(action.tempHP)) } : c
      )
      const encounter = { ...s1.encounter, combatants, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'TOGGLE_CONDITION': {
      const s1 = pushUndo(state)
      const combatants = s1.encounter.combatants.map(c => {
        if (c.id !== action.id) return c
        const has = c.conditions.includes(action.condition)
        const nextConditions = has ? c.conditions.filter(x => x !== action.condition) : [...c.conditions, action.condition]
        return { ...c, conditions: nextConditions }
      })
      const encounter = { ...s1.encounter, combatants, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'CYCLE_RESISTANCE': {
      const s1 = pushUndo(state)
      const order: ResistanceKind[] = ['normal', 'resist', 'vuln', 'immune']
      const combatants = s1.encounter.combatants.map(c => {
        if (c.id !== action.id) return c
        const current = c.resistances[action.damageType] ?? 'normal'
        const next = order[(order.indexOf(current) + 1) % order.length]
        const nextRes = { ...c.resistances, [action.damageType]: next }

        if (next === 'normal') {
          // remove key to keep it tidy
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [action.damageType]: _, ...rest } = nextRes
          return { ...c, resistances: rest }
        }
        return { ...c, resistances: nextRes }
      })
      const encounter = { ...s1.encounter, combatants, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'ADD_EFFECT': {
      const s1 = pushUndo(state)
      const e: Effect = {
        id: uid('e'),
        name: action.payload.name.trim() || 'Effect',
        sourceId: action.payload.sourceId,
        targetIds: action.payload.targetIds,
        durationRounds: action.payload.durationRounds,
        concentration: action.payload.concentration,
        notes: action.payload.notes,
        createdRound: s1.encounter.round,
      }
      const encounter = { ...s1.encounter, effects: [...s1.encounter.effects, e], updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'REMOVE_EFFECT': {
      const s1 = pushUndo(state)
      const effects = s1.encounter.effects.filter(e => e.id !== action.id)
      const encounter = { ...s1.encounter, effects, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'DROP_CONCENTRATION': {
      const s1 = pushUndo(state)
      const effects = s1.encounter.effects.filter(e => !(e.concentration && e.sourceId === action.sourceId))
      const encounter = { ...s1.encounter, effects, updatedAt: nowIso() }
      return { ...s1, encounter }
    }

    case 'NEXT_TURN': {
      const groups0 = buildTurnGroups(state.encounter.combatants)
      if (groups0.length === 0) return state
      const s1 = pushUndo(state)

      const groups = buildTurnGroups(s1.encounter.combatants)
      if (groups.length === 0) return state

      const currentKey =
        s1.encounter.turnGroupKey && groups.some(g => g.key === s1.encounter.turnGroupKey)
          ? s1.encounter.turnGroupKey
          : groups[s1.encounter.turnIndex]?.key ?? groups[0].key

      const currentIdx = Math.max(0, groups.findIndex(g => g.key === currentKey))
      const atEnd = currentIdx >= groups.length - 1
      const nextIdx = atEnd ? 0 : currentIdx + 1
      const nextRound = atEnd ? s1.encounter.round + 1 : s1.encounter.round

      let encounter: Encounter = {
        ...s1.encounter,
        turnIndex: nextIdx,
        turnGroupKey: groups[nextIdx]?.key,
        round: nextRound,
        updatedAt: nowIso(),
      }
      if (atEnd) encounter = expireEffects(encounter)
      const selectedId = groups[nextIdx]?.memberIds[0] ?? encounter.selectedId
      encounter = { ...encounter, selectedId }
      return { ...s1, encounter }
    }

    case 'PREV_TURN': {
      const groups0 = buildTurnGroups(state.encounter.combatants)
      if (groups0.length === 0) return state
      const s1 = pushUndo(state)

      const groups = buildTurnGroups(s1.encounter.combatants)
      if (groups.length === 0) return state

      const currentKey =
        s1.encounter.turnGroupKey && groups.some(g => g.key === s1.encounter.turnGroupKey)
          ? s1.encounter.turnGroupKey
          : groups[s1.encounter.turnIndex]?.key ?? groups[0].key

      const currentIdx = Math.max(0, groups.findIndex(g => g.key === currentKey))
      const atStart = currentIdx <= 0
      const prevIdx = atStart ? groups.length - 1 : currentIdx - 1
      const prevRound = atStart ? Math.max(1, s1.encounter.round - 1) : s1.encounter.round

      // Note: we don't "un-expire" effects when moving backwards; use UNDO if you need to reverse.
      const encounter: Encounter = {
        ...s1.encounter,
        turnIndex: prevIdx,
        turnGroupKey: groups[prevIdx]?.key,
        round: prevRound,
        selectedId: groups[prevIdx]?.memberIds[0] ?? s1.encounter.selectedId,
        updatedAt: nowIso(),
      }
      return { ...s1, encounter }
    }

    case 'MOVE_WITHIN_TIE': {
      const s1 = pushUndo(state)

      // normalize missing orders just in case old saves exist
      const combatants0 = s1.encounter.combatants.map((c, i) => ({
        ...c,
        order: typeof c.order === 'number' ? c.order : i,
      }))

      const groups = buildTurnGroups(combatants0)

      const idx = groups.findIndex(g => g.memberIds.includes(action.id))
      if (idx === -1) return state

      const j = idx + action.dir
      if (j < 0 || j >= groups.length) return state

      const a = groups[idx]
      const b = groups[j]

      if (a.initiative == null || b.initiative == null) return state
      if (a.initiative !== b.initiative) return state

      const byId = new Map(combatants0.map(c => [c.id, c]))
      const aIds = a.memberIds
      const bIds = b.memberIds

      const aMin = Math.min(...aIds.map(id => byId.get(id)!.order))
      const bMin = Math.min(...bIds.map(id => byId.get(id)!.order))

      const aSet = new Set(aIds)
      const bSet = new Set(bIds)

      // swap “blocks” so stacks move as a unit
      const swapped = combatants0.map(c => {
        if (aSet.has(c.id)) return { ...c, order: (c.order - aMin) + bMin }
        if (bSet.has(c.id)) return { ...c, order: (c.order - bMin) + aMin }
        return c
      })

      const sorted = sortCombatantsByInitiative(swapped)
      return { ...s1, encounter: { ...s1.encounter, combatants: sorted, updatedAt: nowIso() } }
    }

    case 'CLEAR_INITIATIVE': {
      const s1 = pushUndo(state)
      const combatants = s1.encounter.combatants.map(c => ({ ...c, initiative: null }))
      const encounter: Encounter = {
        ...s1.encounter,
        combatants: sortCombatantsByInitiative(combatants),
        // makes the initiative panel sane after clearing:
        turnIndex: 0,
        turnGroupKey: undefined,
        round: 1,
        updatedAt: nowIso(),
      }
      return { ...s1, encounter }
    }

    default:
      return state
  }
}

export function formatResistance(kind: ResistanceKind): string {
  switch (kind) {
    case 'resist':
      return 'RES'
    case 'vuln':
      return 'VULN'
    case 'immune':
      return 'IMM'
    default:
      return '—'
  }
}

export function prettyDamageType(dt: DamageType): string {
  // return dt[0].toUpperCase() + dt.slice(1)
  return dt
}

export function summarizeResistances(res: Partial<Record<DamageType, ResistanceKind>>): string {
  const parts: string[] = []
  for (const dt of DAMAGE_TYPES) {
    const k = res[dt]
    if (!k || k === 'normal') continue
    parts.push(`${dt}:${k}`)
  }
  return parts.join(', ')
}
