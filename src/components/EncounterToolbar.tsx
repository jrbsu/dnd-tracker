import React, { useMemo, useState } from 'react'
import type { Encounter } from '../lib/types'
import { Modal } from './Modal'

export function EncounterToolbar(props: {
  encounter: Encounter
  canUndo: boolean
  onUndo: () => void
  onNew: () => void
  onImport: (encounter: Encounter) => void
  onClearInitiative: () => void
}) {
  const { encounter, canUndo, onUndo, onNew, onImport, onClearInitiative } = props

  const [openExport, setOpenExport] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const [importText, setImportText] = useState('')

  const exportJson = useMemo(() => JSON.stringify(encounter, null, 2), [encounter])

  const hasAnyInit = useMemo(
    () => encounter.combatants.some(c => c.initiative != null),
    [encounter.combatants]
  )

  const doImport = () => {
    try {
      const parsed = JSON.parse(importText) as Encounter
      onImport(parsed)
      setImportText('')
      setOpenImport(false)
    } catch {
      alert('Invalid JSON')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson)
    } catch {
      // clipboard may be restricted; fall back to manual
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-white/60">D&D Combat Tracker</div>
        <div className="text-xl font-extrabold truncate">{encounter.name}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" onClick={onNew}>New</button>
        <button className="btn btn-ghost" onClick={() => setOpenExport(true)}>Export</button>
        <button className="btn btn-ghost" onClick={() => setOpenImport(true)}>Import</button>

        <button
          type="button"
          className={'btn ' + (hasAnyInit ? 'btn-ghost' : 'btn-ghost opacity-50')}
          onClick={onClearInitiative}
          disabled={!hasAnyInit}
          title="Set all initiatives back to blank"
        >
          Clear initiative
        </button>

        <button
          className={'btn ' + (canUndo ? 'btn-primary' : 'btn-ghost opacity-50')}
          disabled={!canUndo}
          onClick={onUndo}
        >
          Undo
        </button>
      </div>

      {/* ...rest unchanged... */}
      <Modal
        title="Export encounter"
        open={openExport}
        onClose={() => setOpenExport(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setOpenExport(false)}>Close</button>
            <button className="btn btn-primary" onClick={copy}>Copy</button>
          </>
        }
      >
        <div className="text-sm text-white/70">
          Copy/paste this JSON somewhere safe as a backup.
        </div>
        <textarea
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white font-mono text-xs"
          value={exportJson}
          readOnly
          rows={12}
        />
      </Modal>

      <Modal
        title="Import encounter"
        open={openImport}
        onClose={() => setOpenImport(false)}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setOpenImport(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={doImport}>Import</button>
          </>
        }
      >
        <div className="text-sm text-white/70">
          Paste previously exported JSON here.
        </div>
        <textarea
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-white font-mono text-xs"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={12}
        />
      </Modal>
    </div>
  )
}
