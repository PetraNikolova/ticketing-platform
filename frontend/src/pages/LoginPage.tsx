import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/auth-context'
import { authApi } from '../api/resources'
import { ApiError } from '../api/client'
import { AuthShell } from './AuthShell'
import { Button, Field, TextInput } from '../components/ui'

interface LoginForm {
  email: string
  password: string
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resent, setResent] = useState(false)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { email: '', password: '' } })

  if (user) {
    return <Navigate to="/board" replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setNeedsVerification(false)
    try {
      await login(values.email, values.password)
      navigate('/board', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNeedsVerification(true)
      } else if (err instanceof ApiError) {
        setFormError(err.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    }
  })

  const onResend = async () => {
    try {
      await authApi.resend(getValues('email'))
    } finally {
      setResent(true)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your ticketing workspace."
      footer={
        <>
          No account?{' '}
          <Link to="/signup" className="font-semibold text-brand-700">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            {...register('email', { required: 'Email is required' })}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password', { required: 'Password is required' })}
          />
        </Field>

        {formError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        {needsVerification && (
          <div className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
            <p>Please verify your email address before logging in.</p>
            {resent ? (
              <p className="mt-1 font-medium">
                If that account exists and is unverified, a new link is on its
                way.
              </p>
            ) : (
              <button
                type="button"
                onClick={onResend}
                className="mt-1 font-semibold text-amber-900 underline"
              >
                Resend verification email
              </button>
            )}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthShell>
  )
}
