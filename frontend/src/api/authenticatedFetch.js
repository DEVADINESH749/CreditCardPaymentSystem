import { API_BASE_URL } from './config'

let refreshInFlight = null
let sessionExpiryHandled = false
let authStateVersion = 0

export function storeAuthTokens({ access, refresh }) {
  if (access) localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
  sessionExpiryHandled = false
  authStateVersion += 1
}

export function clearAuthTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  authStateVersion += 1
}

function expireSession(onSessionExpired) {
  if (sessionExpiryHandled) return
  sessionExpiryHandled = true
  clearAuthTokens()
  onSessionExpired?.()
}

function refreshAccessToken() {
  if (!refreshInFlight) {
    const refresh = localStorage.getItem('refresh_token')
    const startingAuthStateVersion = authStateVersion

    refreshInFlight = (async () => {
      if (!refresh) return { state: 'invalid' }

      try {
        const response = await fetch(`${API_BASE_URL}/users/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        })

        if (
          startingAuthStateVersion !== authStateVersion ||
          localStorage.getItem('refresh_token') !== refresh
        ) {
          return { state: 'cancelled' }
        }
        if (response.status === 400 || response.status === 401) {
          return { state: 'invalid' }
        }
        if (!response.ok) return { state: 'unavailable' }

        const data = await response.json().catch(() => null)
        if (!data?.access) return { state: 'invalid' }

        storeAuthTokens({ access: data.access, refresh: data.refresh })
        return { state: 'refreshed', access: data.access }
      } catch {
        return { state: 'unavailable' }
      }
    })().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

function withAccessToken(options, accessToken) {
  const headers = new Headers(options.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  else headers.delete('Authorization')
  return { ...options, headers }
}

export async function authenticatedFetch(input, options = {}, onSessionExpired) {
  const accessToken = localStorage.getItem('access_token')
  const response = await fetch(input, withAccessToken(options, accessToken))
  if (response.status !== 401) return response

  const latestAccessToken = localStorage.getItem('access_token')
  if (latestAccessToken && latestAccessToken !== accessToken) {
    return fetch(input, withAccessToken(options, latestAccessToken))
  }

  const refreshResult = await refreshAccessToken()
  if (refreshResult.state === 'cancelled') {
    const currentAccessToken = localStorage.getItem('access_token')
    if (currentAccessToken && currentAccessToken !== accessToken) {
      return fetch(input, withAccessToken(options, currentAccessToken))
    }
    return response
  }
  if (refreshResult.state === 'invalid') {
    expireSession(onSessionExpired)
    return response
  }
  if (refreshResult.state !== 'refreshed') return response

  return fetch(input, withAccessToken(options, refreshResult.access))
}