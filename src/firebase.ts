import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCqM2fTwccgFUKmrwFYP7XFVAgo-9sVArM",
  authDomain: "incubation-platform-61610.firebaseapp.com",
  projectId: "incubation-platform-61610",
  storageBucket: "incubation-platform-61610.firebasestorage.app",
  messagingSenderId: "608623931092",
  appId: "1:608623931092:web:449de44205d7d2d7d49541",
  measurementId: "G-V6MZVHG72Z",
};

// ✅ Initialize Firebase App
const app = initializeApp(firebaseConfig);

// ✅ Core Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// ✅ Optional: Export Analytics (only if supported)
let analytics: ReturnType<typeof getAnalytics> | null = null;

isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {
    analytics = null;
  });

export { app, analytics };
