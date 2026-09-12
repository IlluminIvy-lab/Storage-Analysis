import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly ensure local browser persistence for Firebase user authentication state
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set browserLocalPersistence for Firebase Auth:', err);
});

// Storage Keys for persistent Google Workspace connection
export const STORAGE_KEYS = {
  TOKEN: 'drive_workspace_access_token',
  TIMESTAMP: 'drive_workspace_token_timestamp',
  EXPIRES_AT: 'drive_workspace_token_expires_at',
  USER: 'drive_workspace_cached_user',
};

export interface CachedUserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Token and User persistence utilities
export const saveStoredToken = (token: string, expiresInSeconds: number = 3540) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    const now = Date.now();
    localStorage.setItem(STORAGE_KEYS.TIMESTAMP, now.toString());
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, (now + expiresInSeconds * 1000).toString());
  } catch (err) {
    console.warn('Failed to save OAuth token to localStorage:', err);
  }
};

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  } catch {
    return null;
  }
};

export const isStoredTokenExpired = (): boolean => {
  try {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
    if (!expiresAt) return false;
    // Consider token expired if within 60 seconds of expiration
    return Date.now() >= parseInt(expiresAt, 10) - 60000;
  } catch {
    return false;
  }
};

export const saveCachedUser = (user: User | CachedUserData) => {
  try {
    const userData: CachedUserData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
  } catch (err) {
    console.warn('Failed to save cached user to localStorage:', err);
  }
};

export const getCachedUser = (): CachedUserData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TIMESTAMP);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEYS.USER);
  } catch (err) {
    console.warn('Failed to clear stored auth in localStorage:', err);
  }
};

let cachedAccessToken: string | null = getStoredToken();
let isSigningIn = false;

/**
 * Initializes and monitors auth state across browser sessions.
 * Preserves the user connection until they explicitly choose to logout.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      saveCachedUser(user);
      const token = cachedAccessToken || getStoredToken();
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else {
        // Firebase user exists across sessions, but token needs refresh
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      // User is not logged into Firebase
      // Only invoke failure if there is also no cached session
      const storedToken = getStoredToken();
      const cachedUser = getCachedUser();
      if (!storedToken && !cachedUser) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Signs in or reconnects Google Drive with OAuth scopes.
 * If loginHint is provided, skips account selection to smoothly refresh the current user.
 */
export const googleSignIn = async (options?: {
  loginHint?: string;
}): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');

    if (options?.loginHint) {
      provider.setCustomParameters({
        login_hint: options.loginHint,
      });
    } else {
      provider.setCustomParameters({
        prompt: 'select_account',
      });
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not retrieve access token from Google sign-in.');
    }

    cachedAccessToken = credential.accessToken;
    saveStoredToken(credential.accessToken);
    saveCachedUser(result.user);

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken || getStoredToken();
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    saveStoredToken(token);
  } else {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch {}
  }
};

/**
 * Explicit user logout. Wipes persistent tokens and signs out of Firebase.
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out error:', err);
  }
  cachedAccessToken = null;
  clearStoredAuth();
};
