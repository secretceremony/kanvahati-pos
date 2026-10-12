// --- Firebase Initialization ---

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Read environment config (supports Vite import.meta.env and Node process.env for tests)
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || "mock-api-key",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "mock-auth-domain.firebaseapp.com",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "mock-project-id",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "mock-storage.appspot.com",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
    appId: env.VITE_FIREBASE_APP_ID || "1:123:web:123"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
