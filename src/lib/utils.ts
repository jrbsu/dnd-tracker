import type { Combatant, DamageType, Effect, Encounter, ResistanceKind } from './types'
import { DAMAGE_TYPE_ICON } from './damageIcons'

export const DAMAGE_TYPES: DamageType[] = [
  'acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'
]

export const DAMAGE_TYPE_SHORT: Record<DamageType, string> = {
  // Common first
  slashing: 'SLS',
  bludgeoning: 'BLG',
  piercing: 'PRC',
  // Magical
  acid: 'ACD',
  cold: 'CLD',
  fire: 'FIR',
  force: 'FRC',
  lightning: 'LGT',
  necrotic: 'NEC',
  poison: 'PSN',
  psychic: 'PSY',
  radiant: 'RAD',
  thunder: 'THN',
}

export function damageTypeShort(dt: DamageType): string {
  return DAMAGE_TYPE_ICON[dt] ?? dt.slice(0, 3).toUpperCase()
}

export const COMMON_CONDITIONS = [
  'Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion'
] as const

export function uid(prefix = 'id'): string {
  // short, stable enough for local use
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}


export interface TurnGroup {
  key: string
  initiative: number
  label: string
  memberIds: string[]
  sides: Set<Combatant['side']>
}

export interface PendingGroup {
  key: string
  label: string
  memberIds: string[]
  sides: Set<Combatant['side']>
}

export function groupKeyForCombatant(c: Combatant): string {
  return c.groupId ? `g:${c.groupId}` : `c:${c.id}`
}

export function buildTurnGroups(combatants: Combatant[]): TurnGroup[] {
  const map = new Map<string, TurnGroup>()
  const living = combatants.filter(c => c.status !== 'dead')

  for (const c of living) {
    if (c.initiative == null) continue
    const key = groupKeyForCombatant(c)
    const label = c.groupId ? (c.groupLabel ?? c.name) : c.name
    const g = map.get(key)
    if (!g) {
      map.set(key, {
        key,
        initiative: c.initiative,
        label,
        memberIds: [c.id],
        sides: new Set([c.side]),
      })
    } else {
      g.memberIds.push(c.id)
      g.sides.add(c.side)
      // Keep the highest initiative seen (in case data drifts)
      if (c.initiative != null && c.initiative > g.initiative) g.initiative = c.initiative
      // Prefer a non-empty label
      if (!g.label && label) g.label = label
    }
  }

  // Stable order of members inside group: by name
  const byId = new Map(living.map(c => [c.id, c]))
  for (const g of map.values()) {
    g.memberIds.sort((a, b) => (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? ''))
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    // Tie-break by label for stability
    return a.label.localeCompare(b.label)
  })
}

export function buildPendingGroups(combatants: Combatant[]): PendingGroup[] {
  const map = new Map<string, PendingGroup>()
  const living = combatants.filter(c => c.status !== 'dead')

  for (const c of living) {
    if (c.initiative != null) continue
    const key = groupKeyForCombatant(c)
    const label = c.groupId ? (c.groupLabel ?? c.name) : c.name
    const g = map.get(key)
    if (!g) {
      map.set(key, {
        key,
        label,
        memberIds: [c.id],
        sides: new Set([c.side]),
      })
    } else {
      g.memberIds.push(c.id)
      g.sides.add(c.side)
      if (!g.label && label) g.label = label
    }
  }

  const byId = new Map(living.map(c => [c.id, c]))
  for (const g of map.values()) {
    g.memberIds.sort((a, b) => (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? ''))
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function sortCombatantsByInitiative(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    const ai = a.initiative
    const bi = b.initiative

    // null initiatives go last
    if (ai == null && bi == null) return (a.order ?? 0) - (b.order ?? 0)
    if (ai == null) return 1
    if (bi == null) return -1

    // higher initiative first
    if (ai !== bi) return bi - ai

    // tie-break within same initiative
    return (a.order ?? 0) - (b.order ?? 0)
  })
}

export function deepClone<T>(obj: T): T {
  // structuredClone is supported in modern browsers (incl. iPadOS Safari)
  // fallback for safety
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any).structuredClone
  if (typeof sc === 'function') return sc(obj)
  return JSON.parse(JSON.stringify(obj)) as T
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function getResistanceKind(c: Combatant, dt: DamageType | null): ResistanceKind {
  if (!dt) return 'normal'
  return c.resistances[dt] ?? 'normal'
}

export function applyResistanceToDamage(baseDamage: number, kind: ResistanceKind): number {
  if (baseDamage <= 0) return 0
  switch (kind) {
    case 'immune': return 0
    case 'resist': return Math.floor(baseDamage / 2)
    case 'vuln': return baseDamage * 2
    default: return baseDamage
  }
}

export function expireEffects(encounter: Encounter): Encounter {
  const { round } = encounter
  const remaining: Effect[] = []
  for (const e of encounter.effects) {
    if (e.durationRounds == null) {
      remaining.push(e)
      continue
    }
    const elapsed = round - e.createdRound
    if (elapsed < e.durationRounds) remaining.push(e)
  }
  return { ...encounter, effects: remaining }
}

export function effectsForTarget(encounter: Encounter, targetId: string): Effect[] {
  return encounter.effects.filter(e => e.targetIds.includes(targetId))
}

export function concentrationEffectsForSource(encounter: Encounter, sourceId: string): Effect[] {
  return encounter.effects.filter(e => e.concentration && e.sourceId === sourceId)
}
