import { useState, type FormEvent } from 'react'
import { ACCESS_TOKEN_KEY } from '../services/api'
import { getCurrentUser, getErrorMessage, loginUser, registerUser, type User } from '../services/backend'

interface AuthPanelProps {
  onAuthenticated: (user: User) => void
}

function AuthPanel({ onAuthenticated }: AuthPanelProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegistering) {
        await registerUser(name, email, password)
      }
      const token = await loginUser(email, password)
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
      onAuthenticated(await getCurrentUser())
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to sign in. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-brand">
          <div className="brand-icon">₹</div>
          <div>
            <h2>ReceiptIQ</h2>
            <span>PAYMENT ANALYTICS</span>
          </div>
        </div>
        <p className="eyebrow">{isRegistering ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</p>
        <h1>{isRegistering ? 'Create your account' : 'Sign in to continue'}</h1>
        <p className="subtitle">Your receipts and payment records are private to your account.</p>

        {isRegistering && (
          <label className="form-field">
            <span>Name</span>
            <input autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
          </label>
        )}
        <label className="form-field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            minLength={isRegistering ? 8 : undefined}
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={loading}>
          {loading ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}
        </button>
        <p className="auth-switch">
          {isRegistering ? 'Already registered?' : 'New here?'}{' '}
          <button type="button" onClick={() => {
            setIsRegistering(value => !value)
            setError('')
          }}>
            {isRegistering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </main>
  )
}

export default AuthPanel
