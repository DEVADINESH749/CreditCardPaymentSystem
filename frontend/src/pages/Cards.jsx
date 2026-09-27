import { useEffect, useState } from 'react'
import { authenticatedFetch } from '../api/authenticatedFetch'
import { API_BASE_URL } from '../api/config'

function Cards({ onAddCard, onSessionExpired }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingCardId, setDeletingCardId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    let isActive = true

    const fetchCards = async () => {
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
            setFeedback({ type: 'error', text: 'Unable to load your cards. Please try again.' })
          }
          return
        }

        if (isActive) setCards(data)
      } catch {
        if (isActive) {
          setFeedback({ type: 'error', text: 'Unable to connect to the server. Please try again.' })
        }
      } finally {
        if (isActive) setLoading(false)
      }
    }

    fetchCards()
    return () => {
      isActive = false
    }
  }, [onSessionExpired])

  const handleDeleteCard = async (card) => {
    const confirmed = window.confirm(`Delete the card ending in ${card.last_four_digits}?`)
    if (!confirmed) return

    const token = localStorage.getItem('access_token')
    if (!token) {
      onSessionExpired()
      return
    }

    setDeletingCardId(card.id)
    setFeedback({ type: 'pending', text: 'Deleting card...' })

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/cards/${card.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }, onSessionExpired)

      if (response.ok) {
        setCards((currentCards) => currentCards.filter((item) => item.id !== card.id))
        setFeedback({ type: 'success', text: 'Card deleted successfully.' })
      } else {
        setFeedback({ type: 'error', text: 'Unable to delete this card. Please try again.' })
      }
    } catch {
      setFeedback({ type: 'error', text: 'Unable to connect to the server. Please try again.' })
    } finally {
      setDeletingCardId(null)
    }
  }

  if (loading) {
    return <div className="page-loading" role="status"><span className="loading-dot" /> Loading your cards...</div>
  }

  return (
    <div className="cards-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PAYMENT METHODS</p>
          <h1>My cards</h1>
          <p className="page-description">Your saved cards, organized in one place.</p>
        </div>
        <div className="cards-heading-actions">
          <span className="date-note">{cards.length} SAVED</span>
          <button className="primary-button" type="button" onClick={onAddCard}>
            Add a card <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      {feedback && (
        <p className={`form-message card-feedback is-${feedback.type}`} role="status" aria-live="polite">
          {feedback.text}
        </p>
      )}

      {cards.length === 0 ? (
        <div className="empty-state cards-empty">
          <span className="empty-mark" aria-hidden="true">••••</span>
          <h3>No cards saved</h3>
          <p>Add a payment card to see it listed here.</p>
        </div>
      ) : (
        <div className="saved-cards-grid">
          {cards.map((card, index) => (
            <article className={`saved-card ${index % 2 ? 'saved-card-alt' : ''}`} key={card.id}>
              <div className="saved-card-head">
                <span className="saved-card-type">{card.card_type} CARD</span>
                <span className="card-chip" aria-hidden="true"><i /><i /><i /><i /></span>
              </div>
              <p className="saved-card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {card.last_four_digits}</p>
              <div className="saved-card-foot">
                <span><small>CARDHOLDER</small><strong>{card.card_holder_name}</strong></span>
                <span><small>EXPIRES</small><strong>{String(card.expiry_month).padStart(2, '0')}/{card.expiry_year}</strong></span>
              </div>
              <button
                className="card-delete-button"
                type="button"
                onClick={() => handleDeleteCard(card)}
                disabled={deletingCardId === card.id}
                aria-label={`Delete card ending in ${card.last_four_digits}`}
              >
                {deletingCardId === card.id ? 'Deleting...' : 'Delete'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default Cards