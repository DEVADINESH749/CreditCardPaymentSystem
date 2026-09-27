import { useState } from 'react'
import { authenticatedFetch } from '../api/authenticatedFetch'
import { API_BASE_URL } from '../api/config'

const CARD_TYPES = ['CREDIT', 'DEBIT']

function normalizeCardNumber(value) {
  return value.replace(/[\s-]/g, '')
}

function isValidCardNumber(value) {
  const cardNumber = normalizeCardNumber(value)
  if (!/^[0-9]{13,19}$/.test(cardNumber)) return false

  const checksum = [...cardNumber].reverse().reduce((total, character, index) => {
    let digit = Number(character)
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    return total + digit
  }, 0)

  return checksum % 10 === 0
}

function AddCard({ onSessionExpired }) {
  const [cardType, setCardType] = useState('CREDIT')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)

    const cleanCardHolderName = cardHolderName.trim()
    const cardNumberDigits = normalizeCardNumber(cardNumber)
    const month = Number(expiryMonth)
    const year = Number(expiryYear)
    const today = new Date()

    if (!CARD_TYPES.includes(cardType)) {
      setFeedback({ type: 'error', text: 'Select a valid card type.' })
      return
    }
    if (!cleanCardHolderName) {
      setFeedback({ type: 'error', text: 'Enter the cardholder name.' })
      return
    }
    if (!isValidCardNumber(cardNumber)) {
      setFeedback({ type: 'error', text: 'Enter a valid card number with 13 to 19 digits.' })
      return
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      setFeedback({ type: 'error', text: 'Enter an expiry month from 1 to 12.' })
      return
    }
    if (!Number.isInteger(year) || (year * 100 + month) < (today.getFullYear() * 100 + today.getMonth() + 1)) {
      setFeedback({ type: 'error', text: 'Enter a current or future expiry date.' })
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      onSessionExpired()
      return
    }

    setIsSubmitting(true)
    setFeedback({ type: 'pending', text: 'Adding card...' })
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/cards/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_type: cardType,
          card_holder_name: cleanCardHolderName,
          card_number: cardNumberDigits,
          expiry_month: month,
          expiry_year: year,
        }),
      }, onSessionExpired)

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setFeedback({ type: 'success', text: 'Card added successfully.' })
        setCardHolderName('')
        setCardNumber('')
        setExpiryMonth('')
        setExpiryYear('')
      } else if (data.card_number) {
        setFeedback({ type: 'error', text: 'Enter a valid card number.' })
      } else if (data.expiry_month || data.expiry_year) {
        setFeedback({ type: 'error', text: 'Enter a valid current or future expiry date.' })
      } else if (data.card_type) {
        setFeedback({ type: 'error', text: 'Select a valid card type.' })
      } else {
        setFeedback({ type: 'error', text: 'Unable to add this card. Check the details and try again.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Unable to connect to the server. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="add-card-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAYMENT METHODS</p>
          <h1>Add a card</h1>
          <p className="page-description">Enter your card details to save a payment method.</p>
        </div>
        <span className="date-note">SECURE ENTRY</span>
      </div>

      <div className="add-card-layout">
        <form className="form-panel" onSubmit={handleSubmit} noValidate>
          <div className="form-panel-heading">
            <span className="step-index">01</span>
            <div><h2>Card details</h2><p>All fields are required.</p></div>
          </div>

          <div className="field-group">
            <label htmlFor="card-type">Card type</label>
            <select id="card-type" value={cardType} onChange={(e) => setCardType(e.target.value)} required>
              <option value="CREDIT">Credit card</option>
              <option value="DEBIT">Debit card</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="card-holder">Cardholder name</label>
            <input id="card-holder" type="text" placeholder="Name on card" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} maxLength="100" required autoComplete="cc-name" />
          </div>

          <div className="field-group">
            <label htmlFor="card-number">Card number</label>
            <input id="card-number" type="password" inputMode="numeric" placeholder="Card number" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} maxLength="23" required autoComplete="cc-number" />
          </div>

          <div className="expiry-fields">
            <div className="field-group">
              <label htmlFor="expiry-month">Expiry month</label>
              <input id="expiry-month" type="number" placeholder="MM" value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value)} min="1" max="12" required autoComplete="cc-exp-month" />
            </div>
            <div className="field-group">
              <label htmlFor="expiry-year">Expiry year</label>
              <input id="expiry-year" type="number" placeholder="YYYY" value={expiryYear} onChange={(e) => setExpiryYear(e.target.value)} min={new Date().getFullYear()} required autoComplete="cc-exp-year" />
            </div>
          </div>

          <div className="form-submit-row">
            <p className="form-note"><span className="secure-indicator" /> Card number is masked when saved.</p>
            <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save card'} <span aria-hidden="true">→</span></button>
          </div>
          {feedback && <p className={`form-message form-message-inline card-form-message is-${feedback.type}`} role="status" aria-live="polite">{feedback.text}</p>}
        </form>

        <aside className="card-preview-panel">
          <p className="eyebrow">PREVIEW</p>
          <article className="preview-payment-card">
            <div className="preview-card-head"><span>PAYSECURE</span><span className="art-card-mark">P</span></div>
            <div className="art-chip"><span /><span /><span /><span /></div>
            <p className="preview-card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {cardNumber.slice(-4) || '••••'}</p>
            <div className="preview-card-foot"><span><small>CARDHOLDER</small><strong>{cardHolderName || 'YOUR NAME'}</strong></span><span><small>EXPIRES</small><strong>{expiryMonth ? expiryMonth.padStart(2, '0') : 'MM'}/{expiryYear || 'YYYY'}</strong></span></div>
          </article>
          <p className="preview-caption">Your card number is displayed in masked form after it is saved.</p>
        </aside>
      </div>
    </div>
  )
}

export default AddCard