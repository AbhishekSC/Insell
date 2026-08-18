// Cookie-based auth (syncspace_token) doesn't work cross-site on Safari,
// which blocks third-party cookies by default even with SameSite=None —
// so the backend also hands back a token in login/signup responses, and we
// send it ourselves as an Authorization header (see lib/axios.js).
const TOKEN_KEY = "insell_auth_token";

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (e.g. private mode) — cookie auth still applies
    // wherever the browser allows it.
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore.
  }
}
