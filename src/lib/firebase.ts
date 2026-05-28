import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Firebase configuration — replace with your own project credentials
// In production, use environment variables: import.meta.env.VITE_FIREBASE_*
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyForRoyalFlushPokerApp123456",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "royalflush-poker-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "royalflush-poker-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "royalflush-poker-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890abcdef",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://royalflush-poker-demo-default-rtdb.firebaseio.com",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export default app;

// ============================================================
// FIREBASE SECURITY RULES (reference — apply in Firebase Console)
// ============================================================
/*
// Firestore Rules:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    // Transactions — read own, admin reads all
    match /transactions/{txId} {
      allow read: if request.auth != null && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    // Game tables — authenticated users
    match /tables/{tableId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    // Admin-only collections
    match /admin/{document=**} {
      allow read, write: if request.auth != null && isAdmin();
    }
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
*/
