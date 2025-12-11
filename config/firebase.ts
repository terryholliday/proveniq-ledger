import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemo-placeholder",
  authDomain: "gen-lang-client-0226043550.firebaseapp.com",
  projectId: "gen-lang-client-0226043550",
  storageBucket: "gen-lang-client-0226043550.firebasestorage.app",
  messagingSenderId: "219675013828",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:219675013828:web:placeholder"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
