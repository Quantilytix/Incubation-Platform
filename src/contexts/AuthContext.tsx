import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User as FirebaseUser } from "firebase/auth";
import {
  UserProfile,
  UserRole,
  onAuthChange,
  getUserProfile,
  signOutUser,
  signInWithEmail,
  signInWithGoogle,
  signUpHeadmaster,
  signUpWithSchoolCode,
  completeGoogleSignup,
  sendPasswordReset
} from "@/services/authService";


// Map technical Firebase errors to user-friendly messages
function friendlyError(error: any): string {
  const code = error?.code || "";
  const msg = error?.message || "";

  const errorMap: Record<string, string> = {
    "auth/user-not-found": "No account found with this email. Please sign up first.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password. Please check and try again.",
    "auth/email-already-in-use": "This email is already registered. Try signing in instead.",
    "auth/weak-password": "Password is too short. Please use at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Please check your internet connection.",
    "auth/popup-closed-by-user": "Sign-in was cancelled. Please try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled. Please contact support.",
  };

  if (errorMap[code]) return errorMap[code];
  if (msg === "Invalid school code") return "Invalid school code. Please check with your school and try again.";
  if (msg.includes("Unsupported field value")) return "Something went wrong during signup. Please try again.";
  if (msg.includes("permission")) return "You don't have permission to perform this action.";

  return "Something went wrong. Please try again later.";
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;

  // Auth actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  signupHeadmaster: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signupWithCode: (email: string, password: string, name: string, role: UserRole, schoolCode: string) => Promise<{ success: boolean; error?: string }>;
  completeGoogleOnboarding: (name: string, role: UserRole, schoolCode?: string) => Promise<{ success: boolean; error?: string }>;

  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;

  // Parent helpers
  switchChild: (childId: string) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        const profile = await getUserProfile(fbUser.uid);
        setUser(profile);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid);
      setUser(profile);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { profile } = await signInWithEmail(email, password);

      if (!profile) {
        return { success: false, error: "Account not fully set up. Please contact support." };
      }

      if (profile.status === "pending") {
        return { success: false, error: "Your account is pending approval from the school administrator." };
      }

      if (profile.status === "suspended") {
        return { success: false, error: "Your account has been suspended. Please contact the school." };
      }

      setUser(profile);
      return { success: true };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, error: friendlyError(error) };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> => {
    try {
      const { profile, isNewUser } = await signInWithGoogle();

      if (isNewUser) {
        return { success: true, isNewUser: true };
      }

      if (profile?.status === "pending") {
        return { success: false, error: "Your account is pending approval." };
      }

      if (profile?.status === "suspended") {
        return { success: false, error: "Your account has been suspended." };
      }

      setUser(profile);
      return { success: true, isNewUser: false };
    } catch (error: any) {
      console.error("Google login error:", error);
      return { success: false, error: friendlyError(error) };
    }
  };

  const signupHeadmaster = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { profile } = await signUpHeadmaster(email, password, name);
      setUser(profile);
      return { success: true };
    } catch (error: any) {
      console.error("Signup error:", error);
      return { success: false, error: friendlyError(error) };
    }
  };

  const signupWithCode = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    schoolCode: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { profile } = await signUpWithSchoolCode(email, password, name, role, schoolCode);
      setUser(profile);
      return { success: true };
    } catch (error: any) {
      console.error("Signup with code error:", error);
      return { success: false, error: friendlyError(error) };
    }
  };

  const completeGoogleOnboarding = async (
    name: string,
    role: UserRole,
    schoolCode?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!firebaseUser) {
        return { success: false, error: "No authenticated user" };
      }

      const profile = await completeGoogleSignup(firebaseUser, name, role, schoolCode);
      setUser(profile);
      return { success: true };
    } catch (error: any) {
      console.error("Complete onboarding error:", error);
      return { success: false, error: friendlyError(error) };
    }
  };


  const logout = async () => {
    await signOutUser();
    setUser(null);
    setFirebaseUser(null);
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordReset(email);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: friendlyError(error) };
    }
  };

  const switchChild = (childId: string) => {
    if (user && user.role === "parent" && user.childIds?.includes(childId)) {
      setUser({
        ...user,
        selectedChildId: childId,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        isAuthenticated: !!user && user.status === "active",
        login,
        loginWithGoogle,
        signupHeadmaster,
        signupWithCode,
        completeGoogleOnboarding,

        logout,
        resetPassword,
        switchChild,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
