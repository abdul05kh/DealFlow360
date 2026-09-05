import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dealflow360-98.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dealflow360-98",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dealflow360-98.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "798769626042",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:798769626042:web:68ae5d905b06a313b2fb83",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MG9L4B239R",
};

// Initialize Firebase App singleton
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

export { signInWithEmailAndPassword, signOut };
