import type { Combatant, DamageType, ResistanceKind, Side } from './types'
import { isDiceExpression } from './dice'
import { nowIso, uid } from './utils'

export const TEMPLATES_KEY = 'dnd_combat_templates_v1'

export interface CombatantTemplate {
  id: string
  name: string
  side: Side
  maxHP: number | string
  ac?: number
  notes?: string
  resistances?: Partial<Record<DamageType, ResistanceKind>>
  conditions?: string[]
  buffLibrary?: string[]
  createdAt: string
  updatedAt: string
  url?: string
}

const STORAGE_KEY = 'combatant_templates'

function normalizeMaxHP(v: unknown): number | string {
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return 1
    if (isDiceExpression(s)) return s
    const n = Number(s)
    return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
  }
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(1, Math.floor(v))
  return 1
}

function sanitizeTemplate(t: any): CombatantTemplate | null {
  if (!t || typeof t !== 'object') return null
  if (typeof t.name !== 'string' || typeof t.side !== 'string') return null

  const id = typeof t.id === 'string' ? t.id : uid('tpl')
  const maxHP = Math.max(1, Math.floor(Number(t.maxHP ?? 1)))
  const ac = t.ac == null || t.ac === '' ? undefined : Math.floor(Number(t.ac))
  const createdAt = typeof t.createdAt === 'string' ? t.createdAt : nowIso()
  const updatedAt = typeof t.updatedAt === 'string' ? t.updatedAt : nowIso()

  const out: CombatantTemplate = {
    id,
    name: t.name,
    side: t.side as Side,
    maxHP,
    ac,
    notes: typeof t.notes === 'string' ? t.notes : '',
    resistances: (t.resistances && typeof t.resistances === 'object') ? { ...t.resistances } : {},
    conditions: Array.isArray(t.conditions) ? t.conditions.map(String) : [],
    buffLibrary: Array.isArray(t.buffLibrary) ? t.buffLibrary.map(String) : [],
    createdAt,
    updatedAt,
  }

  return out
}

export function loadTemplates(): CombatantTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(Boolean)
      .map((t: any) => ({
        id: String(t.id),
        name: String(t.name ?? 'Unnamed'),
        side: String(t.side ?? 'PC') as Side,
        maxHP: normalizeMaxHP(t.maxHP),
        ac: t.ac == null || t.ac === '' ? undefined : Math.floor(Number(t.ac)),
        notes: String(t.notes ?? ''),
        resistances: t.resistances && typeof t.resistances === 'object' ? { ...t.resistances } : {},
        conditions: Array.isArray(t.conditions) ? t.conditions.map(String) : [],
        buffLibrary: Array.isArray(t.buffLibrary) ? t.buffLibrary.map(String) : [],
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
        updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
      }))
  } catch {
    return []
  }
}

export function saveTemplates(templates: CombatantTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function templateFromCombatant(c: Combatant): CombatantTemplate {
  const now = nowIso()
  return {
    id: 'tpl_' + c.id,
    name: c.name,
    side: c.side,
    maxHP: c.maxHP,
    ac: c.ac,
    notes: c.notes ?? '',
    resistances: { ...c.resistances },
    conditions: [...c.conditions],
    buffLibrary: [...(c.buffLibrary ?? [])],
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertTemplate(list: CombatantTemplate[], tpl: CombatantTemplate): CombatantTemplate[] {
  const now = nowIso()
  const next = { ...tpl, updatedAt: now }
  const idx = list.findIndex(t => t.id === tpl.id)
  if (idx === -1) return [...list, next]
  return list.map(t => (t.id === tpl.id ? next : t))
}

export function deleteTemplate(list: CombatantTemplate[], id: string): CombatantTemplate[] {
  return list.filter(t => t.id !== id)
}
