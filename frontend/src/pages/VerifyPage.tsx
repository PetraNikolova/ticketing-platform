import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/resources'
import { ApiError } from '../api/client'
import { AuthShell } from './AuthShell'
import { Button, Field, TextInput } from '../components/ui'

type Status = 'verifying' | 'success' | 'error'

export function VerifyPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  // StrictMode mounts effects twice in dev; guard the single-use token call.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!token) {
      setStatus('error')
      setMessage('This verification link is missing its token.')
      return
    }
    authApi
      .verify(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setStatus('error')
        setMessage(
          err instanceof ApiError
            ? err.message
            : 'We could not verify this link.',
        )
      })
  }, [token])

  if (status === 'verifying') {
    return (
      <AuthShell title="Verifying your email…">
        <p className="text-sm text-slate-500">One moment please.</p>
      </AuthShell>
    )
  }

  if (status === 'success') {
    return (
      <AuthShell
        title="Email verified 🎉"
        subtitle="Your account is ready. You can now log in."
      >
        <Link to="/login">
          <Button className="w-full">Continue to login</Button>
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Verification failed"
      subtitle={message}
      footer={
        <Link to="/login" className="font-semibold text-brand-700">
          Back to login
        </Link>
      }
    >
      {resent ? (
        <p className="text-sm font-medium text-slate-700">
          If that account exists and is unverified, a new verification link has
          been sent.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await authApi.resend(email)
            setResent(true)
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Resend verification email" htmlFor="resend-email">
            <TextInput
              id="resend-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Button type="submit">Send a new link</Button>
        </form>
      )}
    </AuthShell>
  )
}
