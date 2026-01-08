import React, { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { InitiativePicker } from './InitiativePicker'

export function SetInitiativeModal(props: {
  open: boolean
  onClose: () => void
  label: string
  onSave: (initiative: number) => void
}) {
  const { open, onClose, label, onSave } = props
  const [val, setVal] = useState(10)

  useEffect(() => {
    if (!open) return
    setVal(10)
  }, [open])

  return (
    <Modal
      title={`Set initiative — ${label}`}
      open={open}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(val)}>Save</button>
        </>
      }
    >
      <InitiativePicker value={val} onChange={setVal} showRoll />
    </Modal>
  )
}
