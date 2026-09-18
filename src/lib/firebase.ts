import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => console.warn('Could not set Firebase Auth persistence:', err));

export const STORAGE_KEYS = { TOKEN: 'drive_workspace_access_token', TIMESTAMP: 'drive_workspace_token_timestamp', EXPIRES_AT: 'drive_workspace_token_expires_at', USER: 'drive_workspace_cached_user' };
export interface CachedUserData { uid: string; email: string | null; displayName: string | null; photoURL: string | null; }

// Firebase Auth may persist the signed-in user; the separate Drive bearer token does not.
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let isSigningIn = false;

const clearLegacyDriveTokenStorage = () => {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      storage.removeItem(STORAGE_KEYS.TOKEN);
      storage.removeItem(STORAGE_KEYS.TIMESTAMP);
      storage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    }
  } catch { /* Storage may be unavailable in restricted browsers. */ }
};
if (typeof window !== 'undefined') clearLegacyDriveTokenStorage();

export const saveStoredToken = (token: string, expiresInSeconds = 3540) => {
  cachedAccessToken = token;
  tokenExpiresAt = Date.now() + Math.max(1, expiresInSeconds) * 1000;
};
export const getStoredToken = (): string | null => {
  if (!cachedAccessToken || isStoredTokenExpired()) return null;
  return cachedAccessToken;
};
export const isStoredTokenExpired = (): boolean => Boolean(cachedAccessToken && Date.now() >= tokenExpiresAt - 60000);

export const saveCachedUser = (user: User | CachedUserData) => {
  try { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL })); } catch { /* optional convenience cache */ }
};
export const getCachedUser = (): CachedUserData | null => { try { const raw = localStorage.getItem(STORAGE_KEYS.USER); return raw ? JSON.parse(raw) : null; } catch { return null; } };
export const clearStoredAuth = () => { clearLegacyDriveTokenStorage(); try { localStorage.removeItem(STORAGE_KEYS.USER); } catch {} };

export const initAuth = (onAuthSuccess?: (user: User, token: string) => void, onAuthFailure?: () => void) => onAuthStateChanged(auth, async (user) => {
  if (user) { saveCachedUser(user); onAuthSuccess?.(user, getStoredToken() || ''); }
  else { cachedAccessToken = null; tokenExpiresAt = 0; onAuthFailure?.(); }
});

export const googleSignIn = async (options?: { loginHint?: string }): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.setCustomParameters(options?.loginHint ? { login_hint: options.loginHint } : { prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error('Could not retrieve access token from Google sign-in.');
    saveStoredToken(credential.accessToken);
    saveCachedUser(result.user);
    return { user: result.user, accessToken: credential.accessToken };
  } finally { isSigningIn = false; }
};
export const getAccessToken = (): string | null => getStoredToken();
export const setAccessToken = (token: string | null) => { if (token) saveStoredToken(token); else { cachedAccessToken = null; tokenExpiresAt = 0; } };
export const logout = async () => { try { await signOut(auth); } finally { cachedAccessToken = null; tokenExpiresAt = 0; clearStoredAuth(); } };
