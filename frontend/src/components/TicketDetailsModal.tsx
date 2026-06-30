import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commentsApi, ticketsApi } from '../api/resources'
import { ApiError } from '../api/client'
import { STATE_LABELS, type Team } from '../api/types'
import { useComments, useEpics, useTicket } from '../hooks/queries'
import { useToast } from '../hooks/toast-context'
import { Modal } from './Modal'
import { ConfirmDialog } from './ConfirmDialog'
import {
  Button,
  ErrorState,
  LoadingState,
  TextArea,
  TypeBadge,
} from './ui'

interface TicketDetailsModalProps {
  open: boolean
  ticketId: string
  teams: Team[]
  onClose: () => void
  onEdit: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function TicketDetailsModal({
  open,
  ticketId,
  teams,
  onClose,
  onEdit,
}: TicketDetailsModalProps) {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data: ticket, isLoading, isError, refetch } = useTicket(
    open ? ticketId : null,
  )
  const { data: comments = [] } = useComments(open ? ticketId : null)
  const { data: epics = [] } = useEpics(ticket?.teamId)
  const [commentBody, setCommentBody] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const teamName = teams.find((t) => t.id === ticket?.teamId)?.name ?? '—'
  const epicTitle = epics.find((e) => e.id === ticket?.epicId)?.title

  const addComment = useMutation({
    mutationFn: (body: string) => commentsApi.add(ticketId, body),
    onSuccess: async () => {
      setCommentBody('')
      await queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })
    },
    onError: (err: unknown) => {
      showToast(
        err instanceof ApiError ? err.message : 'Could not add the comment.',
        'error',
      )
    },
  })

  const remove = useMutation({
    mutationFn: () => ticketsApi.remove(ticketId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
      showToast('Ticket deleted.')
      setConfirmOpen(false)
      onClose()
    },
    onError: (err: unknown) => {
      showToast(
        err instanceof ApiError ? err.message : 'Could not delete the ticket.',
        'error',
      )
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ticket?.title ?? 'Ticket'}
      wide
      footer={
        ticket && (
          <>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          </>
        )
      }
    >
      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message="Could not load this ticket." onRetry={refetch} />
      )}

      {ticket && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={ticket.type} />
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {STATE_LABELS[ticket.state]}
            </span>
            {epicTitle && (
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {epicTitle}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-400">Team</dt>
              <dd className="text-slate-700">{teamName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Created by</dt>
              <dd className="truncate text-slate-700">
                {ticket.createdBy.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Created</dt>
              <dd className="text-slate-700">{formatDate(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">
                Last modified
              </dt>
              <dd className="text-slate-700">{formatDate(ticket.modifiedAt)}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-1 text-xs font-medium text-slate-400">
              Description
            </h3>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {ticket.body}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Comments ({comments.length})
            </h3>
            <div className="flex flex-col gap-2">
              {comments.length === 0 && (
                <p className="text-sm text-slate-400">No comments yet.</p>
              )}
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-slate-100 bg-white p-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium text-slate-600">
                      {comment.author.email}
                    </span>
                    <span>{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>

            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (commentBody.trim()) addComment.mutate(commentBody.trim())
              }}
            >
              <TextArea
                rows={2}
                placeholder="Add a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!commentBody.trim() || addComment.isPending}
                >
                  {addComment.isPending ? 'Posting…' : 'Comment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete ticket"
        message="This ticket and its comments will be permanently deleted. This cannot be undone."
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </Modal>
  )
}
