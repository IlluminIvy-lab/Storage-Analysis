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

import {
  setAccessToken as setInMemoryToken,
  getAccessToken as getInMemoryToken,
  isTokenExpired as isInMemoryTokenExpired,
  clearAccessToken as clearInMemoryToken,
  purgeLegacyStorageTokens,
} from './tokenManager';

// Purge any legacy Web Storage tokens immediately
purgeLegacyStorageTokens();

// Storage Keys for cached user profile (NO tokens)
export const STORAGE_KEYS = {
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
  setInMemoryToken(token, expiresInSeconds);
};

export const getStoredToken = (): string | null => {
  return getInMemoryToken();
};

export const isStoredTokenExpired = (): boolean => {
  return isInMemoryTokenExpired();
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
  clearInMemoryToken();
  try {
    localStorage.removeItem(STORAGE_KEYS.USER);
  } catch (err) {
    console.warn('Failed to clear stored auth in localStorage:', err);
  }
};

export const getAccessToken = (): string | null => {
  return getInMemoryToken();
};

export const setAccessToken = (token: string | null, expiresInSeconds: number = 3540) => {
  setInMemoryToken(token, expiresInSeconds);
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
