import { useEffect, useState } from 'react'
import { authenticatedFetch } from '../api/authenticatedFetch'
import { API_BASE_URL } from '../api/config'

const ADMIN_VIEWS = [
  { id: 'users', label: 'Users' },
  { id: 'cards', label: 'Cards' },
  { id: 'transactions', label: 'Transactions' },
]

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString()
}

function formatCurrency(value) {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function AdminDashboard({ onSessionExpired }) {
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [activeView, setActiveView] = useState('users')
  const [page, setPage] = useState(1)
  const [pageData, setPageData] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [isForbidden, setIsForbidden] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadSummary = async () => {
      setSummaryLoading(true)
      setSummaryError('')
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/admin-api/summary/`,
          {},
          onSessionExpired,
        )
        if (response.status === 403) {
          if (isActive) setIsForbidden(true)
          return
        }
        if (!response.ok) throw new Error('Admin summary unavailable')
        const data = await response.json()
        if (isActive) setSummary(data)
      } catch {
        if (isActive) setSummaryError('Unable to load the admin summary. Please try again.')
      } finally {
        if (isActive) setSummaryLoading(false)
      }
    }

    loadSummary()
    return () => {
      isActive = false
    }
  }, [onSessionExpired])

  useEffect(() => {
    let isActive = true

    const loadPage = async () => {
      setListLoading(true)
      setListError('')
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/admin-api/${activeView}/?page=${page}&page_size=25`,
          {},
          onSessionExpired,
        )
        if (response.status === 403) {
          if (isActive) setIsForbidden(true)
          return
        }
        if (!response.ok) throw new Error('Admin data unavailable')
        const data = await response.json()
        if (isActive) setPageData(data)
      } catch {
        if (isActive) setListError('Unable to load this list. Please try again.')
      } finally {
        if (isActive) setListLoading(false)
      }
    }

    loadPage()
    return () => {
      isActive = false
    }
  }, [activeView, onSessionExpired, page])

  if (isForbidden) {
    return (
      <section className="empty-state" role="alert">
        <h2>Admin access required</h2>
        <p>Your account is not authorized to view administration data.</p>
      </section>
    )
  }

  const rows = pageData?.results ?? []
  const pageCount = pageData ? Math.max(1, Math.ceil(pageData.count / 25)) : 1
  const tableHeaders = {
    users: ['ID', 'Name', 'Email', 'Role', 'Status', 'Joined'],
    cards: ['ID', 'User', 'Type', 'Cardholder', 'Masked number', 'Expiry'],
    transactions: ['ID', 'Reference', 'User', 'Card', 'Amount', 'Status', 'Date'],
  }

  return (
    <div className="admin-dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Admin dashboard</h1>
          <p className="page-description">Live account and payment overview.</p>
        </div>
        <span className="date-note">STAFF ACCESS</span>
      </div>

      {summaryLoading ? (
        <div className="page-loading" role="status">
          <span className="loading-dot" /> Loading administration summary...
        </div>
      ) : summaryError ? (
        <p className="form-message" role="alert">{summaryError}</p>
      ) : summary && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Administration summary">
            <article className="stat-card">
              <span className="stat-label">Total users</span>
              <p className="stat-value">{summary.total_users}</p>
              <p className="stat-footnote">Registered accounts</p>
            </article>
            <article className="stat-card stat-card-highlight">
              <span className="stat-label">Total cards</span>
              <p className="stat-value">{summary.total_cards}</p>
              <p className="stat-footnote">Masked payment methods</p>
            </article>
            <article className="stat-card">
              <span className="stat-label">Total transactions</span>
              <p className="stat-value">{summary.total_transactions}</p>
              <p className="stat-footnote">Recorded payments</p>
            </article>
            <article className="stat-card">
              <span className="stat-label">Today's payments</span>
              <p className="stat-value">{summary.today.payment_count}</p>
              <p className="stat-footnote">
                {summary.today.successful_count} successful · {formatCurrency(summary.today.successful_amount)}
              </p>
            </article>
          </section>

          <section className="activity-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LATEST</p>
                <h2>Recent transactions</h2>
              </div>
              <span className="activity-count">{summary.recent_transactions.length} shown</span>
            </div>
            {summary.recent_transactions.length === 0 ? (
              <div className="empty-state">
                <h3>No transactions yet</h3>
                <p>Payment activity will appear here when available.</p>
              </div>
            ) : (
              <div className="transaction-table-wrap">
                <table className="transaction-table">
                  <thead>
                    <tr><th scope="col">Reference</th><th scope="col">User</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Date</th></tr>
                  </thead>
                  <tbody>
                    {summary.recent_transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td><strong>#{transaction.id}</strong><small>{transaction.transaction_reference}</small></td>
                        <td>{transaction.user_id}</td>
                        <td className="transaction-table-amount">{formatCurrency(transaction.amount)}</td>
                        <td><span className={`status-pill status-${transaction.status.toLowerCase()}`}>{transaction.status}</span></td>
                        <td>{formatDate(transaction.transaction_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="activity-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">RECORDS</p>
                <h2>{ADMIN_VIEWS.find((view) => view.id === activeView)?.label}</h2>
              </div>
              <span className="activity-count">{pageData?.count ?? 0} total</span>
            </div>

            <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--line)]" aria-label="Admin data views" role="tablist">
              {ADMIN_VIEWS.map((view) => (
                <button
                  key={view.id}
                  className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${activeView === view.id ? 'border-[var(--green)] text-[var(--green-deep)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
                  type="button"
                  role="tab"
                  aria-selected={activeView === view.id}
                  onClick={() => {
                    setActiveView(view.id)
                    setPage(1)
                    setPageData(null)
                  }}
                >
                  {view.label}
                </button>
              ))}
            </nav>

            {listError && <p className="form-message" role="alert">{listError}</p>}
            {listLoading ? (
              <div className="page-loading" role="status">
                <span className="loading-dot" /> Loading {activeView}...
              </div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                <h3>No {activeView} found</h3>
                <p>There are no records to display on this page.</p>
              </div>
            ) : (
              <div className="transaction-table-wrap">
                <table className="transaction-table">
                  <thead><tr>{tableHeaders[activeView].map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
                  <tbody>
                    {activeView === 'users' && rows.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td><td>{user.name}</td><td>{user.email}</td>
                        <td>{user.is_superuser ? 'Superuser' : user.is_staff ? 'Staff' : 'Customer'}</td>
                        <td>{user.is_active ? 'Active' : 'Inactive'}</td><td>{formatDate(user.date_joined)}</td>
                      </tr>
                    ))}
                    {activeView === 'cards' && rows.map((card) => (
                      <tr key={card.id}>
                        <td>{card.id}</td><td>{card.user_id}</td><td>{card.card_type}</td>
                        <td>{card.card_holder_name}</td><td>{card.masked_card_number}</td>
                        <td>{String(card.expiry_month).padStart(2, '0')}/{card.expiry_year}</td>
                      </tr>
                    ))}
                    {activeView === 'transactions' && rows.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.id}</td><td>{transaction.transaction_reference}</td>
                        <td>{transaction.user_id}</td><td>{transaction.card_id}</td>
                        <td className="transaction-table-amount">{formatCurrency(transaction.amount)}</td>
                        <td><span className={`status-pill status-${transaction.status.toLowerCase()}`}>{transaction.status}</span></td>
                        <td>{formatDate(transaction.transaction_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span>Page {page} of {pageCount}</span>
              <div className="flex gap-2">
                <button className="transaction-detail-button" type="button" disabled={!pageData?.previous || listLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                <button className="transaction-detail-button" type="button" disabled={!pageData?.next || listLoading} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default AdminDashboard