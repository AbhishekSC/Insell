// Storage keys for dual-token auth (accessToken + refreshToken)
const TOKEN_KEY = "insell_auth_token";
const REFRESH_TOKEN_KEY = "insell_refresh_token";

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token, refreshToken = null) {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (e.g. private mode)
  }
  if (refreshToken) {
    setRefreshToken(refreshToken);
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // Storage unavailable
  }
}

export function setAuthTokens({ accessToken, refreshToken }) {
  if (accessToken) setAuthToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
}

export function clearAuthTokens() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem("NEARMPSPACE_WEB_CACHE_V1");
  } catch {
    // Ignore.
  }
}

// Backwards compatibility alias
export function clearAuthToken() {
  clearAuthTokens();
}
