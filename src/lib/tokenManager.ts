/**
 * In-memory token manager for Google Drive access tokens.
 *
 * CRITICAL SECURITY & COMPLIANCE REQUIREMENTS:
 * - Drive tokens must NEVER be written to localStorage or sessionStorage.
 * - Expired tokens must be detected and rejected in-memory.
 * - Purges any legacy tokens that may have been previously written to Web Storage.
 */

interface TokenState {
  token: string | null;
  expiresAt: number | null; // epoch timestamp ms
}

const state: TokenState = {
  token: null,
  expiresAt: null,
};

export const TOKEN_EXPIRY_BUFFER_MS = 60000; // 60 seconds buffer

/**
 * Purges any legacy Drive OAuth tokens from localStorage or sessionStorage
 * to ensure tokens never reside in persistent web storage.
 */
export function purgeLegacyStorageTokens(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('drive_workspace_access_token');
      localStorage.removeItem('drive_workspace_token_timestamp');
      localStorage.removeItem('drive_workspace_token_expires_at');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('drive_workspace_access_token');
      sessionStorage.removeItem('drive_workspace_token_timestamp');
      sessionStorage.removeItem('drive_workspace_token_expires_at');
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Stores an access token in-memory only with an expiration timestamp.
 * Defaults to ~59 minutes (3540s) if not specified.
 */
export function setAccessToken(token: string | null, expiresInSeconds: number = 3540): void {
  // Purge any legacy storage tokens just in case
  purgeLegacyStorageTokens();

  if (!token) {
    state.token = null;
    state.expiresAt = null;
    return;
  }

  state.token = token;
  state.expiresAt = Date.now() + expiresInSeconds * 1000;
}

/**
 * Retrieves the current in-memory token, returning null if expired or missing.
 */
export function getAccessToken(): string | null {
  if (!state.token || !state.expiresAt) {
    return null;
  }

  // Reject expired tokens (accounting for buffer)
  if (isTokenExpired()) {
    return null;
  }

  return state.token;
}

/**
 * Checks if the in-memory token is expired or within the buffer window.
 */
export function isTokenExpired(): boolean {
  if (!state.expiresAt) return true;
  return Date.now() >= state.expiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Clears the in-memory token and any storage remnants.
 */
export function clearAccessToken(): void {
  state.token = null;
  state.expiresAt = null;
  purgeLegacyStorageTokens();
}

/**
 * For testing purposes: inspect current in-memory state.
 */
export function getTokenStateForTesting(): { token: string | null; expiresAt: number | null } {
  return { ...state };
}
