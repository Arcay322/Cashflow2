import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for guest/demo user
    const savedDemo = localStorage.getItem('CASHFLOW_DEMO_USER');
    if (savedDemo) {
      setCurrentUser(JSON.parse(savedDemo));
      setIsDemoUser(true);
      setLoading(false);
      return;
    }

    if (auth && isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsDemoUser(false);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Default to guest demo user so the app works out of the box!
      const defaultDemo = {
        uid: 'demo_user_123',
        email: 'usuario.demo@cashflow.ia',
        displayName: 'Usuario Demo',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      };
      setCurrentUser(defaultDemo);
      setIsDemoUser(true);
      setLoading(false);
    }
  }, []);

  const loginWithEmail = async (email, password) => {
    if (auth && isFirebaseConfigured) {
      return signInWithEmailAndPassword(auth, email, password);
    }
    // Demo login fallback
    const demoUser = {
      uid: 'user_' + Date.now(),
      email,
      displayName: email.split('@')[0],
      photoURL: null
    };
    localStorage.setItem('CASHFLOW_DEMO_USER', JSON.stringify(demoUser));
    setCurrentUser(demoUser);
    setIsDemoUser(true);
  };

  const registerWithEmail = async (email, password) => {
    if (auth && isFirebaseConfigured) {
      return createUserWithEmailAndPassword(auth, email, password);
    }
    return loginWithEmail(email, password);
  };

  const loginWithGoogle = async () => {
    if (auth && isFirebaseConfigured && googleProvider) {
      return signInWithPopup(auth, googleProvider);
    }
    const demoUser = {
      uid: 'google_demo_' + Date.now(),
      email: 'usuario.google@cashflow.ia',
      displayName: 'Usuario Google Demo',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
    };
    localStorage.setItem('CASHFLOW_DEMO_USER', JSON.stringify(demoUser));
    setCurrentUser(demoUser);
    setIsDemoUser(true);
  };

  const logout = async () => {
    if (auth && isFirebaseConfigured) {
      await signOut(auth);
    }
    localStorage.removeItem('CASHFLOW_DEMO_USER');
    setCurrentUser(null);
    setIsDemoUser(false);
  };

  const value = {
    currentUser,
    isDemoUser,
    loading,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
