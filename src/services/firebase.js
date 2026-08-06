import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration from environment variables (set at build/deploy time)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "(config via VITE_FIREBASE_API_KEY)",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "(config via VITE_FIREBASE_AUTH_DOMAIN)",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "(config via VITE_FIREBASE_PROJECT_ID)",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "(config via VITE_FIREBASE_STORAGE_BUCKET)",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "(config via VITE_FIREBASE_MESSAGING_SENDER_ID)",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "(config via VITE_FIREBASE_APP_ID)",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "(config via VITE_FIREBASE_MEASUREMENT_ID)"
};

// Check if Firebase keys are provided
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

let app;
let auth;
let db;
let googleProvider;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.warn("Firebase initialization warning:", error);
}

export { app, auth, db, googleProvider };
