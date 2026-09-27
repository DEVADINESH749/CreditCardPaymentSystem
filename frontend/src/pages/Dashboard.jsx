import { useEffect, useState } from 'react'
import { authenticatedFetch } from '../api/authenticatedFetch'
import { API_BASE_URL } from '../api/config'

function Dashboard({ onSessionExpired }) {
  const [cards, setCards] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('access_token')

      try {
        const [cardResponse, transactionResponse] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/cards/`, {
            headers: { Authorization: `Bearer ${token}` },
          }, onSessionExpired),
          authenticatedFetch(`${API_BASE_URL}/transactions/`, {
            headers: { Authorization: `Bearer ${token}` },
          }, onSessionExpired),
        ])

        const [cardData, transactionData] = await Promise.all([
          cardResponse.json(),
          transactionResponse.json(),
        ])

        setCards(Array.isArray(cardData) ? cardData : [])
        setTransactions(Array.isArray(transactionData) ? transactionData : [])
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [onSessionExpired])

  const successfulTransactions = transactions.filter(
    (transaction) => transaction.status === 'SUCCESS'
  )

  if (loading) {
    return (
      <div className="page-loading" role="status">
        <span className="loading-dot" /> Loading your overview...
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Your payment snapshot</h1>
          <p className="page-description">A clear view of your cards and recent activity.</p>
        </div>
        <span className="date-note">ACCOUNT SUMMARY</span>
      </div>

      <section className="stats-grid" aria-label="Account summary">
        <article className="stat-card">
          <div className="stat-card-top"><span className="stat-label">Saved cards</span><span className="stat-symbol">01</span></div>
          <p className="stat-value">{cards.length}</p>
          <p className="stat-footnote">Cards linked to your account</p>
        </article>
        <article className="stat-card stat-card-highlight">
          <div className="stat-card-top"><span className="stat-label">Transactions</span><span className="stat-symbol">02</span></div>
          <p className="stat-value">{transactions.length}</p>
          <p className="stat-footnote">Recorded payment activity</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-top"><span className="stat-label">Successful</span><span className="stat-symbol stat-symbol-green">03</span></div>
          <p className="stat-value">{successfulTransactions.length}</p>
          <p className="stat-footnote">Payments completed</p>
        </article>
      </section>

      <section className="activity-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LATEST</p>
            <h2>Recent activity</h2>
          </div>
          <span className="activity-count">{transactions.length} total</span>
        </div>

        {transactions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">—</span>
            <h3>No transactions yet</h3>
            <p>Your payment activity will appear here when available.</p>
          </div>
        ) : (
          <div className="activity-list">
            <div className="activity-list-head"><span>REFERENCE</span><span>AMOUNT</span><span>STATUS</span></div>
            {transactions.map((transaction) => (
              <article className="activity-row" key={transaction.id}>
                <div className="transaction-reference">
                  <span className="transaction-marker" />
                  <span><strong>{transaction.transaction_reference}</strong><small>{new Date(transaction.transaction_date).toLocaleDateString()}</small></span>
                </div>
                <strong className="transaction-amount">₹{Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <span className={`status-pill status-${transaction.status.toLowerCase()}`}>{transaction.status}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard