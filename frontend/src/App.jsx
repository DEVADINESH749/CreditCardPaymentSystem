import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Cards from './pages/Cards'
import AddCard from './pages/AddCard'
import Register from './pages/Register'
import Payment from './pages/Payment'
import TransactionHistory from './pages/TransactionHistory'
import AdminDashboard from './pages/AdminDashboard'
import { authenticatedFetch, clearAuthTokens, storeAuthTokens } from './api/authenticatedFetch'
import { API_BASE_URL } from './api/config'
import PasswordField from './components/PasswordField'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem('access_token')
  )
  const [currentUser, setCurrentUser] = useState(null)

  const [authPage, setAuthPage] = useState('login')
  const [currentPage, setCurrentPage] = useState('dashboard')

  const handleLogin = async (e) => {
    e.preventDefault()

    setIsSubmitting(true)
    setMessage('Signing in...')

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/login/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            password: password,
          }),
        }
      )

      const data = await response.json()
      if (response.ok) {
        storeAuthTokens(data)
        setCurrentUser(null)
        setIsLoggedIn(true)
        setCurrentPage('dashboard')
      } else {
        setMessage(data.detail || 'Invalid email or password')
      }
    } catch (error) {
      console.error(error)
      setMessage('Unable to connect to backend')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = useCallback((notice = '') => {
    clearAuthTokens()
    setIsLoggedIn(false)
    setCurrentUser(null)
    setEmail('')
    setPassword('')
    setMessage(notice)
    setCurrentPage('dashboard')
  }, [])

  const handleSessionExpired = useCallback(() => {
    handleLogout('Your session has expired. Please log in again.')
  }, [handleLogout])

  useEffect(() => {
    if (!isLoggedIn) return undefined

    let isActive = true
    const loadCurrentUser = async () => {
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/users/me/`,
          {},
          handleSessionExpired,
        )
        if (!response.ok) return
        const user = await response.json()
        if (isActive) setCurrentUser(user)
      } catch (error) {
        console.error('Unable to load current user profile:', error)
      }
    }

    loadCurrentUser()
    return () => {
      isActive = false
    }
  }, [isLoggedIn, handleSessionExpired])

  const hasAdminAccess = Boolean(currentUser?.is_staff || currentUser?.is_superuser)
  const activePage = currentPage === 'admin' && !hasAdminAccess
    ? 'dashboard'
    : currentPage

  if (!isLoggedIn) {
    return (
      <div className="login-page min-h-screen">
        <div className="login-layout">
          <section className="login-intro">
            <div className="brand-lockup">
              <span className="brand-mark">P</span>
              <span className="brand-name">PaySecure</span>
            </div>
            <div className="login-intro-copy">
              <p className="eyebrow eyebrow-light">YOUR FINANCIAL SPACE</p>
              <h1>Spend with<br />a clearer view.</h1>
              <p className="login-intro-description">
                Keep your cards and payment activity together in one considered,
                secure place.
              </p>
            </div>
            <div className="login-card-art" aria-hidden="true">
              <div className="art-card-top">
                <span>PAYSECURE</span>
                <span className="art-card-mark">P</span>
              </div>
              <div className="art-chip"><span /><span /><span /><span /></div>
              <div className="art-card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 2048</div>
              <div className="art-card-bottom">
                <span>PERSONAL ACCOUNT</span>
                <span>VISA</span>
              </div>
            </div>
            <div className="login-intro-foot">
              <span className="intro-foot-rule" />
              <span>CLARITY IN EVERY TRANSACTION</span>
            </div>
          </section>

          <section className="login-panel" aria-labelledby="login-title">
            {authPage === 'register' ? (
              <Register
                onLogin={(registeredEmail) => {
                  if (registeredEmail) setEmail(registeredEmail)
                  setAuthPage('login')
                }}
              />
            ) : (
            <div className="login-panel-inner">
              <p className="eyebrow">ACCOUNT ACCESS</p>
              <h2 id="login-title">Welcome back</h2>
              <p className="login-subtitle">Sign in to continue to your account.</p>

              <form className="login-form" onSubmit={handleLogin}>
                <div className="field-group">
                  <label htmlFor="email">Email address</label>
                <input
                    id="email"
                  type="email"
                    placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  required
                />
              </div>
                <PasswordField
                  id="password"
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                {message && (
                  <p
                    className={`form-message ${isSubmitting ? 'is-pending' : 'is-error'}`}
                    role="status"
                    aria-live="polite"
                  >
                    {message}
                  </p>
                )}
                <button className="primary-button login-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              <p className="auth-switch">
                New to PaySecure?{' '}
                <button type="button" onClick={() => setAuthPage('register')}>
                  Create an account
                </button>
              </p>

              <div className="login-assurance">
                <span className="assurance-mark" aria-hidden="true">✓</span>
                <span>Your account details are protected with secure sign-in.</span>
              </div>
              <p className="login-copyright">© 2026 PaySecure</p>
            </div>
            )}
          </section>

        </div>
      </div>
    )
  }

  const pageLabels = {
    dashboard: 'Overview',
    cards: 'My cards',
    'add-card': 'Add a card',
    payment: 'Make payment',
    transactions: 'Transaction history',
    admin: 'Admin dashboard',
  }

  return (
    <div className="app-shell min-h-screen">
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark">P</span>
          <span className="brand-name">PaySecure</span>
        </div>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <button
            className={currentPage === 'dashboard' ? 'nav-item is-active' : 'nav-item'}
            onClick={() => setCurrentPage('dashboard')}
            aria-current={currentPage === 'dashboard' ? 'page' : undefined}
          >
            <span className="nav-index">01</span>Overview
          </button>
          <button
            className={currentPage === 'cards' ? 'nav-item is-active' : 'nav-item'}
            onClick={() => setCurrentPage('cards')}
            aria-current={currentPage === 'cards' ? 'page' : undefined}
          >
            <span className="nav-index">02</span>My cards
          </button>
          <button
            className={currentPage === 'add-card' ? 'nav-item is-active' : 'nav-item'}
            onClick={() => setCurrentPage('add-card')}
            aria-current={currentPage === 'add-card' ? 'page' : undefined}
          >
            <span className="nav-index">03</span>Add a card
          </button>
          <button
            className={currentPage === 'payment' ? 'nav-item is-active' : 'nav-item'}
            onClick={() => setCurrentPage('payment')}
            aria-current={currentPage === 'payment' ? 'page' : undefined}
          >
            <span className="nav-index">04</span>Make payment
          </button>
          <button
            className={currentPage === 'transactions' ? 'nav-item is-active' : 'nav-item'}
            onClick={() => setCurrentPage('transactions')}
            aria-current={currentPage === 'transactions' ? 'page' : undefined}
          >
            <span className="nav-index">05</span>Transaction history
          </button>
          {(currentUser?.is_staff || currentUser?.is_superuser) && (
            <button
              className={currentPage === 'admin' ? 'nav-item is-active' : 'nav-item'}
              onClick={() => setCurrentPage('admin')}
              aria-current={currentPage === 'admin' ? 'page' : undefined}
            >
              <span className="nav-index">06</span>Admin dashboard
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="secure-indicator" />
          <span><strong>Secure session</strong><small>Connection protected</small></span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {pageLabels[activePage]}</div>
          <div className="account-chip">
            <span className="account-avatar">PS</span>
            <span className="account-label">Personal account</span>
            <button className="signout-button" type="button" onClick={() => handleLogout()}>
              Sign out
            </button>
          </div>
        </header>
        <main className="page-content">
          {activePage === 'dashboard' && <Dashboard onSessionExpired={handleSessionExpired} />}
          {activePage === 'cards' && (
            <Cards
              onAddCard={() => setCurrentPage('add-card')}
              onSessionExpired={handleSessionExpired}
            />
          )}
          {activePage === 'add-card' && (
            <AddCard onSessionExpired={handleSessionExpired} />
          )}
          {activePage === 'payment' && (
            <Payment
              onAddCard={() => setCurrentPage('add-card')}
              onSessionExpired={handleSessionExpired}
            />
          )}
          {activePage === 'transactions' && (
            <TransactionHistory onSessionExpired={handleSessionExpired} />
          )}
          {activePage === 'admin' && hasAdminAccess && (
            <AdminDashboard onSessionExpired={handleSessionExpired} />
          )}
        </main>
        <footer className="app-footer"><span>PaySecure</span><span>Payment workspace</span></footer>
      </div>
    </div>
  )
}

export default App