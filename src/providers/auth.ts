import type { AuthProvider } from "@refinedev/core";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "@/firebase"; // ensure this file doesn't break SSR

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();

      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", token);
      }

      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          name: "Login Failed",
          message: error.message,
        },
      };
    }
  },

  logout: async () => {
    await signOut(auth);
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
    }

    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    if (typeof window === "undefined") {
      return { authenticated: false, redirectTo: "/login" };
    }

    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          resolve({ authenticated: true });
        } else {
          resolve({ authenticated: false, redirectTo: "/login" });
        }
      });
    });
  },

  getIdentity: async () => {
    const user: User | null = auth.currentUser;
    if (user) {
      return {
        id: user.uid,
        name: user.displayName || user.email || "Anonymous",
        email: user.email,
        avatar: user.photoURL ?? undefined,
      };
    }
    return undefined;
  },

  onError: async (error) => {
    return { error };
  },
};