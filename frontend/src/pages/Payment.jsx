import { useEffect, useState } from 'react'
import { authenticatedFetch } from '../api/authenticatedFetch'
import { API_BASE_URL } from '../api/config'

const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL || 'http://127.0.0.1:8001'
const MAX_PAYMENT_AMOUNT = 99999999.99

function formatAmount(value) {
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function Payment({ onAddCard, onSessionExpired }) {
  const [cards, setCards] = useState([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoadingCards, setIsLoadingCards] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [paymentResult, setPaymentResult] = useState(null)

  useEffect(() => {
    let isActive = true

    const loadCards = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) {
        onSessionExpired()
        return
      }

      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/cards/`, {
          headers: { Authorization: `Bearer ${token}` },
        }, onSessionExpired)

        const data = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(data)) {
          if (isActive) {
            setFeedback({ type: 'error', text: 'Unable to load your saved cards. Please try again.' })
          }
          return
        }

        if (isActive) {
          setCards(data)
          setSelectedCardId(data.length ? String(data[0].id) : '')
        }
      } catch {
        if (isActive) {
          setFeedback({ type: 'error', text: 'Unable to connect to your saved cards. Please try again.' })
        }
      } finally {
        if (isActive) setIsLoadingCards(false)
      }
    }

    loadCards()
    return () => {
      isActive = false
    }
  }, [onSessionExpired])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)
    setPaymentResult(null)

    const selectedCard = cards.find((card) => String(card.id) === selectedCardId)
    if (!selectedCard) {
      setFeedback({ type: 'error', text: 'Select one of your saved cards.' })
      return
    }

    if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(amount)) {
      setFeedback({ type: 'error', text: 'Enter an amount greater than zero with up to two decimal places.' })
      return
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > MAX_PAYMENT_AMOUNT) {
      setFeedback({ type: 'error', text: 'Enter an amount greater than zero within the allowed limit.' })
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      onSessionExpired()
      return
    }

    setIsSubmitting(true)
    setFeedback({ type: 'pending', text: 'Submitting payment...' })

    try {
      const response = await authenticatedFetch(`${PAYMENT_API_URL}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_id: Number(selectedCardId),
          amount,
        }),
      }, onSessionExpired)

      const data = await response.json().catch(() => null)

      if (response.status === 404) {
        setFeedback({ type: 'error', text: 'That saved card could not be found. Refresh your cards and try again.' })
        return
      }

      if (response.status === 422) {
        setFeedback({ type: 'error', text: 'Check the selected card and enter a valid amount with up to two decimal places.' })
        return
      }

      if (response.status === 503) {
        setFeedback({ type: 'error', text: 'The payment could not be recorded. Please try again.' })
        return
      }

      if (!response.ok || !data || !['PENDING', 'SUCCESS', 'FAILED'].includes(data.status)) {
        setFeedback({ type: 'error', text: 'We could not process this payment. Please try again.' })
        return
      }

      setPaymentResult(data)
      setFeedback(null)
    } catch {
      setFeedback({ type: 'error', text: 'The payment service is unavailable. Please try again shortly.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resultHeading = {
    SUCCESS: 'Payment Successful',
    FAILED: 'Payment Failed',
    PENDING: 'Payment Pending',
  }

  if (isLoadingCards) {
    return <div className="page-loading" role="status"><span className="loading-dot" /> Loading your saved cards...</div>
  }

  return (
    <div className="payment-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAYMENTS</p>
          <h1>Make a payment</h1>
          <p className="page-description">Choose a saved card and enter the amount to pay.</p>
        </div>
        <span className="date-note">SECURE CHECKOUT</span>
      </div>

      {cards.length === 0 ? (
        <section className="empty-state payment-empty">
          <span className="empty-mark" aria-hidden="true">••••</span>
          <h2>No saved cards</h2>
          <p>Add a card before making a payment.</p>
          <button className="primary-button" type="button" onClick={onAddCard}>
            Add a card <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <div className="payment-layout">
          <form className="form-panel payment-form" onSubmit={handleSubmit} noValidate>
            <div className="form-panel-heading">
              <span className="step-index">01</span>
              <div><h2>Payment details</h2><p>Only saved cards can be used.</p></div>
            </div>

            <div className="field-group">
              <label htmlFor="payment-card">Saved card</label>
              <select
                id="payment-card"
                value={selectedCardId}
                onChange={(event) => setSelectedCardId(event.target.value)}
                required
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_type} ending in {card.last_four_digits} · expires {String(card.expiry_month).padStart(2, '0')}/{card.expiry_year}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group payment-amount-field">
              <label htmlFor="payment-amount">Amount (INR)</label>
              <div className="payment-amount-input">
                <span aria-hidden="true">₹</span>
                <input
                  id="payment-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max={MAX_PAYMENT_AMOUNT}
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
            </div>

            {feedback && (
              <p className={`form-message payment-feedback is-${feedback.type}`} role="status" aria-live="polite">
                {feedback.text}
              </p>
            )}

            <button className="primary-button payment-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Make payment'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <aside className="payment-side-panel">
            {paymentResult ? (
              <section className={`payment-result result-${paymentResult.status.toLowerCase()}`} aria-live="polite">
                <p className="eyebrow">PAYMENT RESULT</p>
                <h2>{resultHeading[paymentResult.status]}</h2>
                {paymentResult.transaction_id != null && (
                  <p className="payment-result-row"><span>Transaction ID</span><strong>{paymentResult.transaction_id}</strong></p>
                )}
                <p className="payment-result-amount">₹{formatAmount(paymentResult.amount)}</p>
                <p className="payment-result-row"><span>Status</span><strong>{paymentResult.status}</strong></p>
              </section>
            ) : (
              <div className="payment-summary">
                <p className="eyebrow">PAYMENT SUMMARY</p>
                <p className="payment-summary-amount">₹{amount && Number(amount) > 0 ? formatAmount(amount) : '0.00'}</p>
                <p className="payment-summary-note">Your card number and security code are never requested here.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default Payment