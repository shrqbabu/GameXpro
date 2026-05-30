import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { onAuthChange } from '../firebase/auth';
import { User, Wallet } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  wallet: Wallet | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  user: null,
  wallet: null,
  loading: true,
  isAdmin: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthChange((fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setWallet(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    let unsubUser: (() => void) | undefined;
    let unsubWallet: (() => void) | undefined;

    unsubUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      if (snap.exists()) {
        setUser({ id: snap.id, ...snap.data() } as any);
      }
      setLoading(false);
    });

    unsubWallet = onSnapshot(doc(db, 'wallets', firebaseUser.uid), (snap) => {
      if (snap.exists()) {
        setWallet(snap.data() as Wallet);
      }
    });

    return () => {
      unsubUser?.();
      unsubWallet?.();
    };
  }, [firebaseUser]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        wallet,
        loading,
        isAdmin: user?.isAdmin || false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
