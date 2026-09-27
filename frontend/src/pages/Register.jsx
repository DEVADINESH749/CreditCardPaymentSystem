import { useState } from 'react'
import { API_BASE_URL } from '../api/config'
import PasswordField from '../components/PasswordField'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Register({ onLogin }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const cleanUsername = username.trim()
    const cleanEmail = email.trim()

    if (!cleanUsername || !cleanEmail || !password || !confirmPassword) {
      setFeedback({ type: 'error', text: 'Please complete all required fields.' })
      return
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setFeedback({ type: 'error', text: 'Enter a valid email address.' })
      return
    }

    if (password !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setIsSubmitting(true)
    setFeedback({ type: 'pending', text: 'Creating your account...' })

    try {
      const response = await fetch(`${API_BASE_URL}/users/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanUsername,
          email: cleanEmail,
          password,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setIsRegistered(true)
        setFeedback({
          type: 'success',
          text: 'Your account has been created. You can now sign in.',
        })
      } else if (response.status === 400 && data.email) {
        setFeedback({
          type: 'error',
          text: 'An account with this email already exists.',
        })
      } else if (response.status === 400 && data.name) {
        setFeedback({
          type: 'error',
          text: 'That username could not be used. Try a different username.',
        })
      } else {
        setFeedback({
          type: 'error',
          text: 'We could not create your account. Check your details and try again.',
        })
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Unable to connect to the server. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isRegistered) {
    return (
      <div className="login-panel-inner register-success-panel">
        <p className="eyebrow">ACCOUNT CREATED</p>
        <h2 id="login-title">You’re all set</h2>
        <p className="login-subtitle">Your PaySecure account is ready.</p>
        <p className="form-message register-message is-success" role="status" aria-live="polite">
          {feedback.text}
        </p>
        <button className="primary-button login-submit" type="button" onClick={() => onLogin(email.trim())}>
          Continue to sign in <span aria-hidden="true">→</span>
        </button>
      </div>
    )
  }

  return (
    <div className="login-panel-inner register-panel-inner">
      <p className="eyebrow">GET STARTED</p>
      <h2 id="login-title">Create your account</h2>
      <p className="login-subtitle">Enter your details to get started.</p>

      <form className="login-form register-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <div className="field-group">
          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <PasswordField
          id="register-password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />

        {feedback && (
          <p className={`form-message register-message is-${feedback.type}`} role="status" aria-live="polite">
            {feedback.text}
          </p>
        )}

        <button className="primary-button login-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Register'}
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" onClick={() => onLogin()}>
          Sign in
        </button>
      </p>
    </div>
  )
}

export default Register