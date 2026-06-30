import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/auth-context'
import { authApi } from '../api/resources'
import { ApiError } from '../api/client'
import { AuthShell } from './AuthShell'
import { Button, Field, TextInput } from '../components/ui'

interface SignupForm {
  email: string
  password: string
}

export function SignupPage() {
  const { user } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ defaultValues: { email: '', password: '' } })

  if (user) {
    return <Navigate to="/board" replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await authApi.signup(values.email, values.password)
      setSubmittedEmail(values.email)
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    }
  })

  if (submittedEmail) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`We sent a verification link to ${submittedEmail}.`}
        footer={
          <Link to="/login" className="font-semibold text-brand-700">
            Back to login
          </Link>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-slate-600">
          <p>
            Click the link in the email to verify your account, then log in. The
            link is valid for 24 hours and can be used once.
          </p>
          {resent ? (
            <p className="font-medium text-slate-700">
              A fresh verification link has been sent.
            </p>
          ) : (
            <Button
              variant="secondary"
              onClick={async () => {
                await authApi.resend(submittedEmail)
                setResent(true)
              }}
            >
              Resend verification email
            </Button>
          )}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign up with your email and a password."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700">
            Log in
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
          hint="At least 8 characters."
        >
          <TextInput
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters',
              },
            })}
          />
        </Field>

        {formError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
    </AuthShell>
  )
}
