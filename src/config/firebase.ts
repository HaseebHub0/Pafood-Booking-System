import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  
  // Initialize Auth with AsyncStorage persistence for React Native
  if (Platform.OS !== 'web') {
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (error: any) {
      // If already initialized, just get the existing instance
      if (error.code === 'auth/already-initialized') {
        auth = getAuth(app);
      } else {
        throw error;
      }
    }
  } else {
    auth = getAuth(app);
  }
} else {
  app = getApps()[0];
  db = getFirestore(app);
  auth = getAuth(app);
}

export { app, db, auth };
export default app;


