import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { epicsApi, type EpicInput } from '../api/resources'
import { ApiError } from '../api/client'
import type { Epic } from '../api/types'
import { queryKeys, useEpics, useTeams } from '../hooks/queries'
import { useToast } from '../hooks/toast-context'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Select,
  TextArea,
  TextInput,
} from '../components/ui'

export function EpicsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { data: teams = [], isLoading: teamsLoading } = useTeams()
  const [teamId, setTeamId] = useState('')

  // Default to the first team once teams load.
  useEffect(() => {
    if (!teamId && teams.length > 0) setTeamId(teams[0].id)
  }, [teams, teamId])

  const {
    data: epics = [],
    isLoading,
    isError,
    refetch,
  } = useEpics(teamId || undefined)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Epic | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deleting, setDeleting] = useState<Epic | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.epics(teamId) })

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setDescription('')
    setFormOpen(true)
  }

  const openEdit = (epic: Epic) => {
    setEditing(epic)
    setTitle(epic.title)
    setDescription(epic.description ?? '')
    setFormOpen(true)
  }

  const save = useMutation({
    mutationFn: () => {
      const input: EpicInput = {
        title: title.trim(),
        description: description.trim() || null,
      }
      return editing
        ? epicsApi.update(editing.id, input)
        : epicsApi.create(teamId, input)
    },
    onSuccess: async () => {
      setFormOpen(false)
      await invalidate()
      showToast(editing ? 'Epic updated.' : 'Epic created.')
    },
    onError: (err: unknown) =>
      showToast(
        err instanceof ApiError ? err.message : 'Could not save the epic.',
        'error',
      ),
  })

  const remove = useMutation({
    mutationFn: (id: string) => epicsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null)
      await invalidate()
      showToast('Epic deleted.')
    },
    onError: (err: unknown) => {
      setDeleting(null)
      showToast(
        err instanceof ApiError ? err.message : 'Could not delete the epic.',
        'error',
      )
    },
  })

  if (!teamsLoading && teams.length === 0) {
    return (
      <EmptyState
        title="No teams yet"
        hint="Epics belong to a team — create a team first."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Epics</h1>
          <p className="text-sm text-slate-500">
            Each epic belongs to one team and groups related tickets.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select
            aria-label="Team"
            className="w-56"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
          <Button onClick={openCreate} disabled={!teamId}>
            + New epic
          </Button>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message="Could not load epics." onRetry={refetch} />
      )}
      {!isLoading && !isError && epics.length === 0 && (
        <EmptyState
          title="No epics for this team"
          hint="Create an epic to group tickets under a shared goal."
          action={<Button onClick={openCreate}>+ New epic</Button>}
        />
      )}

      {epics.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {epics.map((epic) => (
            <li
              key={epic.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{epic.title}</p>
                {epic.description && (
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {epic.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => openEdit(epic)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(epic)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit epic' : 'New epic'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!title.trim() || save.isPending}
            >
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="epic-title">
            <TextInput
              id="epic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Description (optional)" htmlFor="epic-desc">
            <TextArea
              id="epic-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete epic"
        message={`Delete “${deleting?.title}”? An epic referenced by tickets cannot be deleted.`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
