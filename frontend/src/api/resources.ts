import { api } from './client'
import type {
  Comment,
  Epic,
  Team,
  Ticket,
  TicketDetail,
  TicketState,
  TicketType,
  User,
} from './types'

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  signup: (email: string, password: string) =>
    api.post<{ id: string; email: string }>('/auth/signup', { email, password }),
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/auth/login', { email, password }),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
  verify: (token: string) =>
    api.get<{ verified: true }>('/auth/verify', { token }),
  resend: (email: string) =>
    api.post<{ ok: true }>('/auth/resend-verification', { email }),
}

// ── Teams ───────────────────────────────────────────────────────────────────
export const teamsApi = {
  list: () => api.get<Team[]>('/teams'),
  create: (name: string) => api.post<Team>('/teams', { name }),
  rename: (id: string, name: string) => api.patch<Team>(`/teams/${id}`, { name }),
  remove: (id: string) => api.delete<void>(`/teams/${id}`),
}

// ── Epics ───────────────────────────────────────────────────────────────────
export interface EpicInput {
  title: string
  description?: string | null
}

export const epicsApi = {
  list: (teamId?: string) => api.get<Epic[]>('/epics', { teamId }),
  create: (teamId: string, input: EpicInput) =>
    api.post<Epic>('/epics', { teamId, ...input }),
  update: (id: string, input: EpicInput) => api.patch<Epic>(`/epics/${id}`, input),
  remove: (id: string) => api.delete<void>(`/epics/${id}`),
}

// ── Tickets ─────────────────────────────────────────────────────────────────
export interface TicketFilters {
  teamId?: string
  type?: TicketType
  epicId?: string
  q?: string
}

export interface CreateTicketInput {
  teamId: string
  type: TicketType
  epicId?: string | null
  title: string
  body: string
}

export interface UpdateTicketInput {
  teamId?: string
  type?: TicketType
  epicId?: string | null
  title?: string
  body?: string
  state?: TicketState
}

export const ticketsApi = {
  list: (filters: TicketFilters) =>
    api.get<Ticket[]>('/tickets', {
      teamId: filters.teamId,
      type: filters.type,
      epicId: filters.epicId,
      q: filters.q,
    }),
  get: (id: string) => api.get<TicketDetail>(`/tickets/${id}`),
  create: (input: CreateTicketInput) => api.post<Ticket>('/tickets', input),
  update: (id: string, input: UpdateTicketInput) =>
    api.patch<Ticket>(`/tickets/${id}`, input),
  setState: (id: string, state: TicketState) =>
    api.patch<Ticket>(`/tickets/${id}/state`, { state }),
  remove: (id: string) => api.delete<void>(`/tickets/${id}`),
}

// ── Comments ────────────────────────────────────────────────────────────────
export const commentsApi = {
  list: (ticketId: string) => api.get<Comment[]>(`/tickets/${ticketId}/comments`),
  add: (ticketId: string, body: string) =>
    api.post<Comment>(`/tickets/${ticketId}/comments`, { body }),
}
