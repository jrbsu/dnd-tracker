import type { PersistedState } from './types'

const KEY = 'dnd_combat_tracker_v1'

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore (storage full / private mode)
  }
}

export function clearState(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
