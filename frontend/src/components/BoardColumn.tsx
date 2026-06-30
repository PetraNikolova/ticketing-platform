import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { TicketState } from '../api/types'
import { STATE_LABELS } from '../api/types'

interface BoardColumnProps {
  state: TicketState
  count: number
  children: ReactNode
}

export function BoardColumn({ state, count, children }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: state })

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-700">
          {STATE_LABELS[state]}
        </h2>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        data-testid={`column-${state}`}
        className={`flex flex-1 flex-col gap-2 rounded-xl p-2 transition ${
          isOver
            ? 'bg-brand-100 ring-2 ring-brand-300'
            : 'bg-slate-200/60'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
