import React, { useMemo, useState } from 'react'
import type { DamageType, ResistanceKind, Side } from '../lib/types'
import { DAMAGE_TYPES, nowIso } from '../lib/utils'
import type { CombatantTemplate } from '../lib/templates'
import { Modal } from './Modal'
import { BumpPad, BumpPadOptional } from './BumpPad'
import { isDiceExpression } from '../lib/dice'
import { DAMAGE_TYPE_ICON } from '../lib/damageIcons'

function sideBadge(side: Side): string {
  switch (side) {
    case 'PC': return 'bg-lime-500/20 text-lime-200 border-lime-500/30'
    case 'Enemy': return 'bg-rose-500/20 text-rose-200 border-rose-500/30'
    case 'NPC': return 'bg-sky-500/20 text-sky-200 border-sky-500/30'
    default: return 'bg-white/10 text-white/80 border-white/15'
  }
}

function cycleResistance(current?: ResistanceKind): ResistanceKind {
  // normal -> resist -> vuln -> immune -> normal
  const c = current ?? 'normal'
  if (c === 'normal') return 'resist'
  if (c === 'resist') return 'vuln'
  if (c === 'vuln') return 'immune'
  return 'normal'
}

function resistanceBtnTint(kind?: ResistanceKind): string {
  switch (kind ?? 'normal') {
    case 'resist':
      return '!bg-amber-500/15 !border-amber-400/30 !text-amber-100 hover:!bg-amber-500/20'
    case 'vuln':
      return '!bg-sky-500/15 !border-sky-400/30 !text-sky-100 hover:!bg-sky-500/20'
    case 'immune':
      return '!bg-rose-500/15 !border-rose-400/30 !text-rose-100 hover:!bg-rose-500/20'
    default:
      return '!bg-white/5 !border-white/10 !text-white/90 hover:!bg-white/10'
  }
}

function prettyRes(kind?: ResistanceKind) {
  const k = kind ?? 'normal'
  if (k === 'normal') return '—'
  if (k === 'resist') return 'RES'
  if (k === 'vuln') return 'VULN'
  return 'IMM'
}

const clampMin1 = (n: number) => Math.max(1, Math.trunc(n))

function cleanMaxHP(v: unknown): number | string {
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

function numericMaxHpForPad(spec: unknown, fallback = 10): number {
  const s = String(spec ?? '').trim()
  const n = Number(s)
  if (s && Number.isFinite(n)) return clampMin1(Math.floor(n))
  return clampMin1(fallback)
}

const blankTemplate = (): CombatantTemplate => {
  const now = nowIso()
  return {
    id: 'tpl_' + Math.random().toString(36).slice(2, 9),
    name: '',
    side: 'PC',
    maxHP: 10,
    ac: 10,
    notes: '',
    resistances: {},
    conditions: [],
    buffLibrary: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function TemplatesView(props: {
  templates: CombatantTemplate[]
  onSetTemplates: (templates: CombatantTemplate[]) => void
  onAddToEncounter: (tpl: CombatantTemplate, opts?: { count?: number }) => void
  onSeedDefaults: () => void
}) {
  const { templates, onSetTemplates, onAddToEncounter, onSeedDefaults } = props

  const [q, setQ] = useState('')
  const [openEdit, setOpenEdit] = useState(false)
  const [editing, setEditing] = useState<CombatantTemplate | null>(null)
  const [openExport, setOpenExport] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const [ioText, setIoText] = useState('')

  const maxHpText = (() => {
    const v = editing?.maxHP
    return typeof v === 'string' ? v : String(v ?? '')
  })()
  const isDice = isDiceExpression(maxHpText.trim())

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const list = [...templates]
      .sort((a, b) => (a.side === b.side ? a.name.localeCompare(b.name) : a.side.localeCompare(b.side)))
    if (!qq) return list
    return list.filter(t => t.name.toLowerCase().includes(qq) || t.side.toLowerCase().includes(qq))
  }, [templates, q])

  const startNew = () => {
    const t = blankTemplate()
    setEditing(t)
    setOpenEdit(true)
  }

  const startEdit = (tpl: CombatantTemplate) => {
    const copy = JSON.parse(JSON.stringify(tpl))
    setEditing(copy)
    setOpenEdit(true)
  }

  const saveEdit = () => {
    if (!editing) return
    const cleaned: CombatantTemplate = {
      ...editing,
      name: editing.name.trim() || 'Unnamed',
      maxHP: cleanMaxHP(editing.maxHP),
      ac: editing.ac == null ? undefined : Math.floor(Number(editing.ac)),
      notes: editing.notes ?? '',
      conditions: (editing.conditions ?? []).map(s => String(s).trim()).filter(Boolean),
      buffLibrary: (editing.buffLibrary ?? []).map(s => String(s).trim()).filter(Boolean),
      updatedAt: nowIso(),
      url: (editing.url ?? '').trim() || undefined,
    }
    const idx = templates.findIndex(t => t.id === cleaned.id)
    const next = idx === -1
      ? [...templates, cleaned]
      : templates.map(t => (t.id === cleaned.id ? cleaned : t))
    onSetTemplates(next)
    setOpenEdit(false)
  }

  const remove = (id: string) => {
    const ok = confirm('Delete this template?')
    if (!ok) return
    onSetTemplates(templates.filter(t => t.id !== id))
  }

  const openExportModal = () => {
    setIoText(JSON.stringify(templates, null, 2))
    setOpenExport(true)
  }

  const doImport = () => {
    try {
      const parsed = JSON.parse(ioText)
      if (!Array.isArray(parsed)) {
        alert('Paste a JSON array of templates.')
        return
      }
      // basic coercion
      const now = nowIso()
      const next: CombatantTemplate[] = parsed
        .filter(Boolean)
        .map((t: any) => ({
          id: String(t.id ?? ('tpl_' + Math.random().toString(36).slice(2, 9))),
          name: String(t.name ?? 'Unnamed'),
          side: (String(t.side ?? 'PC') as Side),
          maxHP: cleanMaxHP(t.maxHP),
          ac: t.ac == null || t.ac === '' ? undefined : Math.floor(Number(t.ac)),
          notes: String(t.notes ?? ''),
          resistances: (t.resistances && typeof t.resistances === 'object') ? { ...t.resistances } : {},
          conditions: Array.isArray(t.conditions) ? t.conditions.map(String) : [],
          buffLibrary: Array.isArray(t.buffLibrary) ? t.buffLibrary.map(String) : [],
          createdAt: typeof t.createdAt === 'string' ? t.createdAt : now,
          updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : now,
          url: String(t.url ?? '').trim() || undefined,
        }))
      onSetTemplates(next)
      setOpenImport(false)
    } catch (e) {
      alert('Could not parse JSON.')
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xl font-extrabold">Templates</div>
          <div className="text-sm text-white/60">Save your PCs/monsters once, then add them to fights fast.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={onSeedDefaults}>Seed party</button>
          <button className="btn btn-ghost" onClick={() => { setIoText(''); setOpenImport(true) }}>Import</button>
          <button className="btn btn-ghost" onClick={openExportModal}>Export</button>
          <button className="btn btn-primary" onClick={startNew}>New</button>
        </div>
      </div>

      <div className="mt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search templates…"
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
        />
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-white/70">No templates yet. Hit <b>New</b> (or <b>Seed party</b>).</div>
        ) : null}

        {filtered.map((t) => (
          <div key={t.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="font-extrabold truncate">{t.name}</div>
                  <span className={'text-xs border px-2 py-1 rounded-full ' + sideBadge(t.side)}>{t.side}</span>
                </div>
                <div className="text-sm text-white/70">
                  Max HP <span className="font-bold tabular-nums">{t.maxHP}</span>
                  {t.ac != null ? <span className="ml-3">AC <span className="font-bold tabular-nums">{t.ac}</span></span> : null}
                  {t.buffLibrary && t.buffLibrary.length ? <span className="ml-3">• {t.buffLibrary.length} effects</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-ghost" onClick={() => onAddToEncounter(t, { count: t.side === 'Enemy' ? 1 : undefined })}>Add</button>
                <button className="btn btn-ghost" onClick={() => startEdit(t)}>Edit</button>
                <button className="btn btn-danger" onClick={() => remove(t.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        title={editing?.id ? 'Edit template' : 'New template'}
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setOpenEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit}>Save</button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-4">
            <div>
              <div className="font-bold mb-2">Name</div>
              <input className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
                value={editing.name}
                placeholder="Goblin Warrior"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>

            <div>
              <div className="font-bold mb-2">Reference link (optional)</div>
              <input
                type="text"
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
                value={editing.url ?? ''}
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <div>
              <div className="font-bold mb-2">Side</div>
              <div className="flex flex-wrap gap-2">
                {(['PC', 'NPC', 'Enemy'] as Side[]).map(s => (
                  <button
                    key={s}
                    className={'btn ' + (editing.side === s ? 'btn-primary' : 'btn-ghost')}
                    onClick={() => setEditing({ ...editing, side: s })}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-bold mb-2">Max HP</div>

                <input
                  type="text"
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
                  value={typeof editing.maxHP === 'string' ? editing.maxHP : String(editing.maxHP ?? '')}
                  onChange={(e) => setEditing({ ...editing, maxHP: e.target.value })}
                  placeholder="e.g. 30 or 13d6+27"
                />

                {!isDice ? (
                  <div className="mt-2">
                    <BumpPad
                      value={typeof editing.maxHP === 'number' ? editing.maxHP : Number(editing.maxHP) || 10}
                      onChange={(v) => setEditing({ ...editing, maxHP: v })}
                      min={1}
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-white/60">
                    Dice expression will be rolled when added to an encounter.
                  </div>
                )}

              </div>
              <div>
                <div className="font-bold mb-2">AC</div>
                <input type="number" className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
                  value={editing.ac ?? ''}
                  placeholder="e.g. 14"
                  onChange={(e) => setEditing({ ...editing, ac: e.target.value === '' ? undefined : Number(e.target.value) })} />
                <div className="mt-2"><BumpPadOptional value={editing.ac ?? ''} onChange={(v) => setEditing({ ...editing, ac: v === '' ? undefined : Number(v) })} min={0} baseline={10} /></div>
              </div>
            </div>

            <div>
              <div className="font-bold mb-2">Notes</div>
              <textarea className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
                rows={2}
                value={editing.notes ?? ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>

            <div>
              <div className="font-bold mb-2">Effect library (one per line)</div>
              <textarea
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
                rows={6}
                value={(editing.buffLibrary ?? []).join('\n')}
                onChange={(e) => setEditing({ ...editing, buffLibrary: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) })}
              />
            </div>

            <div>
              <div className="font-bold mb-2">Resistances (tap to cycle)</div>
              <div className="grid grid-cols-3 gap-2">
                {DAMAGE_TYPES.map((dt) => {
                  const kind = (editing.resistances ?? {})[dt as DamageType] ?? 'normal'

                  return (
                    <button
                      key={dt}
                      type="button"
                      className={'btn btn-ghost justify-between border ' + resistanceBtnTint(kind)}
                      onClick={() => {
                        const next = cycleResistance(kind)
                        setEditing({
                          ...editing,
                          resistances: { ...(editing.resistances ?? {}), [dt]: next },
                        })
                      }}
                    >
                      <span className="capitalize">{DAMAGE_TYPE_ICON[dt]} </span>
                      <span className="font-bold tabular-nums">{prettyRes(kind)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Export templates"
        open={openExport}
        onClose={() => setOpenExport(false)}
        actions={<button className="btn btn-primary" onClick={() => setOpenExport(false)}>Close</button>}
      >
        <div className="text-sm text-white/70 mb-2">Copy this JSON somewhere safe.</div>
        <textarea className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
          rows={10}
          value={ioText}
          onChange={(e) => setIoText(e.target.value)} />
      </Modal>

      <Modal
        title="Import templates"
        open={openImport}
        onClose={() => setOpenImport(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setOpenImport(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={doImport}>Import</button>
          </>
        }
      >
        <div className="text-sm text-white/70 mb-2">Paste a JSON array of templates.</div>
        <textarea className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white"
          rows={10}
          value={ioText}
          onChange={(e) => setIoText(e.target.value)} />
      </Modal>
    </div>
  )
}
