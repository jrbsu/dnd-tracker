export type Side = 'PC' | 'Enemy' | 'NPC'
export type LifeState = 'alive' | 'down' | 'stable' | 'dead'

export type DamageType =
  // non-magical
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  // magical
  | 'acid'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'thunder'

export type ResistanceKind = 'normal' | 'resist' | 'vuln' | 'immune'

export interface Combatant {
  id: string
  name: string
  side: Side
  /**
   * Initiative for turn order. Null means “not set yet”.
   * (Lets you prep combats before rolling.)
   */
  initiative: number | null
  sortOrder: number
  groupId?: string
  groupLabel?: string
  maxHP: number | string
  hp: number
  tempHP: number
  ac?: number
  notes?: string
  conditions: string[]
  resistances: Partial<Record<DamageType, ResistanceKind>>
  buffLibrary: string[] // quick-cast buttons (per PC)
  order: number
  status?: LifeState
  deathSaveSuccesses?: number
  deathSaveFailures?: number
  url?: string
}

export interface Effect {
  id: string
  name: string
  sourceId?: string
  targetIds: string[]
  createdRound: number
  durationRounds: number | null // null = indefinite
  concentration: boolean
  notes?: string
}

export interface Encounter {
  id: string
  name: string
  round: number
  turnIndex: number
  turnGroupKey?: string
  selectedId?: string
  combatants: Combatant[]
  effects: Effect[]
  createdAt: string
  updatedAt: string
}

export interface PersistedState {
  encounter: Encounter
}
