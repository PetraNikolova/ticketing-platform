import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '../api/resources'
import { ApiError } from '../api/client'
import {
  STATE_LABELS,
  TICKET_STATES,
  TICKET_TYPES,
  TYPE_LABELS,
  type Team,
  type TicketState,
  type TicketType,
} from '../api/types'
import { useEpics, useTicket } from '../hooks/queries'
import { useToast } from '../hooks/toast-context'
import { Modal } from './Modal'
import { Button, Field, Select, TextArea, TextInput } from './ui'

interface TicketFormValues {
  teamId: string
  type: TicketType
  epicId: string
  state: TicketState
  title: string
  body: string
}

interface TicketFormModalProps {
  open: boolean
  ticketId?: string
  teams: Team[]
  defaultTeamId?: string
  onClose: () => void
}

export function TicketFormModal({
  open,
  ticketId,
  teams,
  defaultTeamId,
  onClose,
}: TicketFormModalProps) {
  const isEdit = !!ticketId
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data: existing } = useTicket(open && ticketId ? ticketId : null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    defaultValues: {
      teamId: defaultTeamId ?? '',
      type: 'feature',
      epicId: '',
      state: 'new',
      title: '',
      body: '',
    },
  })

  const teamId = watch('teamId')
  const { data: epics = [] } = useEpics(teamId || undefined)

  // Prefill when editing (once the ticket loads), or reset for a fresh create.
  useEffect(() => {
    if (!open) return
    if (isEdit && existing) {
      reset({
        teamId: existing.teamId,
        type: existing.type,
        epicId: existing.epicId ?? '',
        state: existing.state,
        title: existing.title,
        body: existing.body,
      })
    } else if (!isEdit) {
      reset({
        teamId: defaultTeamId ?? '',
        type: 'feature',
        epicId: '',
        state: 'new',
        title: '',
        body: '',
      })
    }
  }, [open, isEdit, existing, defaultTeamId, reset])

  const mutation = useMutation({
    mutationFn: (values: TicketFormValues) => {
      const epicId = values.epicId || null
      if (isEdit && ticketId) {
        return ticketsApi.update(ticketId, {
          teamId: values.teamId,
          type: values.type,
          epicId,
          state: values.state,
          title: values.title,
          body: values.body,
        })
      }
      return ticketsApi.create({
        teamId: values.teamId,
        type: values.type,
        epicId,
        title: values.title,
        body: values.body,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      if (ticketId) {
        await queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      }
      showToast(isEdit ? 'Ticket updated.' : 'Ticket created.')
      onClose()
    },
    onError: (err: unknown) => {
      showToast(
        err instanceof ApiError ? err.message : 'Could not save the ticket.',
        'error',
      )
    },
  })

  const onSubmit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit ticket' : 'New ticket'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="ticket-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create ticket'}
          </Button>
        </>
      }
    >
      <form
        id="ticket-form"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <TextInput
            id="title"
            {...register('title', { required: 'Title is required' })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Team" htmlFor="teamId" error={errors.teamId?.message}>
            <Select
              id="teamId"
              {...register('teamId', { required: 'Team is required' })}
              onChange={(e) => {
                // Team change clears the selected epic (it may be cross-team).
                setValue('teamId', e.target.value)
                setValue('epicId', '')
              }}
            >
              <option value="" disabled>
                Select a team…
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type" htmlFor="type">
            <Select id="type" {...register('type')}>
              {TICKET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Epic (optional)" htmlFor="epicId">
            <Select id="epicId" {...register('epicId')} disabled={!teamId}>
              <option value="">No epic</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id}>
                  {epic.title}
                </option>
              ))}
            </Select>
          </Field>

          {isEdit && (
            <Field label="State" htmlFor="state">
              <Select id="state" {...register('state')}>
                {TICKET_STATES.map((state) => (
                  <option key={state} value={state}>
                    {STATE_LABELS[state]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Body" htmlFor="body" error={errors.body?.message}>
          <TextArea
            id="body"
            rows={6}
            {...register('body', { required: 'Body is required' })}
          />
        </Field>
      </form>
    </Modal>
  )
}
