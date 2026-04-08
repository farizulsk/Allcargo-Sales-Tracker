import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { OperationType, FirestoreErrorInfo } from './types';

// Support both local config file and environment variables (for Netlify/Production)
let config;
try {
  // @ts-ignore - Fallback for local development
  config = await import('../firebase-applet-config.json').then(m => m.default);
} catch (e) {
  config = {
    // @ts-ignore
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    // @ts-ignore
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    // @ts-ignore
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    // @ts-ignore
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    // @ts-ignore
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    // @ts-ignore
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    // @ts-ignore
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID
  };
}

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
