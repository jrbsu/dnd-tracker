import React from 'react'

export function Segmented<T extends string>(props: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const { value, options, onChange } = props
  return (
    <div className="inline-flex rounded-2xl bg-white/10 p-1 gap-1">
      {options.map(o => (
        <button
          key={o.value}
          className={
            'rounded-2xl px-3 py-2 text-sm font-bold ' +
            (o.value === value ? 'bg-white text-black' : 'text-white hover:bg-white/10')
          }
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
