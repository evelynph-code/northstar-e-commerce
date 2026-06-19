import { useState } from 'react'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { auth } from '../lib/firebase.js'

const apiUrl = import.meta.env.VITE_API_URL || '/api'

const authMessages = {
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
}

function Field({ icon: Icon, label, ...inputProps }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
          {...inputProps}
        />
      </span>
    </label>
  )
}

function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const { authLoading, user } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (isSignup && form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      let credential

      if (isSignup) {
        credential = await createUserWithEmailAndPassword(auth, form.email, form.password)
        await updateProfile(credential.user, { displayName: form.name.trim() })
      } else {
        credential = await signInWithEmailAndPassword(auth, form.email, form.password)
      }

      const token = await credential.user.getIdToken(true)
      const response = await fetch(`${apiUrl}/auth/profile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: isSignup ? form.name.trim() : credential.user.displayName,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        if (isSignup) await deleteUser(credential.user)
        throw new Error(body.message || 'Unable to synchronize your profile.')
      }

      navigate('/')
    } catch (caughtError) {
      setError(authMessages[caughtError.code] || caughtError.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!authLoading && user) {
    return <Navigate replace to="/" />
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-[#11243e] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-28 -top-28 size-80 rounded-full bg-blue-500/20 blur-2xl" />
        <div className="absolute -bottom-32 -right-24 size-96 rounded-full bg-cyan-300/15 blur-3xl" />

        <Link className="relative z-10 flex items-center gap-2 text-2xl font-bold tracking-[-0.06em]" to="/">
          <ShoppingBag size={25} strokeWidth={1.8} />
          NORTHSTAR
        </Link>

        <div className="relative z-10 my-auto max-w-lg">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
            <ShieldCheck size={25} />
          </span>
          <h1 className="mt-7 text-5xl font-semibold leading-tight tracking-[-0.04em]">
            A smoother way to shop starts here.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-blue-100/80">
            Save favorites, check out faster, and keep every order in one secure place.
          </p>
        </div>

        <p className="relative z-10 text-sm text-blue-100/60">Secure authentication powered by Firebase</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <Link className="text-xl font-bold tracking-[-0.06em] text-[#11243e]" to="/">NORTHSTAR</Link>
            <Link aria-label="Back to store" className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600" to="/">
              <ArrowLeft size={18} />
            </Link>
          </div>

          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
            {isSignup ? 'Create account' : 'Welcome back'}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#11243e]">
            {isSignup ? 'Join Northstar' : 'Sign in to your account'}
          </h2>
          <p className="mt-3 text-slate-500">
            {isSignup ? 'Create your account in just a moment.' : 'Enter your details to continue shopping.'}
          </p>

          <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
            {isSignup && (
              <Field
                autoComplete="name"
                icon={UserRound}
                label="Full name"
                name="name"
                onChange={updateField}
                placeholder="Alex Morgan"
                required
                type="text"
                value={form.name}
              />
            )}

            <Field
              autoComplete="email"
              icon={Mail}
              label="Email address"
              name="email"
              onChange={updateField}
              placeholder="you@example.com"
              required
              type="email"
              value={form.email}
            />

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  minLength="6"
                  name="password"
                  onChange={updateField}
                  placeholder="At least 6 characters"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {isSignup && (
              <Field
                autoComplete="new-password"
                icon={LockKeyhole}
                label="Confirm password"
                name="confirmPassword"
                onChange={updateField}
                placeholder="Repeat your password"
                required
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
              />
            )}

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}

            <button
              className="w-full rounded-xl bg-[#11243e] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            {isSignup ? 'Already have an account?' : 'New to Northstar?'}{' '}
            <Link className="font-semibold text-blue-700 hover:text-blue-900" to={isSignup ? '/login' : '/signup'}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
