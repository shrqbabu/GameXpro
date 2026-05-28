import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile, UserWallet } from '../types';
import { generateReferralCode, generateAvatar } from '../utils/helpers';
import toast from 'react-hot-toast';

// ============================================================
// CONTEXT TYPES
// ============================================================
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;

  // Auth methods
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // Profile methods
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Wallet methods
  updateWallet: (wallet: Partial<UserWallet>) => Promise<void>;
  addDemoChips: (amount: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================================
// DEMO USER DEFAULTS
// ============================================================
const getDefaultWallet = (): UserWallet => ({
  mainBalance: 0,
  depositBalance: 0,
  winningBalance: 0,
  bonusBalance: 100, // Welcome bonus
  totalDeposited: 0,
  totalWon: 0,
  totalWithdrawn: 0,
});

const createDefaultProfile = (uid: string, email: string, username: string): UserProfile => ({
  uid,
  username,
  email,
  displayName: username,
  avatarUrl: '',
  avatarIndex: Math.floor(Math.random() * 8),
  role: email.includes('admin') ? 'admin' : 'player',
  status: 'active',
  wallet: getDefaultWallet(),
  demoChips: 5000,
  joinDate: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  gamesPlayed: 0,
  gamesWon: 0,
  totalEarnings: 0,
  referralCode: generateReferralCode(uid),
  level: 1,
  xp: 0,
  dailyBonusLastClaimed: '',
});

// ============================================================
// PROVIDER
// ============================================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'moderator';

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          await loadUserProfile(firebaseUser.uid);
        } catch {
          // If Firestore fails (demo mode), use local profile
          const mockProfile = createDefaultProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player'
          );
          setUserProfile(mockProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadUserProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        setUserProfile(data);
        // Update last seen
        await updateDoc(userRef, { lastSeen: new Date().toISOString() });
      }
    } catch {
      // Demo mode — Firestore may not be connected
      console.info('[Demo Mode] Using mock profile data');
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await loadUserProfile(result.user.uid);
    } catch (error: unknown) {
      // Demo fallback — simulate login with mock data
      if ((error as { code?: string }).code === 'auth/network-request-failed' ||
          (error as { code?: string }).code === 'auth/invalid-api-key' ||
          (error as { code?: string }).code === 'auth/api-key-not-valid') {
        const mockUid = 'demo-' + email.replace(/[^a-z0-9]/g, '');
        const mockProfile = createDefaultProfile(mockUid, email, email.split('@')[0]);
        mockProfile.demoChips = 10000;
        mockProfile.gamesPlayed = 47;
        mockProfile.gamesWon = 18;
        mockProfile.wallet.depositBalance = 500;
        mockProfile.wallet.winningBalance = 250;
        mockProfile.wallet.bonusBalance = 100;
        if (email.includes('admin')) {
          mockProfile.role = 'admin';
        }
        setUserProfile(mockProfile);
        return;
      }
      const code = (error as { code?: string }).code;
      if (code === 'auth/user-not-found') throw new Error('No account found with this email');
      if (code === 'auth/wrong-password') throw new Error('Incorrect password');
      if (code === 'auth/invalid-credential') throw new Error('Invalid email or password');
      throw new Error('Login failed. Please try again.');
    }
  };

  const signup = async (email: string, username: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: username });

      const profile = createDefaultProfile(result.user.uid, email, username);

      try {
        await setDoc(doc(db, 'users', result.user.uid), {
          ...profile,
          createdAt: serverTimestamp(),
        });
      } catch {
        console.info('[Demo Mode] Skipping Firestore write');
      }

      setUserProfile(profile);
      generateAvatar(username);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/email-already-in-use') throw new Error('Email already registered');
      if (code === 'auth/weak-password') throw new Error('Password must be at least 6 characters');
      if (code === 'auth/network-request-failed' || code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
        // Demo mode signup
        const mockUid = 'demo-' + Date.now();
        const mockProfile = createDefaultProfile(mockUid, email, username);
        setUserProfile(mockProfile);
        return;
      }
      throw new Error('Signup failed. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch {
      setUser(null);
      setUserProfile(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/user-not-found') throw new Error('No account found with this email');
      if (code === 'auth/network-request-failed' || code === 'auth/invalid-api-key') {
        toast.success('Demo Mode: Password reset email simulated!');
        return;
      }
      throw new Error('Failed to send reset email. Please try again.');
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user && !userProfile) return;
    const uid = user?.uid || userProfile?.uid;
    if (!uid) return;

    setUserProfile((prev) => prev ? { ...prev, ...data } : null);

    try {
      await updateDoc(doc(db, 'users', uid), data as Record<string, unknown>);
    } catch {
      console.info('[Demo Mode] Profile updated locally');
    }
  };

  const refreshProfile = async () => {
    const uid = user?.uid || userProfile?.uid;
    if (!uid) return;
    await loadUserProfile(uid);
  };

  const updateWallet = async (wallet: Partial<UserWallet>) => {
    if (!userProfile) return;
    const updatedWallet = { ...userProfile.wallet, ...wallet };
    setUserProfile((prev) => prev ? { ...prev, wallet: updatedWallet } : null);

    try {
      const uid = user?.uid || userProfile.uid;
      await updateDoc(doc(db, 'users', uid), { wallet: updatedWallet });
    } catch {
      console.info('[Demo Mode] Wallet updated locally');
    }
  };

  const addDemoChips = async (amount: number) => {
    if (!userProfile) return;
    const newChips = userProfile.demoChips + amount;
    setUserProfile((prev) => prev ? { ...prev, demoChips: newChips } : null);

    try {
      const uid = user?.uid || userProfile.uid;
      await updateDoc(doc(db, 'users', uid), { demoChips: newChips });
    } catch {
      console.info('[Demo Mode] Demo chips updated locally');
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    isAdmin,
    login,
    signup,
    logout,
    resetPassword,
    updateUserProfile,
    refreshProfile,
    updateWallet,
    addDemoChips,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================
// HOOK
// ============================================================
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
