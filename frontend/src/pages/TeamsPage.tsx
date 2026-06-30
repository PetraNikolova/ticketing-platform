import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { teamsApi } from '../api/resources'
import { ApiError } from '../api/client'
import type { Team } from '../api/types'
import { queryKeys, useTeams } from '../hooks/queries'
import { useToast } from '../hooks/toast-context'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  TextInput,
} from '../components/ui'

export function TeamsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { data: teams = [], isLoading, isError, refetch } = useTeams()

  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<Team | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<Team | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.teams })

  const onError = (verb: string) => (err: unknown) =>
    showToast(
      err instanceof ApiError ? err.message : `Could not ${verb} the team.`,
      'error',
    )

  const create = useMutation({
    mutationFn: (name: string) => teamsApi.create(name),
    onSuccess: async () => {
      setNewName('')
      await invalidate()
      showToast('Team created.')
    },
    onError: onError('create'),
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      teamsApi.rename(id, name),
    onSuccess: async () => {
      setRenaming(null)
      await invalidate()
      showToast('Team renamed.')
    },
    onError: onError('rename'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => teamsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null)
      await invalidate()
      showToast('Team deleted.')
    },
    onError: (err: unknown) => {
      setDeleting(null)
      onError('delete')(err)
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Teams</h1>
        <p className="text-sm text-slate-500">
          Tickets and epics are grouped by team.
        </p>
      </div>

      <form
        className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (newName.trim()) create.mutate(newName.trim())
        }}
      >
        <div className="flex-1">
          <Field label="New team name" htmlFor="new-team">
            <TextInput
              id="new-team"
              placeholder="e.g. Platform"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={!newName.trim() || create.isPending}>
          {create.isPending ? 'Adding…' : 'Add team'}
        </Button>
      </form>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message="Could not load teams." onRetry={refetch} />
      )}
      {!isLoading && !isError && teams.length === 0 && (
        <EmptyState
          title="No teams yet"
          hint="Add your first team above."
        />
      )}

      {teams.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-800">{team.name}</p>
                <p className="text-xs text-slate-400">
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRenaming(team)
                    setRenameValue(team.name)
                  }}
                >
                  Rename
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(team)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Rename modal */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename team"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renaming && renameValue.trim()) {
                  rename.mutate({ id: renaming.id, name: renameValue.trim() })
                }
              }}
              disabled={!renameValue.trim() || rename.isPending}
            >
              {rename.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <Field label="Team name" htmlFor="rename-team">
          <TextInput
            id="rename-team"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete team"
        message={`Delete “${deleting?.name}”? A team that still contains epics or tickets cannot be deleted.`}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
