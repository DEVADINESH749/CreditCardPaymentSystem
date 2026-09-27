import { useEffect, useState } from 'react'
import { authenticatedFetch } from '../api/authenticatedFetch'
import { API_BASE_URL } from '../api/config'

const EMPTY_FILTERS = {
  status: '',
  minAmount: '',
  maxAmount: '',
  fromDate: '',
  toDate: '',
}

function formatAmount(value) {
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function localDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function TransactionHistory({ onSessionExpired }) {
  const [transactions, setTransactions] = useState([])
  const [cardsById, setCardsById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [filterMessage, setFilterMessage] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    let isActive = true

    const loadTransactions = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) {
        onSessionExpired()
        return
      }

      const headers = { Authorization: `Bearer ${token}` }
      const [transactionResult, cardResult] = await Promise.allSettled([
        authenticatedFetch(`${API_BASE_URL}/transactions/`, { headers }, onSessionExpired),
        authenticatedFetch(`${API_BASE_URL}/cards/`, { headers }, onSessionExpired),
      ])

      if (transactionResult.status === 'rejected') {
        if (isActive) setErrorMessage('Unable to connect to transaction history. Please try again.')
        if (isActive) setIsLoading(false)
        return
      }

      const transactionResponse = transactionResult.value
      if (!transactionResponse.ok) {
        if (isActive) {
          setErrorMessage('Unable to load transaction history. Please try again.')
          setIsLoading(false)
        }
        return
      }

      const transactionData = await transactionResponse.json().catch(() => null)
      if (!Array.isArray(transactionData)) {
        if (isActive) {
          setErrorMessage('Transaction history could not be read. Please try again.')
          setIsLoading(false)
        }
        return
      }

      let cardLookup = {}
      if (cardResult.status === 'fulfilled' && cardResult.value.ok) {
        const cardData = await cardResult.value.json().catch(() => [])
        if (Array.isArray(cardData)) {
          cardLookup = Object.fromEntries(cardData.map((card) => [card.id, card]))
        }
      }

      if (isActive) {
        setTransactions(transactionData)
        setCardsById(cardLookup)
        setIsLoading(false)
      }
    }

    loadTransactions().catch(() => {
      if (isActive) {
        setErrorMessage('Unable to load transaction history. Please try again.')
        setIsLoading(false)
      }
    })

    return () => {
      isActive = false
    }
  }, [onSessionExpired])

  const applyFilters = (event) => {
    event.preventDefault()
    setFilterMessage('')

    const { minAmount, maxAmount, fromDate, toDate } = filters
    const validAmount = (value) => value === '' || (/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) && Number(value) >= 0)

    if (!validAmount(minAmount) || !validAmount(maxAmount)) {
      setFilterMessage('Enter valid minimum and maximum amounts with up to two decimal places.')
      return
    }
    if (minAmount !== '' && maxAmount !== '' && Number(minAmount) > Number(maxAmount)) {
      setFilterMessage('Minimum amount cannot be greater than maximum amount.')
      return
    }
    if (fromDate && toDate && fromDate > toDate) {
      setFilterMessage('From date cannot be later than To date.')
      return
    }

    setAppliedFilters({ ...filters })
    setSelectedTransaction(null)
    setDetailError('')
  }

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setFilterMessage('')
    setSelectedTransaction(null)
    setDetailError('')
  }

  const openDetails = async (transactionId) => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      onSessionExpired()
      return
    }

    setSelectedTransaction(null)
    setDetailError('')
    setIsLoadingDetail(true)

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/transactions/${transactionId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      }, onSessionExpired)

      if (!response.ok) {
        setDetailError('Unable to load this transaction. It may no longer be available.')
        return
      }

      const data = await response.json().catch(() => null)
      if (!data) {
        setDetailError('Transaction details could not be read. Please try again.')
        return
      }
      setSelectedTransaction(data)
    } catch {
      setDetailError('Unable to connect to transaction details. Please try again.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const visibleTransactions = transactions.filter((transaction) => {
    const transactionAmount = Number(transaction.amount)
    const transactionDate = localDateKey(transaction.transaction_date)

    if (appliedFilters.status && transaction.status !== appliedFilters.status) return false
    if (appliedFilters.minAmount !== '' && transactionAmount < Number(appliedFilters.minAmount)) return false
    if (appliedFilters.maxAmount !== '' && transactionAmount > Number(appliedFilters.maxAmount)) return false
    if (appliedFilters.fromDate && transactionDate < appliedFilters.fromDate) return false
    if (appliedFilters.toDate && transactionDate > appliedFilters.toDate) return false
    return true
  })

  if (isLoading) {
    return <div className="page-loading" role="status"><span className="loading-dot" /> Loading your transaction history...</div>
  }

  return (
    <div className="transaction-history-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT ACTIVITY</p>
          <h1>Transaction history</h1>
          <p className="page-description">Review your payments and filter by status, amount, or date.</p>
        </div>
        <span className="date-note">{visibleTransactions.length} SHOWN</span>
      </div>

      {errorMessage ? (
        <div className="empty-state transaction-empty" role="alert">
          <h2>History unavailable</h2>
          <p>{errorMessage}</p>
        </div>
      ) : (
        <>
          <form className="transaction-filters" onSubmit={applyFilters}>
            <div className="field-group">
              <label htmlFor="transaction-status">Status</label>
              <select
                id="transaction-status"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="transaction-min-amount">Minimum amount</label>
              <input
                id="transaction-min-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Any"
                value={filters.minAmount}
                onChange={(event) => setFilters({ ...filters, minAmount: event.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="transaction-max-amount">Maximum amount</label>
              <input
                id="transaction-max-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Any"
                value={filters.maxAmount}
                onChange={(event) => setFilters({ ...filters, maxAmount: event.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="transaction-from-date">From date</label>
              <input
                id="transaction-from-date"
                type="date"
                value={filters.fromDate}
                onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })}
              />
            </div>
            <div className="field-group">
              <label htmlFor="transaction-to-date">To date</label>
              <input
                id="transaction-to-date"
                type="date"
                value={filters.toDate}
                onChange={(event) => setFilters({ ...filters, toDate: event.target.value })}
              />
            </div>
            <div className="transaction-filter-actions">
              <button className="primary-button" type="submit">Apply filters</button>
              <button className="signout-button" type="button" onClick={resetFilters}>Reset</button>
            </div>
            {filterMessage && <p className="form-message transaction-filter-message" role="alert">{filterMessage}</p>}
          </form>

          {visibleTransactions.length === 0 ? (
            <div className="empty-state transaction-empty">
              <span className="empty-mark" aria-hidden="true">—</span>
              <h2>No transactions found</h2>
              <p>Try changing or resetting your filters.</p>
            </div>
          ) : (
            <div className="transaction-table-wrap">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th scope="col">Transaction</th>
                    <th scope="col">Date and time</th>
                    <th scope="col">Card</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="visually-hidden">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((transaction) => {
                    const card = cardsById[transaction.card_id]
                    return (
                      <tr key={transaction.id}>
                        <td>
                          <strong>#{transaction.id}</strong>
                          <small>{transaction.transaction_reference}</small>
                        </td>
                        <td>{formatDate(transaction.transaction_date)}</td>
                        <td>{card ? `${card.card_type} ···· ${card.last_four_digits}` : 'Saved card'}</td>
                        <td className="transaction-table-amount">₹{formatAmount(transaction.amount)}</td>
                        <td><span className={`status-pill status-${transaction.status.toLowerCase()}`}>{transaction.status}</span></td>
                        <td>
                          <button className="transaction-detail-button" type="button" onClick={() => openDetails(transaction.id)}>
                            View details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(isLoadingDetail || detailError || selectedTransaction) && (
            <section className="transaction-detail-panel" aria-live="polite">
              <div className="transaction-detail-heading">
                <div>
                  <p className="eyebrow">TRANSACTION DETAILS</p>
                  <h2>{selectedTransaction ? `Transaction #${selectedTransaction.id}` : 'Transaction details'}</h2>
                </div>
                {selectedTransaction && (
                  <button className="signout-button" type="button" onClick={() => setSelectedTransaction(null)}>
                    Close
                  </button>
                )}
              </div>
              {isLoadingDetail && <p className="transaction-detail-message" role="status">Loading transaction details...</p>}
              {detailError && <p className="form-message transaction-detail-message" role="alert">{detailError}</p>}
              {selectedTransaction && (
                <dl className="transaction-detail-grid">
                  <div><dt>Transaction ID</dt><dd>{selectedTransaction.id}</dd></div>
                  <div><dt>Amount</dt><dd>₹{formatAmount(selectedTransaction.amount)}</dd></div>
                  <div><dt>Status</dt><dd><span className={`status-pill status-${selectedTransaction.status.toLowerCase()}`}>{selectedTransaction.status}</span></dd></div>
                  <div><dt>Date and time</dt><dd>{formatDate(selectedTransaction.transaction_date)}</dd></div>
                  <div>
                    <dt>Card</dt>
                    <dd>
                      {cardsById[selectedTransaction.card_id]
                        ? `${cardsById[selectedTransaction.card_id].card_type} ending in ${cardsById[selectedTransaction.card_id].last_four_digits}`
                        : 'Saved card'}
                    </dd>
                  </div>
                  <div><dt>Reference</dt><dd>{selectedTransaction.transaction_reference}</dd></div>
                </dl>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default TransactionHistory