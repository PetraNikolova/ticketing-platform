// Shared domain types mirroring the backend API contract.

export type TicketType = 'bug' | 'feature' | 'fix'

export type TicketState =
  | 'new'
  | 'ready_for_implementation'
  | 'in_progress'
  | 'ready_for_acceptance'
  | 'done'

// Board columns in fixed workflow order (spec §8: exactly five columns).
export const TICKET_STATES: TicketState[] = [
  'new',
  'ready_for_implementation',
  'in_progress',
  'ready_for_acceptance',
  'done',
]

// Human-readable labels (the API uses the canonical snake_case values).
export const STATE_LABELS: Record<TicketState, string> = {
  new: 'New',
  ready_for_implementation: 'Ready for Implementation',
  in_progress: 'In Progress',
  ready_for_acceptance: 'Ready for Acceptance',
  done: 'Done',
}

export const TICKET_TYPES: TicketType[] = ['bug', 'feature', 'fix']

export const TYPE_LABELS: Record<TicketType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  fix: 'Fix',
}

export interface User {
  id: string
  email: string
  emailVerified: boolean
}

export interface Team {
  id: string
  name: string
  createdAt: string
  modifiedAt: string
}

export interface Epic {
  id: string
  teamId: string
  title: string
  description: string | null
  createdAt: string
  modifiedAt: string
}

export interface Ticket {
  id: string
  teamId: string
  epicId: string | null
  type: TicketType
  state: TicketState
  title: string
  body: string
  createdById: string
  createdAt: string
  modifiedAt: string
}

export interface TicketDetail extends Ticket {
  createdBy: { id: string; email: string }
}

export interface Comment {
  id: string
  ticketId: string
  authorId: string
  body: string
  createdAt: string
  author: { id: string; email: string }
}
