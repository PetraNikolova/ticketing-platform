import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Ticket } from '../api/types'
import { TypeBadge } from './ui'

interface TicketCardProps {
  ticket: Ticket
  epicTitle?: string
  onOpen: () => void
}

export function TicketCard({ ticket, epicTitle, onOpen }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-testid="ticket-card"
      data-ticket-id={ticket.id}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={`group cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{ticket.title}</p>
        <TypeBadge type={ticket.type} />
      </div>
      {epicTitle && (
        <p className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {epicTitle}
        </p>
      )}
    </div>
  )
}

// Static version rendered inside the DragOverlay so it follows the cursor.
export function TicketCardPreview({
  ticket,
  epicTitle,
}: {
  ticket: Ticket
  epicTitle?: string
}) {
  return (
    <div className="w-72 rotate-2 cursor-grabbing rounded-xl border border-brand-300 bg-white p-3 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{ticket.title}</p>
        <TypeBadge type={ticket.type} />
      </div>
      {epicTitle && (
        <p className="mt-2 inline-flex max-w-full items-center truncate rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {epicTitle}
        </p>
      )}
    </div>
  )
}
