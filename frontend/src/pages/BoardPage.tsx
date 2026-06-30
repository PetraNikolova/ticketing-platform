import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ticketsApi, type TicketFilters } from '../api/resources'
import {
  TICKET_STATES,
  TICKET_TYPES,
  TYPE_LABELS,
  type Ticket,
  type TicketState,
} from '../api/types'
import { queryKeys, useEpics, useTeams, useTickets } from '../hooks/queries'
import { useToast } from '../hooks/toast-context'
import { BoardColumn } from '../components/BoardColumn'
import { TicketCard, TicketCardPreview } from '../components/TicketCard'
import { TicketFormModal } from '../components/TicketFormModal'
import { TicketDetailsModal } from '../components/TicketDetailsModal'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  TextInput,
} from '../components/ui'

export function BoardPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: teams = [], isLoading: teamsLoading } = useTeams()
  const selectedTeamId = searchParams.get('team') ?? teams[0]?.id ?? ''

  const [typeFilter, setTypeFilter] = useState('')
  const [epicFilter, setEpicFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: epics = [] } = useEpics(selectedTeamId || undefined)
  const epicTitles = useMemo(
    () => new Map(epics.map((e) => [e.id, e.title])),
    [epics],
  )

  const filters: TicketFilters = {
    teamId: selectedTeamId || undefined,
    type: (typeFilter as TicketFilters['type']) || undefined,
    epicId: epicFilter || undefined,
    q: search.trim() || undefined,
  }
  const {
    data: tickets = [],
    isLoading,
    isError,
    refetch,
  } = useTickets(filters, !!selectedTeamId)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const move = useMutation({
    mutationFn: ({ id, state }: { id: string; state: TicketState }) =>
      ticketsApi.setState(id, state),
    onMutate: async ({ id, state }) => {
      const key = queryKeys.tickets(filters)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Ticket[]>(key)
      queryClient.setQueryData<Ticket[]>(key, (old = []) =>
        old.map((t) => (t.id === id ? { ...t, state } : t)),
      )
      return { previous, key }
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
      showToast(
        'Could not move the ticket — it was returned to its previous column.',
        'error',
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const targetState = over.id as TicketState
    const ticket = tickets.find((t) => t.id === active.id)
    if (ticket && ticket.state !== targetState) {
      move.mutate({ id: ticket.id, state: targetState })
    }
  }

  const selectTeam = (id: string) => {
    setSearchParams(id ? { team: id } : {})
    setEpicFilter('')
  }

  const activeTicket = activeId
    ? tickets.find((t) => t.id === activeId)
    : undefined

  // ── No teams yet ──────────────────────────────────────────────────────────
  if (!teamsLoading && teams.length === 0) {
    return (
      <EmptyState
        title="No teams yet"
        hint="Create your first team to start tracking tickets on a board."
        action={
          <Link to="/teams">
            <Button>Go to Team management</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Team"
          className="w-56"
          value={selectedTeamId}
          onChange={(e) => selectTeam(e.target.value)}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <TextInput
            className="w-52"
            placeholder="Search title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            aria-label="Filter by type"
            className="w-36"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {TICKET_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by epic"
            className="w-44"
            value={epicFilter}
            onChange={(e) => setEpicFilter(e.target.value)}
          >
            <option value="">All epics</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </Select>
          <Button
            onClick={() => {
              setEditingId(undefined)
              setFormOpen(true)
            }}
          >
            + New ticket
          </Button>
        </div>
      </div>

      {/* Board */}
      {isLoading && <LoadingState label="Loading tickets…" />}
      {isError && (
        <ErrorState message="Could not load tickets." onRetry={refetch} />
      )}
      {!isLoading && !isError && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
            {TICKET_STATES.map((state) => {
              const columnTickets = tickets.filter((t) => t.state === state)
              return (
                <BoardColumn
                  key={state}
                  state={state}
                  count={columnTickets.length}
                >
                  {columnTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      epicTitle={
                        ticket.epicId
                          ? epicTitles.get(ticket.epicId)
                          : undefined
                      }
                      onOpen={() => setDetailsId(ticket.id)}
                    />
                  ))}
                </BoardColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeTicket ? (
              <TicketCardPreview
                ticket={activeTicket}
                epicTitle={
                  activeTicket.epicId
                    ? epicTitles.get(activeTicket.epicId)
                    : undefined
                }
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create / edit modal */}
      <TicketFormModal
        open={formOpen}
        ticketId={editingId}
        teams={teams}
        defaultTeamId={selectedTeamId || undefined}
        onClose={() => setFormOpen(false)}
      />

      {/* Details modal */}
      {detailsId && (
        <TicketDetailsModal
          open={!!detailsId}
          ticketId={detailsId}
          teams={teams}
          onClose={() => setDetailsId(null)}
          onEdit={() => {
            setEditingId(detailsId)
            setDetailsId(null)
            setFormOpen(true)
          }}
        />
      )}
    </div>
  )
}
