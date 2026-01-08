import type { DamageType, ResistanceKind } from './types'

export const DAMAGE_TYPE_ICON: Record<DamageType, string> = {
  slashing: '🗡️',
  piercing: '🏹',
  bludgeoning: '🔨',
  fire: '🔥',
  cold: '❄️',
  lightning: '⚡',
  acid: '🧪',
  poison: '☠️',
  necrotic: '💀',
  radiant: '🌞',
  psychic: '🧠',
  thunder: '🌩️',
  force: '✨',
}

export const RESISTANCE_TYPE_ICON: Record<ResistanceKind, string> = {
  resist: '🛡️',
  vuln: '⚠️',
  immune: '🚫',
  normal: '—',
}