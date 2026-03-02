import { createContext, useContext, useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { getUserProfile, createUserProfile, updateUserProfile, isAdmin } from '../services/userService';

const AuthContext = createContext(null);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]     = useState(null);
  const [userProfile, setUserProfile]     = useState(null);
  const [loading, setLoading]             = useState(true);
  const [isAdminUser, setIsAdminUser]     = useState(false);
  const [redirectError, setRedirectError] = useState(null); // kept for App.jsx compat

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[Auth] Setting up onAuthStateChanged listener...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth] onAuthStateChanged fired. User:', user ? `${user.email} (${user.uid})` : 'null (signed out)');
      setCurrentUser(user);
      if (user) {
        try {
          console.log('[Auth] Fetching Firestore profile for uid:', user.uid);
          const profile = await getUserProfile(user.uid);
          console.log('[Auth] Firestore profile result:', profile
            ? `found (name: ${profile.name}, city: ${profile.city})`
            : 'null (no profile yet — needs /complete-profile)');
          setUserProfile(profile);
          const adminStatus = await isAdmin(user.uid);
          console.log('[Auth] Admin status:', adminStatus);
          setIsAdminUser(adminStatus);
          if (profile) {
            await updateUserProfile(user.uid, { lastActive: new Date() });
            console.log('[Auth] lastActive updated.');
          }
        } catch (err) {
          console.error('[Auth] ❌ Error loading user profile:', err.code, err.message);
        }
      } else {
        setUserProfile(null);
        setIsAdminUser(false);
      }
      console.log('[Auth] setLoading(false) — auth check complete.');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Google Sign-In via popup ───────────────────────────────────────────────
  // Uses signInWithPopup (not redirect) so we don't depend on Firebase Hosting
  // for the /__/firebase/init.json endpoint. The COOP header fix in vite.config.js
  // (Cross-Origin-Opener-Policy: same-origin-allow-popups) allows the popup to
  // communicate back to this window via postMessage.
  async function signInWithGoogle() {
    console.log('[Auth] signInWithGoogle called — opening Google popup...');
    console.log('[Auth] NOTE: vite.config.js sets COOP: same-origin-allow-popups to allow this.');
    // Throws on failure → caller (LandingPage) catches and navigates to /auth-error
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[Auth] ✅ signInWithPopup succeeded! User:', result.user.email, '| UID:', result.user.uid);
    // onAuthStateChanged will fire next and set currentUser/userProfile
    return result;
  }

  async function completeProfile(uid, name, city) {
    const profile = await createUserProfile(uid, {
      phoneNumber: auth.currentUser?.phoneNumber || '',
      name,
      city,
    });
    setUserProfile(profile);
    return profile;
  }

  async function refreshProfile() {
    if (currentUser) {
      const profile = await getUserProfile(currentUser.uid);
      setUserProfile(profile);
      return profile;
    }
  }

  async function logout() {
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setIsAdminUser(false);
  }

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    loading,
    redirectPending: false,       // always false — popup doesn't navigate away
    redirectError,                // null unless explicitly set
    clearRedirectError: () => setRedirectError(null),
    isAdminUser,
    signInWithGoogle,
    completeProfile,
    refreshProfile,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
