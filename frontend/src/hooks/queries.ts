import { useQuery } from '@tanstack/react-query'
import {
  commentsApi,
  epicsApi,
  teamsApi,
  ticketsApi,
  type TicketFilters,
} from '../api/resources'

// Central cache-key factory so reads and invalidations stay in sync.
export const queryKeys = {
  teams: ['teams'] as const,
  epics: (teamId?: string) => ['epics', teamId ?? 'all'] as const,
  tickets: (filters: TicketFilters) => ['tickets', filters] as const,
  ticket: (id: string) => ['ticket', id] as const,
  comments: (ticketId: string) => ['comments', ticketId] as const,
}

export function useTeams() {
  return useQuery({ queryKey: queryKeys.teams, queryFn: teamsApi.list })
}

export function useEpics(teamId?: string) {
  return useQuery({
    queryKey: queryKeys.epics(teamId),
    queryFn: () => epicsApi.list(teamId),
  })
}

export function useTickets(filters: TicketFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tickets(filters),
    queryFn: () => ticketsApi.list(filters),
    enabled,
  })
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: queryKeys.ticket(id ?? ''),
    queryFn: () => ticketsApi.get(id as string),
    enabled: !!id,
  })
}

export function useComments(ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.comments(ticketId ?? ''),
    queryFn: () => commentsApi.list(ticketId as string),
    enabled: !!ticketId,
  })
}
